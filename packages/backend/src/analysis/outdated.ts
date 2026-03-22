/**
 * Re-export classifyOutdated from shared package.
 *
 * The function was moved to @deckgraph/shared so the UI can use it
 * for severity badge rendering without a backend round-trip.
 */

export { classifyOutdated } from '@deckgraph/shared';
export type { OutdatedSeverity } from '@deckgraph/shared';
