/**
 * crates.io registry client.
 *
 * Queries the crates.io API to fetch crate metadata.
 * Note: crates.io requires a User-Agent header and has strict rate limits (1 req/s).
 */

import type { RegistryMeta } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { createLogger } from '../../logger.js';

const logger = createLogger('cargo-registry');

const CRATES_IO_URL = 'https://crates.io/api/v1';

/**
 * crates.io API response (subset).
 */
interface CratesIoResponse {
  readonly crate?: {
    readonly newest_version?: string;
    readonly description?: string;
    readonly homepage?: string;
    readonly repository?: string;
    readonly downloads?: number;
    readonly updated_at?: string;
    readonly max_stable_version?: string;
  };
  readonly versions?: readonly {
    readonly num?: string;
    readonly license?: string;
    readonly created_at?: string;
    readonly yanked?: boolean;
  }[];
}

/**
 * Query the crates.io API for crate metadata.
 */
export async function queryCargoRegistry(
  crateName: string,
  cache: RegistryCache,
  rateLimiter: RegistryRateLimiter,
): Promise<RegistryMeta | null> {
  const cached = cache.get('cargo', crateName);
  if (cached) return cached;

  await rateLimiter.acquire('cargo');

  try {
    const url = `${CRATES_IO_URL}/crates/${encodeURIComponent(crateName)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'deckgraph (https://github.com/deckgraph/deckgraph)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.debug({ crateName }, 'Crate not found on crates.io');
        return null;
      }
      logger.warn(
        { crateName, status: response.status },
        'crates.io request failed',
      );
      return null;
    }

    const data = (await response.json()) as CratesIoResponse;
    const crateData = data.crate;

    if (!crateData) {
      logger.warn({ crateName }, 'No crate data in crates.io response');
      return null;
    }

    const latestVersion = crateData.max_stable_version ?? crateData.newest_version;
    if (!latestVersion) {
      logger.warn({ crateName }, 'No version found in crates.io response');
      return null;
    }

    // Find the latest version's license
    const latestVersionData = data.versions?.find((v) => v.num === latestVersion);

    const meta: RegistryMeta = {
      latestVersion,
      description: crateData.description ?? '',
      license: latestVersionData?.license ?? null,
      homepage: crateData.homepage ?? crateData.repository ?? null,
      downloads: crateData.downloads ?? null,
      deprecated: false, // crates.io uses yanking, not deprecation
      publishedAt: latestVersionData?.created_at ?? crateData.updated_at ?? null,
    };

    cache.set('cargo', crateName, meta);
    return meta;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    logger.error({ crateName, error: detail }, 'crates.io query failed');
    return null;
  }
}
