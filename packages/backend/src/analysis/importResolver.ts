/**
 * Import resolver: orchestrates import analysis for a module.
 *
 * Walks source files, calls the ecosystem adapter's analyzeImports,
 * resolves import names to package names, and produces an updated
 * Module with usage data populated.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fg from 'fast-glob';
import type {
  AdapterRegistry,
  Dependency,
  EcosystemAdapter,
  ImportPackageMap,
  Module,
  ParsedImport,
} from '@deckgraph/shared';
import { createLogger } from '../logger.js';

const logger = createLogger('import-resolver');

/**
 * Result of import analysis for a single module.
 */
export interface ImportAnalysisResult {
  /** Updated module with usedInFiles populated and analysisState = 'imports-resolved' */
  readonly updatedModule: Module;
  /** Dependencies declared in manifest but not found in any source file */
  readonly unusedDeps: readonly string[];
  /** Packages imported in source but not declared in manifest */
  readonly importOnlyDeps: readonly string[];
}

/**
 * Analyze imports for a module and return an updated copy.
 *
 * Flow:
 * 1. Find all source files matching the adapter's extensions
 * 2. Parse each file with the adapter's analyzeImports
 * 3. Resolve import sources to package names via ImportPackageMap
 * 4. Build a usage map: packageName → filePaths[]
 * 5. Update each dependency's usedInFiles
 * 6. Detect unused and import-only dependencies
 *
 * @param projectRoot - Absolute path to the project root
 * @param module - The module to analyze (must be manifest-only state)
 * @param registry - AdapterRegistry to find the correct adapter
 * @param packageMap - ImportPackageMap for resolving import→package names
 * @returns ImportAnalysisResult with updated module and diagnostics
 */
export async function resolveImports(
  projectRoot: string,
  module: Module,
  registry: AdapterRegistry,
  packageMap: ImportPackageMap,
): Promise<ImportAnalysisResult> {
  const adapter = registry.getAdapterForEcosystem(module.ecosystem);
  if (!adapter) {
    throw new Error(`No adapter registered for ecosystem '${module.ecosystem}'`);
  }

  const moduleDir = join(projectRoot, module.path);
  const sourceFiles = await findSourceFiles(moduleDir, adapter);

  logger.info(
    { modulePath: module.path, fileCount: sourceFiles.length },
    'Analyzing imports',
  );

  // Collect all third-party imports across all source files
  const usageMap = new Map<string, Set<string>>();

  for (const filePath of sourceFiles) {
    const imports = await analyzeFile(filePath, adapter);
    const relativePath = filePath.substring(projectRoot.length + 1);

    for (const imp of imports) {
      if (!imp.isThirdParty) continue;

      const packageName = resolvePackageName(
        imp.source,
        module.ecosystem,
        packageMap,
      );

      const existing = usageMap.get(packageName);
      if (existing) {
        existing.add(relativePath);
      } else {
        usageMap.set(packageName, new Set([relativePath]));
      }
    }
  }

  // Build the set of declared dependency names
  const declaredNames = new Set(module.dependencies.map((d) => d.name));

  // Identify unused deps (declared but not imported)
  const unusedDeps: string[] = [];
  for (const name of declaredNames) {
    if (!usageMap.has(name)) {
      unusedDeps.push(name);
    }
  }

  // Identify import-only deps (imported but not declared)
  const importOnlyDeps: string[] = [];
  for (const name of usageMap.keys()) {
    if (!declaredNames.has(name)) {
      importOnlyDeps.push(name);
    }
  }

  // Update dependencies with usage info (immutably)
  const updatedDeps: readonly Dependency[] = module.dependencies.map((dep) => {
    const files = usageMap.get(dep.name);
    return {
      ...dep,
      usedInFiles: files ? [...files].sort() : [],
      source: files ? 'both' as const : dep.source,
    };
  });

  // Add import-only dependencies
  const importOnlyEntries: readonly Dependency[] = importOnlyDeps.map(
    (name) => ({
      name,
      ecosystem: module.ecosystem,
      version: 'unknown',
      constraint: '',
      scope: 'runtime' as const,
      source: 'import-only' as const,
      concerns: [],
      usedInFiles: [...(usageMap.get(name) ?? [])].sort(),
      transitiveDeps: null,
      registryMeta: null,
    }),
  );

  const updatedModule: Module = {
    ...module,
    dependencies: [...updatedDeps, ...importOnlyEntries],
    analysisState: 'imports-resolved',
  };

  logger.info(
    {
      modulePath: module.path,
      totalDeps: updatedModule.dependencies.length,
      unused: unusedDeps.length,
      importOnly: importOnlyDeps.length,
    },
    'Import analysis complete',
  );

  return {
    updatedModule,
    unusedDeps,
    importOnlyDeps,
  };
}

/**
 * Find all source files in a module directory matching the adapter's extensions.
 */
async function findSourceFiles(
  moduleDir: string,
  adapter: EcosystemAdapter,
): Promise<readonly string[]> {
  const patterns = adapter.sourceExtensions.map(
    (ext) => `**/*${ext}`,
  );

  return fg(patterns, {
    cwd: moduleDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    followSymbolicLinks: false,
  });
}

/**
 * Read and analyze a single source file.
 * Returns empty array if the file can't be read or parsed.
 */
async function analyzeFile(
  filePath: string,
  adapter: EcosystemAdapter,
): Promise<readonly ParsedImport[]> {
  try {
    const source = await readFile(filePath, 'utf-8');
    return adapter.analyzeImports(filePath, source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    logger.warn({ filePath, error: detail }, 'Failed to analyze file');
    return [];
  }
}

/**
 * Resolve an import source to a package name.
 * Tries the package map first, then falls back to the raw import source.
 */
function resolvePackageName(
  importSource: string,
  ecosystem: Module['ecosystem'],
  packageMap: ImportPackageMap,
): string {
  const resolved = packageMap.resolvePackageName(importSource, ecosystem);
  if (resolved) return resolved;

  // For npm, always extract the package name (handle deep imports)
  if (ecosystem === 'npm') {
    return extractNpmPackageName(importSource);
  }

  return importSource;
}

/**
 * Extract the npm package name from an import source.
 * Handles scoped packages and deep imports.
 */
function extractNpmPackageName(importSource: string): string {
  if (importSource.startsWith('@')) {
    const parts = importSource.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return importSource;
  }

  const slashIndex = importSource.indexOf('/');
  if (slashIndex > 0) {
    return importSource.substring(0, slashIndex);
  }

  return importSource;
}
