/**
 * Adapter system types.
 *
 * The adapter system uses the Strategy Pattern to support multiple
 * language ecosystems without modifying core scanner or graph code.
 */

import type { Ecosystem, DependencyScope, RegistryMeta } from './project.js';

/**
 * Interface for ecosystem adapters.
 *
 * Each adapter bundles three capabilities:
 * 1. Manifest parsing (Phase 1)
 * 2. Import analysis (Phase 2)
 * 3. Registry queries (Phase 3)
 */
export interface EcosystemAdapter {
  /** Which ecosystem this adapter handles */
  readonly ecosystem: Ecosystem;

  /** Manifest file names to look for during discovery (e.g. ["package.json"]) */
  readonly manifestFiles: readonly string[];

  /** File extensions this adapter can analyze for imports (e.g. [".ts", ".tsx"]) */
  readonly sourceExtensions: readonly string[];

  /**
   * Phase 1: Parse manifest + lock files to extract declared dependencies.
   * Async because it reads files from disk — avoid blocking the event loop
   * during startup scan of large monorepos.
   */
  parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult>;

  /**
   * Phase 2: AST-parse a single source file to extract imports.
   * Expensive — called on-demand when user drills into a module.
   */
  analyzeImports(filePath: string, source: string): readonly ParsedImport[];

  /**
   * Phase 3: Query the ecosystem's package registry for metadata.
   * Network-bound — called on-demand when user opens dependency detail.
   */
  queryRegistry(packageName: string): Promise<RegistryMeta | null>;
}

/**
 * Returned by parseManifests. Contains everything extractable from
 * config/lock files without touching source code.
 */
export interface ManifestResult {
  /** Detected module name (from manifest metadata or directory name) */
  readonly moduleName: string;
  /** Declared dependencies with versions and scopes */
  readonly dependencies: readonly MinimalDependency[];
  /** Lock file found and parsed (enables precise version resolution) */
  readonly hasLockFile: boolean;
  /** Ecosystem-specific extras (e.g. npm scripts, Python extras, Go module path) */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * A single import statement extracted from source code via AST analysis.
 */
export interface ParsedImport {
  /** Import source (e.g. "stripe", "flask", "github.com/gin-gonic/gin") */
  readonly source: string;
  /** Imported names (e.g. ["Stripe", "default"], ["Flask", "jsonify"]) */
  readonly specifiers: readonly string[];
  /** true if this is a third-party package import (not relative/local) */
  readonly isThirdParty: boolean;
  /** Line number in source file */
  readonly line: number;
}

/**
 * Resolves import source strings to their declared package names.
 * Required for accurate unused dependency detection in ecosystems
 * where import names differ from package names.
 */
export interface ImportPackageMap {
  /**
   * Resolve an import source to its package name.
   * Returns null if no mapping exists (assumes 1:1 import-to-package).
   */
  resolvePackageName(importSource: string, ecosystem: Ecosystem): string | null;
}

/**
 * Maps file extensions and manifest files to the correct adapter.
 */
export interface AdapterRegistry {
  /** Register an adapter for its ecosystem */
  register(adapter: EcosystemAdapter): void;

  /** Get the adapter that handles a given manifest file */
  getAdapterForManifest(manifestFileName: string): EcosystemAdapter | null;

  /** Get the adapter that handles a given source file extension */
  getAdapterForExtension(extension: string): EcosystemAdapter | null;

  /** List all registered ecosystems */
  getRegisteredEcosystems(): readonly Ecosystem[];
}

/**
 * Minimal dependency representation returned by adapters during manifest parsing.
 * Adapters only know about these 4 fields; the rest are populated later.
 */
export interface MinimalDependency {
  readonly name: string;
  readonly version: string;
  readonly constraint: string;
  readonly scope: DependencyScope;
}
