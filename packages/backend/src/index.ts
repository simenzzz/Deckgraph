#!/usr/bin/env node
/**
 * Deckgraph CLI entry point.
 *
 * Usage:
 *   npx deckgraph --project <path>            # Start WS server and scan project
 *   npx deckgraph --project <path> --port 4000 # Custom port
 *   npx deckgraph --project <path> --no-open   # Skip opening browser
 *   npx deckgraph --project <path> --no-watch  # Disable file watching
 *   npx deckgraph --version                    # Print version
 */

import { readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { createServer } from './ws/index.js';
import { parseDemoRepositories } from './ws/demoRepository.js';
import { createLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('cli');

/**
 * Read the package version from package.json.
 * Throws if the version cannot be read.
 */
export function getVersion(): string {
  const packageJsonPath = join(__dirname, '../package.json');
  const raw = readFileSync(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(raw) as { version?: string };
  if (typeof pkg.version !== 'string') {
    throw new Error('Missing version field in package.json');
  }
  return pkg.version;
}

/**
 * Create the commander program for CLI arg parsing.
 * Exported for testing.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('deckgraph')
    .description('Multi-language dependency exploration and audit tool')
    .version(getVersion())
    .option('--project <path>', 'Path to the project root')
    .option('--port <number>', 'WebSocket server port', '3333')
    .option('--host <host>', 'Host to bind to', '127.0.0.1')
    .option('--demo', 'Run hosted demo mode with curated GitHub repositories')
    .option('--no-open', 'Skip opening browser')
    .option('--no-watch', 'Disable file watching')
    .addHelpText('after', `

Examples:
  $ deckgraph --project ./my-monorepo          Scan and open in browser
  $ deckgraph --project ./my-monorepo --no-open  Scan without opening browser
  $ deckgraph --project ./my-monorepo --port 8080  Use custom port
  $ deckgraph --project ./my-monorepo --no-watch   Disable file watching

Documentation: https://github.com/deckgraph/deckgraph
Configuration:  See .deckgraph.yaml in your project root
`);

  return program;
}

/**
 * Main CLI entry point.
 * Parses args, validates project path, starts WS server.
 */
export async function main(argv?: readonly string[]): Promise<void> {
  const program = createProgram();
  program.parse(argv as string[] | undefined);

  const opts = program.opts<{
    project?: string;
    port: string;
    host: string;
    demo?: boolean;
    open: boolean;
    watch: boolean;
  }>();

  const demoMode = opts.demo === true;
  const projectRoot = resolve(opts.project ?? process.cwd());
  const port = parseInt(opts.port, 10);

  if (isNaN(port) || port < 0 || port > 65535) {
    process.stderr.write(`Error: Invalid port number "${opts.port}"\n`);
    process.exit(1);
  }

  if (!demoMode && !opts.project) {
    process.stderr.write('Error: --project <path> is required unless --demo is used\n');
    process.exit(1);
  }

  if (!demoMode) {
    try {
      const stats = await stat(projectRoot);
      if (!stats.isDirectory()) {
        process.stderr.write(`Error: "${projectRoot}" is not a directory\n`);
        process.exit(1);
      }
    } catch {
      process.stderr.write(`Error: "${projectRoot}" does not exist\n`);
      process.exit(1);
    }
  }

  const uiDistPath = resolve(__dirname, '../../ui/dist');
  const server = createServer({
    port,
    host: opts.host,
    projectRoot,
    uiDistPath,
    noWatch: !opts.watch || demoMode,
    demoMode,
    demoRepositories: demoMode ? parseDemoRepositories(process.env.DECKGRAPH_DEMO_REPOS) : [],
    demoCacheDir: process.env.DECKGRAPH_DEMO_CACHE_DIR ?? '/tmp/deckgraph-demo-cache',
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await server.start();

  process.stdout.write(`Server listening on http://${opts.host}:${port}\n`);

  if (opts.open) {
    try {
      const open = await import('open');
      await open.default(`http://${opts.host}:${port}`);
    } catch {
      logger.debug('Could not open browser automatically');
    }
  }
}

// Run CLI when executed directly
if (process.argv[1] === __filename) {
  main().catch((error) => {
    const detail = error instanceof Error ? error.message : 'unknown error';
    process.stderr.write(`Error: ${detail}\n`);
    process.exit(1);
  });
}
