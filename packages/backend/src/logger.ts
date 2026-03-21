/**
 * Pino logger factory for Deckgraph backend.
 *
 * Creates child loggers scoped to a module name.
 * Log level controlled via DECKGRAPH_LOG_LEVEL env var (default: 'info').
 */

import pino from 'pino';
import type { Logger } from 'pino';

const rootLogger = pino({
  name: 'deckgraph',
  level: process.env['DECKGRAPH_LOG_LEVEL'] ?? 'info',
});

/**
 * Create a child logger for a specific module.
 */
export function createLogger(module: string): Logger {
  return rootLogger.child({ module });
}

export type { Logger };
