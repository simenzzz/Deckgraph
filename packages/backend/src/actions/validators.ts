/**
 * Pre-flight validation for package management actions.
 *
 * Validates that the target package exists in the module's deps
 * and that version strings are reasonable.
 */

import type { Ecosystem, Module } from '@deckgraph/shared';

export interface ValidationResult {
  readonly valid: boolean;
  readonly error: string | null;
  readonly suggestion: string | null;
}

const OK: ValidationResult = { valid: true, error: null, suggestion: null };

function fail(error: string, suggestion: string): ValidationResult {
  return { valid: false, error, suggestion };
}

/**
 * Validate a version string is not obviously malformed.
 * Not ecosystem-specific — just checks for basic format.
 */
export function isReasonableVersion(version: string): boolean {
  // Must be non-empty, max 128 chars, and only contain version-safe characters
  if (version.length === 0 || version.length > 128) return false;
  // Allow only: alphanumeric, dots, hyphens, plus, tildes, carets, equals, stars, underscores
  if (!/^[a-zA-Z0-9.\-+~^=*_]+$/.test(version)) return false;
  return true;
}

/**
 * Validate a package name contains only safe characters.
 * Allows ecosystem-specific formats (npm scoped @scope/pkg, maven group:artifact, etc.)
 */
export function isReasonablePackageName(name: string): boolean {
  if (name.length === 0 || name.length > 256) return false;
  // Allow: alphanumeric, dots, hyphens, underscores, slashes, @, colons (maven)
  if (!/^[@a-zA-Z0-9.\-_/:]+$/.test(name)) return false;
  return true;
}

/**
 * Validate an update request.
 */
export function validateUpdateRequest(
  module: Module,
  packageName: string,
  targetVersion: string,
): ValidationResult {
  if (!isReasonablePackageName(packageName)) {
    return fail(
      `Invalid package name: "${packageName}"`,
      'Package names may only contain alphanumeric characters, dots, hyphens, underscores, slashes, @, and colons',
    );
  }

  if (!isReasonableVersion(targetVersion)) {
    return fail(
      `Invalid version format: "${targetVersion}"`,
      'Provide a valid version string (e.g., "1.2.3")',
    );
  }

  const dep = module.dependencies.find((d) => d.name === packageName);
  if (!dep) {
    return fail(
      `Package "${packageName}" not found in module "${module.name}"`,
      'Check the package name and ensure a scan has been completed',
    );
  }

  if (dep.version === targetVersion) {
    return fail(
      `Package "${packageName}" is already at version ${targetVersion}`,
      'Choose a different target version',
    );
  }

  return OK;
}

/**
 * Validate an install request.
 */
export function validateInstallRequest(
  module: Module,
  packageName: string,
  version: string | null,
): ValidationResult {
  if (!isReasonablePackageName(packageName)) {
    return fail(
      `Invalid package name: "${packageName}"`,
      'Package names may only contain alphanumeric characters, dots, hyphens, underscores, slashes, @, and colons',
    );
  }

  if (version !== null && !isReasonableVersion(version)) {
    return fail(
      `Invalid version format: "${version}"`,
      'Provide a valid version string or null for latest',
    );
  }

  const existing = module.dependencies.find((d) => d.name === packageName);
  if (existing) {
    return fail(
      `Package "${packageName}" is already installed in module "${module.name}" (version ${existing.version})`,
      'Use update instead, or remove it first',
    );
  }

  return OK;
}

/**
 * Validate a remove request.
 */
export function validateRemoveRequest(
  module: Module,
  packageName: string,
): ValidationResult {
  if (!isReasonablePackageName(packageName)) {
    return fail(
      `Invalid package name: "${packageName}"`,
      'Package names may only contain alphanumeric characters, dots, hyphens, underscores, slashes, @, and colons',
    );
  }

  const dep = module.dependencies.find((d) => d.name === packageName);
  if (!dep) {
    return fail(
      `Package "${packageName}" not found in module "${module.name}"`,
      'Check the package name and ensure a scan has been completed',
    );
  }

  return OK;
}

/**
 * Validate that an ecosystem has an executor registered.
 */
export function validateEcosystem(
  ecosystem: Ecosystem,
  supportedEcosystems: ReadonlySet<Ecosystem>,
): ValidationResult {
  if (!supportedEcosystems.has(ecosystem)) {
    return fail(
      `Package management not supported for ecosystem: ${ecosystem}`,
      `Supported ecosystems: ${[...supportedEcosystems].join(', ')}`,
    );
  }

  return OK;
}
