/**
 * Core types for representing a scanned project.
 *
 * These types are ecosystem-agnostic — all ecosystem-specific details
 * are normalized into these types by the adapters.
 */

/**
 * Supported language ecosystems.
 */
export type Ecosystem = 'npm' | 'pypi' | 'cargo' | 'go' | 'maven';

/**
 * How deeply a module has been analyzed.
 * - manifest-only: Only manifest/lock files parsed (Phase 1)
 * - imports-resolved: Source code imports analyzed (Phase 2)
 * - registry-enriched: Registry metadata fetched (Phase 3)
 */
export type AnalysisState = 'manifest-only' | 'imports-resolved' | 'registry-enriched';

/**
 * Generalized dependency scope across all ecosystems.
 */
export type DependencyScope = 'runtime' | 'dev' | 'build' | 'optional' | 'peer';

/**
 * Types of cross-language edges between modules.
 */
export type CrossEdgeType = 'proto' | 'openapi' | 'ffi' | 'build' | 'shared-config';

/**
 * Top-level object representing the scanned monorepo.
 */
export interface Project {
  /** Absolute path to the monorepo root */
  readonly root: string;
  /** Project-level config from .deckgraph.yaml (null if absent) */
  readonly config: ProjectConfig | null;
  /** Auto-discovered modules */
  readonly modules: readonly Module[];
  /** Cross-language edges detected between modules */
  readonly crossEdges: readonly CrossEdge[];
  /** Timestamp of last scan (ISO 8601) */
  readonly lastScannedAt: string;
}

/**
 * Project-level configuration from .deckgraph.yaml.
 */
export interface ProjectConfig {
  /** Paths to ignore during discovery (glob patterns) */
  readonly ignorePaths: readonly string[];
  /** User-defined concern tag overrides (package name → tags) */
  readonly concernOverrides: Readonly<Record<string, readonly string[]>>;
}

/**
 * A discovered unit within the monorepo — a directory with a manifest file.
 */
export interface Module {
  /** Relative path from project root */
  readonly path: string;
  /** Human-readable name (from manifest or directory name) */
  readonly name: string;
  /** Which ecosystem this module belongs to */
  readonly ecosystem: Ecosystem;
  /** Manifest files found (e.g. ["package.json", "pnpm-lock.yaml"]) */
  readonly manifests: readonly string[];
  /** Declared dependencies (populated during Phase 1: Manifest Scan) */
  readonly dependencies: readonly Dependency[];
  /** How deeply this module has been analyzed */
  readonly analysisState: AnalysisState;
}

/**
 * Ecosystem-agnostic dependency. Constraint syntax is ecosystem-specific
 * but stored as a raw string.
 */
export interface Dependency {
  /** Package name as the ecosystem knows it */
  readonly name: string;
  /** Which ecosystem this dependency belongs to */
  readonly ecosystem: Ecosystem;
  /** Resolved/installed version */
  readonly version: string;
  /** Raw constraint string (semver, PEP 440, Cargo req, etc.) */
  readonly constraint: string;
  /** Generalized scope */
  readonly scope: DependencyScope;
  /** How this dependency was discovered */
  readonly source: 'manifest' | 'import-only' | 'both';
  /** Concern tags (from built-in database + user overrides) */
  readonly concerns: readonly string[];

  // --- Lazy-loaded fields (null until the relevant analysis phase completes) ---

  /** Files that import this package (Phase 2: Import Analysis) */
  readonly usedInFiles: readonly string[] | null;
  /** Direct transitive dependencies (from lock file or registry) */
  readonly transitiveDeps: readonly string[] | null;
  /** Registry metadata (Phase 3: Registry Enrichment) */
  readonly registryMeta: RegistryMeta | null;
}

/**
 * Ecosystem-agnostic registry metadata.
 * Fields that a specific registry doesn't expose are null.
 */
export interface RegistryMeta {
  /** Latest available version */
  readonly latestVersion: string;
  /** Package description */
  readonly description: string;
  /** License identifier (SPDX) */
  readonly license: string | null;
  /** Project homepage URL */
  readonly homepage: string | null;
  /** Download count (not all registries expose this) */
  readonly downloads: number | null;
  /** Whether this package is deprecated */
  readonly deprecated: boolean;
  /** When the latest version was published (ISO 8601) */
  readonly publishedAt: string | null;
}

