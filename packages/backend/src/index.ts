#!/usr/bin/env node
/**
 * Deckgraph CLI entry point.
 *
 * Usage:
 *   npx deckgraph --project <path>            # Start WS server and scan project
 *   npx deckgraph --project <path> --port 4000 # Custom port
 *   npx deckgraph --project <path> --no-open   # Skip opening browser
 *   npx deckgraph --version                    # Print version
 */

import { readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { createServer } from './ws/index.js';
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
    .requiredOption('--project <path>', 'Path to the project root')
    .option('--port <number>', 'WebSocket server port', '3333')
    .option('--no-open', 'Skip opening browser');

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
    project: string;
    port: string;
    open: boolean;
  }>();

  const projectRoot = resolve(opts.project);
  const port = parseInt(opts.port, 10);

  if (isNaN(port) || port < 0 || port > 65535) {
    process.stderr.write(`Error: Invalid port number "${opts.port}"\n`);
    process.exit(1);
  }

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

  const server = createServer({ port, projectRoot });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await server.start();

  process.stdout.write(`Server listening on ws://127.0.0.1:${port}\n`);

  if (opts.open) {
    try {
      const open = await import('open');
      await open.default(`http://127.0.0.1:${port}`);
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
