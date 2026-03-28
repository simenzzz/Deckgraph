/**
 * Types for package management actions (update, install, remove).
 *
 * These types are shared between UI and backend. The UI uses them
 * to display action results; the backend uses them to structure
 * executor return values.
 */

import type { DependencyScope, Ecosystem } from './project.js';

/**
 * Kind of package management action.
 */
export type PackageAction = 'update' | 'install' | 'remove';

/**
 * Outcome of a package management action.
 */
export type PackageActionStatus = 'success' | 'failure' | 'rolled-back';

/**
 * Result of a single package management operation.
 * Returned by executors and forwarded to the UI.
 */
export interface PackageActionResult {
  /** Which action was performed */
  readonly action: PackageAction;
  /** Ecosystem of the target package */
  readonly ecosystem: Ecosystem;
  /** Package name */
  readonly packageName: string;
  /** Module path (relative to project root) */
  readonly modulePath: string;
  /** Outcome */
  readonly status: PackageActionStatus;
  /** Version before the action (null for install) */
  readonly previousVersion: string | null;
  /** Version after the action (null for remove or failure) */
  readonly newVersion: string | null;
  /** Error message if status is 'failure' or 'rolled-back' */
  readonly error: string | null;
  /** The exact CLI command that was executed (for transparency) */
  readonly command: string;
}

/**
 * A single operation within a batch request.
 */
export interface PackageBatchOperation {
  /** Which action to perform */
  readonly action: PackageAction;
  /** Ecosystem of the target package */
  readonly ecosystem: Ecosystem;
  /** Package name */
  readonly packageName: string;
  /** Module path (relative to project root) */
  readonly modulePath: string;
  /** Target version (null = latest; ignored for remove) */
  readonly targetVersion: string | null;
  /** Dependency scope (null for remove) */
  readonly scope: DependencyScope | null;
}
