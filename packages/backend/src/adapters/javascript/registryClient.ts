/**
 * npm registry client.
 *
 * Queries the npm registry abbreviated metadata endpoint
 * to fetch package metadata (latest version, license, deprecation).
 */

import type { RegistryMeta } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { createLogger } from '../../logger.js';

const logger = createLogger('npm-registry');

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';

/**
 * npm abbreviated metadata response (subset of fields we care about).
 */
interface NpmAbbreviatedMeta {
  readonly name?: string;
  readonly 'dist-tags'?: Readonly<Record<string, string>>;
  readonly description?: string;
  readonly license?: string;
  readonly homepage?: string;
  readonly deprecated?: string;
  readonly time?: Readonly<Record<string, string>>;
}

/**
 * Query the npm registry for package metadata.
 *
 * @param packageName - npm package name (e.g. "express", "@babel/core")
 * @param cache - Registry metadata cache
 * @param rateLimiter - Rate limiter for npm requests
 * @returns Registry metadata, or null if not found
 */
export async function queryNpmRegistry(
  packageName: string,
  cache: RegistryCache,
  rateLimiter: RegistryRateLimiter,
): Promise<RegistryMeta | null> {
  const cached = cache.get('npm', packageName);
  if (cached) return cached;

  await rateLimiter.acquire('npm');

  try {
    const encodedName = encodeURIComponent(packageName).replace('%40', '@');
    const url = `${NPM_REGISTRY_URL}/${encodedName}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.npm.install-v1+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.debug({ packageName }, 'Package not found on npm');
        return null;
      }
      logger.warn(
        { packageName, status: response.status },
        'npm registry request failed',
      );
      return null;
    }

    const data = (await response.json()) as NpmAbbreviatedMeta;
    const latestVersion = data['dist-tags']?.latest;

    if (!latestVersion) {
      logger.warn({ packageName }, 'No latest version found');
      return null;
    }

    const latestTime = data.time?.[latestVersion] ?? null;

    const meta: RegistryMeta = {
      latestVersion,
      description: data.description ?? '',
      license: data.license ?? null,
      homepage: data.homepage ?? null,
      downloads: null, // npm abbreviated metadata doesn't include downloads
      deprecated: typeof data.deprecated === 'string',
      publishedAt: latestTime,
    };

    cache.set('npm', packageName, meta);
    return meta;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    logger.error({ packageName, error: detail }, 'npm registry query failed');
    return null;
  }
}
