/**
 * Go module proxy registry client.
 *
 * Queries the Go module proxy to fetch latest version metadata.
 */

import type { RegistryMeta, RegistryQueryResult } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { createLogger } from '../../logger.js';

const logger = createLogger('go-registry');

const GO_PROXY_URL = 'https://proxy.golang.org';

/**
 * Go proxy @latest response.
 */
interface GoLatestResponse {
  readonly Version?: string;
  readonly Time?: string;
}

/**
 * Query the Go module proxy for package metadata.
 */
export async function queryGoRegistry(
  modulePath: string,
  cache: RegistryCache,
  rateLimiter: RegistryRateLimiter,
): Promise<RegistryQueryResult> {
  const cached = cache.get('go', modulePath);
  if (cached) return { status: 'found', meta: cached };

  await rateLimiter.acquire('go');

  try {
    // Go module paths use case-insensitive encoding (uppercase → !lowercase)
    const encodedPath = modulePath.replace(/[A-Z]/g, (c) => `!${c.toLowerCase()}`);
    const url = `${GO_PROXY_URL}/${encodedPath}/@latest`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        logger.debug({ modulePath }, 'Module not found on Go proxy');
        return { status: 'not-found' };
      }
      logger.warn(
        { modulePath, status: response.status },
        'Go proxy request failed',
      );
      return { status: 'error' };
    }

    const data = (await response.json()) as GoLatestResponse;

    if (!data.Version) {
      logger.warn({ modulePath }, 'No version found in Go proxy response');
      return { status: 'error' };
    }

    const meta: RegistryMeta = {
      latestVersion: data.Version,
      description: '', // Go proxy doesn't provide descriptions
      license: null, // Go proxy doesn't provide license info
      homepage: `https://pkg.go.dev/${modulePath}`,
      downloads: null,
      deprecated: false, // Go proxy doesn't expose deprecation
      publishedAt: data.Time ?? null,
    };

    cache.set('go', modulePath, meta);
    return { status: 'found', meta };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    logger.error({ modulePath, error: detail }, 'Go proxy query failed');
    return { status: 'error' };
  }
}
