/**
 * HTTP static file server for serving the built UI assets.
 *
 * Uses node:http + node:fs — no Express needed.
 * Prevents path traversal, provides SPA fallback, and sets appropriate cache headers.
 */

import { createReadStream, existsSync, fstatSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * MIME type mapping for common web assets.
 */
const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

const DEFAULT_MIME = 'application/octet-stream';

/**
 * Resolve the MIME type for a file extension.
 */
export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? DEFAULT_MIME;
}

/**
 * Create an HTTP request handler that serves static files from `distPath`.
 *
 * - Path traversal prevention: normalized paths must stay within distPath
 * - SPA fallback: non-file paths serve index.html
 * - Cache: index.html gets `no-cache`, hashed assets get `immutable`
 * - Stream-first: no TOCTOU race — file type verified via fstat on the open fd
 *
 * Returns `null` if distPath doesn't exist (caller should skip static serving).
 */
export function createStaticHandler(
  distPath: string,
): ((req: IncomingMessage, res: ServerResponse) => void) | null {
  const resolvedDist = resolve(distPath);

  if (!existsSync(resolvedDist)) {
    return null;
  }

  const indexPath = join(resolvedDist, 'index.html');

  return (req: IncomingMessage, res: ServerResponse): void => {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }

    // C1: Wrap URL parsing in try-catch for malformed encodings
    let pathname: string;
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      // M1: Use url.pathname directly — new URL() already decodes, no double-decode
      pathname = url.pathname;
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request');
      return;
    }

    // M2: Reject null bytes (path traversal via null byte injection)
    if (pathname.includes('\0')) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request');
      return;
    }

    // Normalize and resolve the requested path
    const normalized = normalize(pathname);
    const filePath = join(resolvedDist, normalized);

    // Path traversal prevention
    if (!filePath.startsWith(resolvedDist)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    // C2: Stream-first approach — no TOCTOU race.
    // Attempt to stream the file directly; handle errors in events.
    streamFile(filePath, res, false, indexPath);
  };
}

/**
 * Attempt to stream a file. Uses fstat on the opened fd to verify it's a regular file
 * (not a directory) before writing headers — avoids TOCTOU and directory-open issues.
 *
 * On ENOENT → SPA fallback. On directory → SPA fallback.
 * On EACCES or other errors → 500.
 */
function streamFile(
  filePath: string,
  res: ServerResponse,
  isFallback: boolean,
  indexPath: string,
): void {
  const stream = createReadStream(filePath);

  stream.on('open', (fd: number) => {
    // Verify the fd points to a regular file, not a directory.
    // On Linux, open() succeeds on directories but read() fails with EISDIR.
    // By checking here, we avoid writing headers before discovering it's not a file.
    let isFile: boolean;
    try {
      isFile = fstatSync(fd).isFile();
    } catch {
      stream.destroy();
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end('Internal Server Error');
      return;
    }

    if (!isFile) {
      stream.destroy();
      if (!isFallback) {
        streamFile(indexPath, res, true, indexPath);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
      return;
    }

    const mime = getMimeType(filePath);
    const isIndex = filePath.endsWith('index.html');

    const headers: Record<string, string> = {
      'Content-Type': mime,
      // M3: Prevent MIME-sniffing attacks
      'X-Content-Type-Options': 'nosniff',
    };

    // Cache policy: no-cache for index.html/SPA fallback, immutable for hashed assets
    if (isIndex || isFallback) {
      headers['Cache-Control'] = 'no-cache';
    } else {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    res.writeHead(200, headers);
    stream.pipe(res);
  });

  stream.on('error', (err: NodeJS.ErrnoException) => {
    stream.destroy();

    if (err.code === 'ENOENT' || err.code === 'EISDIR') {
      // File not found or is a directory — SPA fallback
      if (!isFallback) {
        streamFile(indexPath, res, true, indexPath);
      } else {
        if (!res.headersSent) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
        }
        res.end('Not Found');
      }
      return;
    }

    // EACCES, ELOOP, or other errors → 500
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Internal Server Error');
  });
}
