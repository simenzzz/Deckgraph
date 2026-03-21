/**
 * FFI (Foreign Function Interface) cross-language edge detector.
 *
 * Detects PyO3, cgo, napi, and JNI bindings by pattern-matching
 * source files for FFI markers.
 */

import type { CrossEdge, Ecosystem, Module } from '@deckgraph/shared';
import { readFileSafe } from '../adapters/utils.js';
import { findFiles, findOwningModule } from './fileScanner.js';
import type { EdgeDetector } from './types.js';
import { createLogger } from '../logger.js';
import { join } from 'node:path';

const logger = createLogger('ffiDetector');

interface FfiPattern {
  /** Source ecosystem where FFI binding is defined */
  readonly sourceEcosystem: Ecosystem;
  /** Target ecosystem that consumes the binding */
  readonly targetEcosystem: Ecosystem;
  /** Glob patterns for source files */
  readonly filePatterns: readonly string[];
  /** Regex patterns to match in file content */
  readonly contentPatterns: readonly RegExp[];
  /** Confidence level for this type of FFI */
  readonly confidence: number;
  /** Human-readable FFI type name */
  readonly label: string;
}

const FFI_PATTERNS: readonly FfiPattern[] = [
  // PyO3: Rust -> Python
  {
    sourceEcosystem: 'cargo',
    targetEcosystem: 'pypi',
    filePatterns: ['**/*.rs'],
    contentPatterns: [
      /#\[pyfunction\]/,
      /#\[pymodule\]/,
      /#\[pyclass\]/,
      /use pyo3/,
    ],
    confidence: 0.6,
    label: 'PyO3 (Rust→Python)',
  },
  // cgo: Go -> C (linking to other ecosystem modules)
  {
    sourceEcosystem: 'go',
    targetEcosystem: 'cargo',
    filePatterns: ['**/*.go'],
    contentPatterns: [
      /import\s+"C"/,
      /#cgo\s+/,
    ],
    confidence: 0.4,
    label: 'cgo (Go→C/Rust)',
  },
  // napi: Rust/C -> Node.js
  {
    sourceEcosystem: 'cargo',
    targetEcosystem: 'npm',
    filePatterns: ['**/*.rs'],
    contentPatterns: [
      /#\[napi\]/,
      /use napi/,
      /napi_derive/,
    ],
    confidence: 0.6,
    label: 'napi (Rust→Node.js)',
  },
  // JNI: Java <-> C/Rust
  {
    sourceEcosystem: 'maven',
    targetEcosystem: 'cargo',
    filePatterns: ['**/*.java'],
    contentPatterns: [
      /\bnative\s+\w+\s+\w+\s*\(/,
      /System\.loadLibrary\s*\(/,
    ],
    confidence: 0.4,
    label: 'JNI (Java→native)',
  },
];

export function createFfiDetector(): EdgeDetector {
  return {
    name: 'ffi',

    async detect(
      projectRoot: string,
      modules: readonly Module[],
    ): Promise<readonly CrossEdge[]> {
      const allEdges: CrossEdge[] = [];

      for (const pattern of FFI_PATTERNS) {
        const sourceModules = modules.filter(
          (m) => m.ecosystem === pattern.sourceEcosystem,
        );
        const targetModules = modules.filter(
          (m) => m.ecosystem === pattern.targetEcosystem,
        );

        if (sourceModules.length === 0 || targetModules.length === 0) continue;

        const edges = await detectFfiPattern(
          projectRoot,
          pattern,
          sourceModules,
          targetModules,
        );
        allEdges.push(...edges);
      }

      logger.debug({ edgeCount: allEdges.length }, 'FFI detection complete');
      return allEdges;
    },
  };
}

async function detectFfiPattern(
  projectRoot: string,
  pattern: FfiPattern,
  sourceModules: readonly Module[],
  targetModules: readonly Module[],
): Promise<readonly CrossEdge[]> {
  const files = await findFiles(projectRoot, [...pattern.filePatterns]);
  if (files.length === 0) return [];

  const edges: CrossEdge[] = [];
  const matchedSources = new Set<string>();

  for (const file of files) {
    const content = await readFileSafe(join(projectRoot, file));
    if (!content) continue;

    const hasMatch = pattern.contentPatterns.some((re) => re.test(content));
    if (!hasMatch) continue;

    const sourceModule = findOwningModule(file, sourceModules);
    if (!sourceModule || matchedSources.has(sourceModule.path)) continue;

    matchedSources.add(sourceModule.path);

    for (const targetModule of targetModules) {
      edges.push({
        from: { module: sourceModule.path, ecosystem: sourceModule.ecosystem },
        to: { module: targetModule.path, ecosystem: targetModule.ecosystem },
        type: 'ffi',
        evidence: `${pattern.label} binding in ${sourceModule.path} targeting ${targetModule.path}`,
        confidence: pattern.confidence,
      });
    }
  }

  return edges;
}
