/**
 * Centralized error catalog for consistent error messaging.
 *
 * Every error surfaced to the UI uses a catalog entry with a
 * user-friendly message and actionable suggestion.
 */

import type { ErrorMessage } from '@deckgraph/shared';

/**
 * A single error entry in the catalog.
 */
export interface ErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly suggestion: string;
}

/**
 * All known error conditions. Codes are unique uppercase strings.
 * Messages and suggestions are plain-language — never expose stack traces
 * or internal error codes to the UI.
 */
export const ErrorCatalog = {
  INVALID_JSON: {
    code: 'INVALID_JSON',
    message: 'Invalid JSON received',
    suggestion: 'Ensure the message is valid JSON',
  },
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    message: 'Message validation failed',
    suggestion: 'Check the message format and type',
  },
  SCAN_ALREADY_RUNNING: {
    code: 'SCAN_ALREADY_RUNNING',
    message: 'A scan is already in progress',
    suggestion: 'Wait for the current scan to complete before starting another',
  },
  NO_SCAN_DATA: {
    code: 'NO_SCAN_DATA',
    message: 'No scan data available',
    suggestion: 'Run a scan_project request first',
  },
  MODULE_NOT_FOUND: {
    code: 'MODULE_NOT_FOUND',
    message: 'Module not found',
    suggestion: 'Check the module path and ensure a scan has been completed',
  },
  MODULE_ALREADY_ANALYZED: {
    code: 'MODULE_ALREADY_ANALYZED',
    message: 'Module already analyzed',
    suggestion: 'Import analysis has already been run for this module',
  },
  INVALID_PACKAGE_NAME: {
    code: 'INVALID_PACKAGE_NAME',
    message: 'Invalid package name',
    suggestion:
      'Package names may only contain alphanumeric characters, dots, hyphens, underscores, slashes, @, and colons',
  },
  NO_ADAPTER: {
    code: 'NO_ADAPTER',
    message: 'No adapter registered for ecosystem',
    suggestion: 'Supported ecosystems: npm, pypi, go, cargo, maven',
  },
  PACKAGE_NOT_FOUND: {
    code: 'PACKAGE_NOT_FOUND',
    message: 'Package not found',
    suggestion: 'Check the package name and ensure it exists on the registry',
  },
  DEPENDENCY_NOT_IN_PROJECT: {
    code: 'DEPENDENCY_NOT_IN_PROJECT',
    message: 'Dependency not found in any scanned module',
    suggestion: 'Ensure the package is a declared dependency in the project',
  },
  NO_WORKSPACE_CONFIG: {
    code: 'NO_WORKSPACE_CONFIG',
    message: 'No workspace configuration found',
    suggestion: 'Add a "roots" field to .deckgraph.yaml to enable workspace mode',
  },
  OPERATION_IN_PROGRESS: {
    code: 'OPERATION_IN_PROGRESS',
    message: 'A package operation is already in progress',
    suggestion: 'Wait for the current operation to complete',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred while processing your request',
    suggestion: 'Try again or check server logs for details',
  },
  REGISTRY_UNREACHABLE: {
    code: 'REGISTRY_UNREACHABLE',
    message: 'Could not reach the package registry',
    suggestion: 'Check your network connection and try again',
  },
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    message: 'A required file was not found',
    suggestion: 'Verify the file path and ensure the project structure is intact',
  },
  PERMISSION_DENIED: {
    code: 'PERMISSION_DENIED',
    message: 'Permission denied',
    suggestion:
      'Check file permissions and ensure Deckgraph has access to the project directory',
  },
  INVALID_CONFIG: {
    code: 'INVALID_CONFIG',
    message: 'Invalid configuration file',
    suggestion: 'Check .deckgraph.yaml for syntax errors or invalid fields',
  },
  PACKAGE_MANAGER_FAIL: {
    code: 'PACKAGE_MANAGER_FAIL',
    message: 'Package manager command failed',
    suggestion: 'Check the package manager output and try again manually',
  },
} as const satisfies Record<string, ErrorEntry>;

/**
 * Create an ErrorMessage from a catalog entry.
 *
 * @param entry - Catalog entry to use
 * @param requestId - Request ID for the error response
 * @param context - Optional dynamic context appended to the message (e.g. module path)
 */
export function createCatalogError(
  entry: ErrorEntry,
  requestId: string,
  context?: string,
): ErrorMessage {
  return {
    type: 'error',
    requestId,
    message: context ? `${entry.message}: ${context}` : entry.message,
    suggestion: entry.suggestion,
  };
}
