// Log level controlled via DECKGRAPH_LOG_LEVEL (default: 'info')
import pino from 'pino';
import type { Logger } from 'pino';

const rootLogger = pino({
  name: 'deckgraph',
  level: process.env['DECKGRAPH_LOG_LEVEL'] ?? 'info',
});

export function createLogger(module: string): Logger {
  return rootLogger.child({ module });
}

export type { Logger };
