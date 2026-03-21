/**
 * Cycle detection using Kahn's algorithm (topological sort).
 *
 * Operates on the forward adjacency list of the unified graph.
 * Returns topological order for acyclic portions and identifies
 * nodes participating in cycles.
 */

/**
 * Result of cycle detection on a directed graph.
 */
export interface CycleDetectionResult {
  /** True if the graph has no cycles */
  readonly isAcyclic: boolean;
  /** Node keys that participate in at least one cycle */
  readonly nodesInCycles: readonly string[];
  /** Topological order of non-cycle nodes */
  readonly topologicalOrder: readonly string[];
}

/**
 * Detect cycles in a directed graph using Kahn's algorithm.
 *
 * 1. Compute in-degree for every reachable node
 * 2. Seed queue with nodes that have in-degree 0
 * 3. Process queue: remove node, decrement neighbor in-degrees
 * 4. Nodes remaining with in-degree > 0 are in cycles
 */
export function detectCycles(
  forward: ReadonlyMap<string, ReadonlySet<string>>,
): CycleDetectionResult {
  // Collect all nodes (sources + targets)
  const inDegree = new Map<string, number>();

  for (const [node, neighbors] of forward) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0);
    }
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1);
    }
  }

  // Seed queue with zero in-degree nodes
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const topologicalOrder: string[] = [];
  let head = 0;

  while (head < queue.length) {
    const node = queue[head]!;
    head++;
    topologicalOrder.push(node);

    const neighbors = forward.get(node);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Remaining nodes with in-degree > 0 are in cycles
  const nodesInCycles: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree > 0) {
      nodesInCycles.push(node);
    }
  }

  return {
    isAcyclic: nodesInCycles.length === 0,
    nodesInCycles: nodesInCycles.sort(),
    topologicalOrder,
  };
}
