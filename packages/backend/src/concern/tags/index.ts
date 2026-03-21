/**
 * Aggregated concern tag database.
 *
 * Keys are `${ecosystem}:${packageName}` to avoid cross-ecosystem collisions.
 * Values are arrays of concern tag strings.
 */

import type { Ecosystem } from '@deckgraph/shared';
import { npmTags } from './npmTags.js';
import { pypiTags } from './pypiTags.js';
import { cargoTags } from './cargoTags.js';
import { goTags } from './goTags.js';
import { mavenTags } from './mavenTags.js';

const PER_ECOSYSTEM: ReadonlyMap<Ecosystem, ReadonlyMap<string, readonly string[]>> = new Map([
  ['npm', npmTags],
  ['pypi', pypiTags],
  ['cargo', cargoTags],
  ['go', goTags],
  ['maven', mavenTags],
]);

function buildCombinedMap(): ReadonlyMap<string, readonly string[]> {
  const combined = new Map<string, readonly string[]>();
  for (const [ecosystem, tags] of PER_ECOSYSTEM) {
    for (const [pkg, concerns] of tags) {
      combined.set(`${ecosystem}:${pkg}`, concerns);
    }
  }
  return combined;
}

/**
 * Combined tag database keyed by `${ecosystem}:${packageName}`.
 */
export const CONCERN_TAG_DB: ReadonlyMap<string, readonly string[]> = buildCombinedMap();
