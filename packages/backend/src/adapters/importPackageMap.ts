/**
 * Import-to-package name resolution.
 *
 * Resolves import source strings to their declared package names
 * when they differ. Most npm imports map 1:1, but some ecosystems
 * have significant mismatches (e.g. Python: `PIL` → `Pillow`).
 *
 * Phase 2a: npm + initial pypi/go/cargo/maven mappings.
 * Phase 2b: Expanded mappings for all ecosystems.
 */

import type { Ecosystem, ImportPackageMap } from '@deckgraph/shared';

/**
 * Known import→package mismatches for Python (pypi).
 * The import name differs from the pip package name.
 */
const PYPI_MISMATCHES: ReadonlyMap<string, string> = new Map([
  ['PIL', 'Pillow'],
  ['cv2', 'opencv-python'],
  ['yaml', 'PyYAML'],
  ['bs4', 'beautifulsoup4'],
  ['attr', 'attrs'],
  ['dateutil', 'python-dateutil'],
  ['dotenv', 'python-dotenv'],
  ['gi', 'PyGObject'],
  ['google.protobuf', 'protobuf'],
  ['jwt', 'PyJWT'],
  ['lxml', 'lxml'],
  ['magic', 'python-magic'],
  ['mpl_toolkits', 'matplotlib'],
  ['MySQLdb', 'mysqlclient'],
  ['nacl', 'PyNaCl'],
  ['OpenSSL', 'pyOpenSSL'],
  ['pkg_resources', 'setuptools'],
  ['serial', 'pyserial'],
  ['skimage', 'scikit-image'],
  ['sklearn', 'scikit-learn'],
  ['usb', 'pyusb'],
  ['wx', 'wxPython'],
  ['Xlib', 'python-xlib'],
  ['zmq', 'pyzmq'],
  ['Bio', 'biopython'],
]);

/**
 * Known import→package mismatches for Rust (cargo).
 * Rust crate names use hyphens, but import names use underscores.
 */
const CARGO_MISMATCHES: ReadonlyMap<string, string> = new Map([
  ['serde_json', 'serde-json'],
  ['serde_yaml', 'serde-yaml'],
  ['serde_derive', 'serde-derive'],
  ['tokio_stream', 'tokio-stream'],
  ['tokio_util', 'tokio-util'],
  ['async_trait', 'async-trait'],
  ['proc_macro2', 'proc-macro2'],
]);

/**
 * Build the internal lookup key for the mismatch map.
 */
function mapKey(ecosystem: Ecosystem, importSource: string): string {
  return `${ecosystem}:${importSource}`;
}

/**
 * Build a combined mismatch map keyed by "ecosystem:importSource".
 */
function buildMismatchMap(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();

  for (const [importName, packageName] of PYPI_MISMATCHES) {
    map.set(mapKey('pypi', importName), packageName);
  }

  for (const [importName, packageName] of CARGO_MISMATCHES) {
    map.set(mapKey('cargo', importName), packageName);
  }

  return map;
}

/**
 * Extract the npm package name from an import source.
 *
 * - `@scope/name/deep/path` → `@scope/name`
 * - `lodash/get` → `lodash`
 * - `react` → `react`
 */
export function extractNpmPackageName(importSource: string): string {
  if (importSource.startsWith('@')) {
    // Scoped package: @scope/name/sub → @scope/name
    const parts = importSource.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return importSource;
  }

  // Non-scoped: lodash/get → lodash
  const slashIndex = importSource.indexOf('/');
  if (slashIndex > 0) {
    return importSource.substring(0, slashIndex);
  }

  return importSource;
}

/**
 * Extract the top-level Go module path from an import path.
 * Go imports are full module paths like `github.com/gin-gonic/gin/context`.
 * The package is typically the first 3 segments for github.com paths.
 */
export function extractGoModulePath(importSource: string): string {
  const parts = importSource.split('/');
  // Standard github/gitlab/etc paths: github.com/owner/repo
  if (parts.length >= 3 && parts[0]!.includes('.')) {
    return parts.slice(0, 3).join('/');
  }
  return importSource;
}

/**
 * Create an ImportPackageMap instance.
 *
 * Resolution order:
 * 1. Ecosystem-specific known mismatches (curated DB)
 * 2. Ecosystem-specific extraction rules (npm scoping, Rust underscore→hyphen)
 * 3. null if no mapping needed (1:1 match assumed)
 */
export function createImportPackageMap(): ImportPackageMap {
  const mismatches = buildMismatchMap();

  return {
    resolvePackageName(
      importSource: string,
      ecosystem: Ecosystem,
    ): string | null {
      // 1. Check curated mismatch database
      const key = mapKey(ecosystem, importSource);
      const knownMapping = mismatches.get(key);
      if (knownMapping) {
        return knownMapping;
      }

      // 2. Ecosystem-specific extraction rules
      switch (ecosystem) {
        case 'npm': {
          const extracted = extractNpmPackageName(importSource);
          // Only return if different from input (deep import resolution)
          return extracted !== importSource ? extracted : null;
        }

        case 'cargo': {
          // Rust: underscores in import map to hyphens in crate names
          if (importSource.includes('_')) {
            return importSource.replace(/_/g, '-');
          }
          return null;
        }

        case 'go': {
          const extracted = extractGoModulePath(importSource);
          return extracted !== importSource ? extracted : null;
        }

        case 'pypi': {
          // Python: check if top-level module name differs
          const topLevel = importSource.split('.')[0]!;
          const topKey = mapKey('pypi', topLevel);
          return mismatches.get(topKey) ?? null;
        }

        case 'maven':
          // Java: no common mismatches yet
          return null;

        default:
          return null;
      }
    },
  };
}
