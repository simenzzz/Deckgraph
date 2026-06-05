/**
 * Maven Central registry client.
 *
 * Queries Maven Central search API for artifact metadata
 * (latest version, description).
 */

import type { RegistryMeta, RegistryQueryResult } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { createLogger } from '../../logger.js';

const logger = createLogger('maven-registry');

const MAVEN_SEARCH_URL = 'https://search.maven.org/solrsearch/select';

/**
 * Maven Central search API response (subset).
 */
interface MavenSearchResponse {
  readonly response?: {
    readonly numFound?: number;
    readonly docs?: readonly {
      readonly latestVersion?: string;
      readonly p?: string;
      readonly timestamp?: number;
    }[];
  };
}

/**
 * Parse a Maven coordinate string into group and artifact.
 * Supports: "group:artifact", "group.artifact" (heuristic).
 */
export function parseMavenCoordinate(
  packageName: string,
): { group: string; artifact: string } | null {
  // Explicit colon separator: "com.google.guava:guava"
  if (packageName.includes(':')) {
    const [group, artifact] = packageName.split(':');
    if (group && artifact) return { group, artifact };
    return null;
  }

  // Heuristic: last segment is artifact, rest is group
  // "com.google.guava" → group="com.google", artifact="guava"
  const lastDot = packageName.lastIndexOf('.');
  if (lastDot > 0) {
    return {
      group: packageName.slice(0, lastDot),
      artifact: packageName.slice(lastDot + 1),
    };
  }

  return null;
}

/**
 * Query Maven Central for artifact metadata.
 */
export async function queryMavenRegistry(
  packageName: string,
  cache: RegistryCache,
  rateLimiter: RegistryRateLimiter,
): Promise<RegistryQueryResult> {
  const cached = cache.get('maven', packageName);
  if (cached) return { status: 'found', meta: cached };

  const coord = parseMavenCoordinate(packageName);
  if (!coord) {
    logger.debug({ packageName }, 'Cannot parse Maven coordinate');
    return { status: 'not-found' };
  }

  await rateLimiter.acquire('maven');

  try {
    const query = `g:"${coord.group}"+AND+a:"${coord.artifact}"`;
    const url = `${MAVEN_SEARCH_URL}?q=${query}&rows=1&wt=json`;

    const response = await fetch(url);

    if (!response.ok) {
      logger.warn(
        { packageName, status: response.status },
        'Maven Central request failed',
      );
      return { status: 'error' };
    }

    const data = (await response.json()) as MavenSearchResponse;
    const docs = data.response?.docs;

    if (!docs || docs.length === 0) {
      logger.debug({ packageName }, 'No results from Maven Central');
      return { status: 'not-found' };
    }

    const doc = docs[0]!;

    if (!doc.latestVersion) {
      logger.warn({ packageName }, 'No latest version in Maven Central response');
      return { status: 'error' };
    }

    const publishedAt = doc.timestamp
      ? new Date(doc.timestamp).toISOString()
      : null;

    const meta: RegistryMeta = {
      latestVersion: doc.latestVersion,
      description: '', // Maven search API doesn't return descriptions
      license: null, // Not available in search results
      homepage: `https://search.maven.org/artifact/${coord.group}/${coord.artifact}`,
      downloads: null,
      deprecated: false, // Maven doesn't have a standard deprecation flag
      publishedAt,
    };

    cache.set('maven', packageName, meta);
    return { status: 'found', meta };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    logger.error({ packageName, error: detail }, 'Maven Central query failed');
    return { status: 'error' };
  }
}