/**
 * A detected relationship between modules in different ecosystems.
 */
export interface CrossEdge {
  /** Source module */
  readonly from: CrossEdgeEndpoint;
  /** Target module */
  readonly to: CrossEdgeEndpoint;
  /** What kind of cross-language relationship */
  readonly type: CrossEdgeType;
  /** Human-readable explanation */
  readonly evidence: string;
  /** Detection confidence (0–1) */
  readonly confidence: number;
}

/**
 * An endpoint of a cross-language edge.
 */
export interface CrossEdgeEndpoint {
  /** Module path (relative to project root) */
  readonly module: string;
  /** Ecosystem of this module */
  readonly ecosystem: Ecosystem;
}

/**
 * Internal unified graph type.
 * Holds modules, forward edges, reverse edges, and cross-language edges.
 */
export interface UnifiedGraph {
  /** All modules keyed by path */
  readonly modules: ReadonlyMap<string, Module>;
  /** Forward edges: module/dep → its dependencies */
  readonly forward: ReadonlyMap<string, ReadonlySet<string>>;
  /** Reverse edges: dep → what depends on it */
  readonly reverse: ReadonlyMap<string, ReadonlySet<string>>;
  /** Cross-language edges */
  readonly crossEdges: readonly CrossEdge[];
}

// ============================================================================
// Workspace Types (Polyrepo Support)
// ============================================================================

/**
 * Hook event types for developer callbacks.
 */
export type HookEventType =
  | 'on-scan-complete'
  | 'on-outdated'
  | 'on-unused'
  | 'on-license-violation';

/**
 * A single hook command entry.
 */
export interface HookEntry {
  /** Command to execute (shell command) */
  readonly cmd: string;
}

/**
 * Hook configuration for all event types.
 */
export interface HooksConfig {
  /** Hooks fired after scan completes */
  readonly onScanComplete: readonly HookEntry[];
  /** Hooks fired when outdated dependencies detected */
  readonly onOutdated: readonly HookEntry[];
  /** Hooks fired when unused dependencies detected */
  readonly onUnused: readonly HookEntry[];
  /** Hooks fired when license violations detected */
  readonly onLicenseViolation: readonly HookEntry[];
}

/**
 * Workspace-level configuration extending ProjectConfig.
 */
export interface WorkspaceConfig extends ProjectConfig {
  /** Multiple project roots to scan (polyrepo mode) */
  readonly roots: readonly string[];
  /** Developer hook commands for various events */
  readonly hooks: HooksConfig;
}

/**
 * A version of a dependency used in a specific root.
 */
export interface CrossRootVersion {
  /** Absolute path to the project root */
  readonly projectRoot: string;
  /** Module path within the project */
  readonly modulePath: string;
  /** Version being used */
  readonly version: string;
  /** Constraint string from manifest */
  readonly constraint: string;
}

/**
 * A dependency used across multiple roots at different versions (divergence).
 */
export interface CrossRootDependency {
  /** Ecosystem of the package */
  readonly ecosystem: Ecosystem;
  /** Package name */
  readonly packageName: string;
  /** Versions across different roots */
  readonly versions: readonly CrossRootVersion[];
}

/**
 * Workspace aggregation across multiple project roots.
 */
export interface Workspace {
  /** All scanned projects */
  readonly projects: readonly Project[];
  /** Workspace-level config (if any) */
  readonly config: WorkspaceConfig | null;
  /** Dependencies used in multiple roots at different versions */
  readonly crossRootDeps: readonly CrossRootDependency[];
  /** Timestamp of last workspace scan */
  readonly lastScannedAt: string;
}

/**
 * Curated repository available in hosted demo mode.
 */
export interface DemoRepository {
  /** Stable identifier used by the WebSocket protocol */
  readonly id: string;
  /** Human-readable label shown in the UI */
  readonly label: string;
  /** Public GitHub repository URL */
  readonly url: string;
  /** Short description for the selection screen */
  readonly description: string;
}
