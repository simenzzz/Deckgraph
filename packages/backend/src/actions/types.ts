/**
 * Executor types for package management actions.
 *
 * Executors are intentionally separate from EcosystemAdapters:
 * adapters are stateless and read-only, while executors mutate
 * the filesystem by running package manager subprocesses.
 */

import type {
  DependencyScope,
  Ecosystem,
  PackageActionResult,
} from '@deckgraph/shared';

/**
 * Contextual information passed to every executor call.
 */
export interface ExecutorContext {
  /** Absolute path to the monorepo root */
  readonly projectRoot: string;
  /** Relative path from project root to the module directory */
  readonly modulePath: string;
  /** Absolute working directory for the subprocess (projectRoot + modulePath) */
  readonly cwd: string;
}

/**
 * Options for updating a dependency to a specific version.
 */
export interface UpdateOptions {
  readonly packageName: string;
  readonly targetVersion: string;
  readonly scope: DependencyScope;
}

/**
 * Options for installing a new dependency.
 */
export interface InstallOptions {
  readonly packageName: string;
  /** null = latest version */
  readonly version: string | null;
  readonly scope: DependencyScope;
}

/**
 * Options for removing a dependency.
 */
export interface RemoveOptions {
  readonly packageName: string;
}

/**
 * Interface for ecosystem-specific package management operations.
 *
 * Each ecosystem provides its own executor that translates abstract
 * operations into concrete CLI commands.
 */
export interface EcosystemExecutor {
  readonly ecosystem: Ecosystem;

  /** Update a dependency to a specific version. */
  update(ctx: ExecutorContext, options: UpdateOptions): Promise<PackageActionResult>;

  /** Install a new dependency. */
  install(ctx: ExecutorContext, options: InstallOptions): Promise<PackageActionResult>;

  /** Remove a dependency. */
  remove(ctx: ExecutorContext, options: RemoveOptions): Promise<PackageActionResult>;
}

/**
 * Registry of ecosystem executors.
 */
export type ExecutorRegistry = ReadonlyMap<Ecosystem, EcosystemExecutor>;
