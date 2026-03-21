/**
 * Graph module barrel exports.
 */

export { depKey, emptyGraph, buildGraph, addModule, removeModule } from './dependencyGraph.js';
export { detectCycles } from './cycleDetector.js';
export type { CycleDetectionResult } from './cycleDetector.js';
export { executeQuery } from './queryEngine.js';
