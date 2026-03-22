/**
 * PyPI registry client.
 *
 * Queries the PyPI JSON API to fetch package metadata
 * (latest version, license, deprecation).
 */

import type { RegistryMeta } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { createLogger } from '../../logger.js';

const logger = createLogger('pypi-registry');

const PYPI_API_URL = 'https://pypi.org/pypi';

/**
 * PyPI JSON API response (subset of fields we care about).
 */
interface PypiResponse {
  readonly info?: {
    readonly version?: string;
    readonly summary?: string;
    readonly license?: string;
    readonly home_page?: string;
    readonly project_urls?: Readonly<Record<string, string>>;
    readonly classifiers?: readonly string[];
  };
  readonly urls?: readonly {
    readonly upload_time_iso_8601?: string;
  }[];
}

/**
 * Query the PyPI registry for package metadata.
 */
export async function queryPypiRegistry(
  packageName: string,
  cache: RegistryCache,
  rateLimiter: RegistryRateLimiter,
): Promise<RegistryMeta | null> {
  const cached = cache.get('pypi', packageName);
  if (cached) return cached;

  await rateLimiter.acquire('pypi');

  try {
    const url = `${PYPI_API_URL}/${encodeURIComponent(packageName)}/json`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        logger.debug({ packageName }, 'Package not found on PyPI');
        return null;
      }
      logger.warn(
        { packageName, status: response.status },
        'PyPI registry request failed',
      );
      return null;
    }

    const data = (await response.json()) as PypiResponse;
    const info = data.info;

    if (!info?.version) {
      logger.warn({ packageName }, 'No version found in PyPI response');
      return null;
    }

    const homepage =
      info.home_page || info.project_urls?.['Homepage'] || info.project_urls?.['Source'] || null;

    const deprecated = info.classifiers?.some((c) =>
      c.startsWith('Development Status :: 7'),
    ) ?? false;

    // Get the publish date from the latest upload
    const publishedAt = data.urls?.[0]?.upload_time_iso_8601 ?? null;

    const meta: RegistryMeta = {
      latestVersion: info.version,
      description: info.summary ?? '',
      license: info.license ?? null,
      homepage,
      downloads: null, // PyPI JSON doesn't include download counts
      deprecated,
      publishedAt,
    };

    cache.set('pypi', packageName, meta);
    return meta;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    logger.error({ packageName, error: detail }, 'PyPI registry query failed');
    return null;
  }
}
