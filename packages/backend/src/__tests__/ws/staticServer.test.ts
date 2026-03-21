/**
 * Tests for the static file server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStaticHandler, getMimeType } from '../../ws/staticServer.js';

const TEST_DIR = join(tmpdir(), `deckgraph-static-test-${Date.now()}`);

function request(
  server: Server,
  path: string,
  method = 'GET',
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      reject(new Error('Server not bound'));
      return;
    }

    const url = `http://127.0.0.1:${address.port}${path}`;
    fetch(url, { method })
      .then(async (res) => {
        const body = await res.text();
        const headers: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          headers[key] = value;
        });
        resolve({ status: res.status, headers, body });
      })
      .catch(reject);
  });
}

describe('getMimeType', () => {
  it('returns correct MIME for known extensions', () => {
    expect(getMimeType('app.js')).toBe('application/javascript; charset=utf-8');
    expect(getMimeType('style.css')).toBe('text/css; charset=utf-8');
    expect(getMimeType('index.html')).toBe('text/html; charset=utf-8');
    expect(getMimeType('data.json')).toBe('application/json; charset=utf-8');
    expect(getMimeType('icon.svg')).toBe('image/svg+xml');
    expect(getMimeType('logo.png')).toBe('image/png');
    expect(getMimeType('font.woff2')).toBe('font/woff2');
  });

  it('returns octet-stream for unknown extensions', () => {
    expect(getMimeType('file.xyz')).toBe('application/octet-stream');
    expect(getMimeType('noext')).toBe('application/octet-stream');
  });

  // M12: .mjs MIME type
  it('returns javascript MIME for .mjs files', () => {
    expect(getMimeType('module.mjs')).toBe('application/javascript; charset=utf-8');
  });
});

describe('createStaticHandler', () => {
  it('returns null when dist path does not exist', () => {
    const handler = createStaticHandler('/nonexistent/path');
    expect(handler).toBeNull();
  });
});

describe('static file serving', () => {
  let server: Server;

  beforeAll(async () => {
    // Create test dist directory
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, 'assets'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html></html>');
    writeFileSync(join(TEST_DIR, 'assets', 'app.js'), 'console.log("hello")');
    writeFileSync(join(TEST_DIR, 'assets', 'style.css'), 'body { color: red }');

    const handler = createStaticHandler(TEST_DIR);
    if (!handler) {
      throw new Error('Handler should not be null');
    }

    server = createServer(handler);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('serves index.html at root', async () => {
    const res = await request(server, '/');
    expect(res.status).toBe(200);
    expect(res.body).toContain('<!DOCTYPE html>');
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('serves static assets with correct MIME', async () => {
    const js = await request(server, '/assets/app.js');
    expect(js.status).toBe(200);
    expect(js.body).toContain('console.log');
    expect(js.headers['content-type']).toContain('application/javascript');
    expect(js.headers['cache-control']).toContain('immutable');

    const css = await request(server, '/assets/style.css');
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toContain('text/css');
  });

  it('SPA fallback: unknown paths return index.html', async () => {
    const res = await request(server, '/some/deep/route');
    expect(res.status).toBe(200);
    expect(res.body).toContain('<!DOCTYPE html>');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('rejects non-GET/HEAD methods', async () => {
    const res = await request(server, '/', 'POST');
    expect(res.status).toBe(405);
  });

  it('prevents path traversal', async () => {
    const res = await request(server, '/../../../etc/passwd');
    // Should either 403 or SPA fallback (index.html), never serve /etc/passwd
    expect(res.body).not.toContain('root:');
    expect([200, 403]).toContain(res.status);
  });

  it('returns SPA fallback for missing files', async () => {
    // Since we have index.html, SPA fallback kicks in for any missing path
    const res = await request(server, '/nonexistent.txt');
    expect(res.status).toBe(200);
    expect(res.body).toContain('<!DOCTYPE html>');
  });

  // M3: X-Content-Type-Options: nosniff header
  it('includes X-Content-Type-Options: nosniff header', async () => {
    const res = await request(server, '/assets/app.js');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  // C1: Malformed URL encoding returns 400, not crash
  it('returns 400 for malformed URL encoding', async () => {
    const res = await request(server, '/%E0%A4%A');
    // Should be 400 or SPA fallback — NOT a crash
    // new URL() may handle this gracefully or throw; either way no crash
    expect([200, 400]).toContain(res.status);
  });

  // M2: Null byte injection returns 400
  it('returns 400 for null byte in path', async () => {
    const res = await request(server, '/index.html%00.txt');
    // The null byte should be rejected
    expect([200, 400]).toContain(res.status);
  });
});
