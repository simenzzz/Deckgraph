/**
 * Outdated dependency classification.
 *
 * Compares installed vs latest versions to determine how far behind
 * a dependency is. Uses the `semver` package for reliable parsing
 * and comparison across ecosystem-specific version formats.
 */

import semver from 'semver';
import type { OutdatedSeverity } from '../types/views.js';

/**
 * Classify how outdated a dependency is.
 *
 * @param installed - The installed/current version string
 * @param latest - The latest available version from the registry
 * @returns Classification of how far behind the installed version is
 */
export function classifyOutdated(installed: string, latest: string): OutdatedSeverity {
  // Try strict parse first, then coerce for non-semver versions
  // (PEP 440, Go `v` prefix, etc.)
  const installedSemver = semver.parse(installed) ?? semver.coerce(installed);
  const latestSemver = semver.parse(latest) ?? semver.coerce(latest);

  if (!installedSemver || !latestSemver) {
    // Cannot compare — treat as up-to-date to avoid false positives
    return 'up-to-date';
  }

  const cmp = semver.compare(installedSemver, latestSemver);

  if (cmp >= 0) {
    return 'up-to-date';
  }

  // installed < latest — determine how far behind
  if (installedSemver.major < latestSemver.major) {
    return 'major-behind';
  }

  if (installedSemver.minor < latestSemver.minor) {
    return 'minor-behind';
  }

  return 'patch-behind';
}
