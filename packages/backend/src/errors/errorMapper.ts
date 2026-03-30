/**
 * Maps runtime errors to catalog entries.
 *
 * Translates Node.js error codes, Zod validation errors, and
 * config errors into user-friendly catalog entries.
 */

import { ZodError } from 'zod';
import { DeckgraphConfigError } from '../config/configLoader.js';
import { ErrorCatalog, type ErrorEntry } from './errorCatalog.js';

/**
 * Check if an error is a Node.js system error with a `code` property.
 */
function isNodeError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as Error & { code: unknown }).code === 'string'
  );
}

/**
 * Map a caught error to the best-matching catalog entry.
 *
 * Mapping rules:
 * - ENOENT → FILE_NOT_FOUND
 * - EACCES / EPERM → PERMISSION_DENIED
 * - ECONNREFUSED → REGISTRY_UNREACHABLE
 * - ZodError → INVALID_CONFIG
 * - DeckgraphConfigError → INVALID_CONFIG
 * - fallback → INTERNAL_ERROR
 */
export function mapError(error: unknown): ErrorEntry {
  if (isNodeError(error)) {
    switch (error.code) {
      case 'ENOENT':
        return ErrorCatalog.FILE_NOT_FOUND;
      case 'EACCES':
      case 'EPERM':
        return ErrorCatalog.PERMISSION_DENIED;
      case 'ECONNREFUSED':
        return ErrorCatalog.REGISTRY_UNREACHABLE;
    }
  }

  if (error instanceof ZodError) {
    return ErrorCatalog.INVALID_CONFIG;
  }

  if (error instanceof DeckgraphConfigError) {
    return ErrorCatalog.INVALID_CONFIG;
  }

  return ErrorCatalog.INTERNAL_ERROR;
}
