/**
 * Cross-language edge detector interface.
 *
 * Each detector finds a specific type of cross-ecosystem relationship
 * (proto, FFI, OpenAPI, build refs, shared config).
 */

import type { CrossEdge, Module } from '@deckgraph/shared';

/**
 * Interface for cross-language edge detectors.
 */
export interface EdgeDetector {
  /** Human-readable detector name (for logging) */
  readonly name: string;

  /**
   * Detect cross-language edges in the given project.
   *
   * @param projectRoot - Absolute path to the project root
   * @param modules - Discovered modules with parsed dependencies
   * @returns Detected cross-language edges
   */
  detect(
    projectRoot: string,
    modules: readonly Module[],
  ): Promise<readonly CrossEdge[]>;
}
