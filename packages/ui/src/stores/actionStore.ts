/**
 * Action state store.
 * Tracks in-progress package management actions and their results.
 */

import { create } from 'zustand';
import type { PackageActionResult } from '@deckgraph/shared';

export interface ActionState {
  /** Map of modulePath → requestId for in-progress actions */
  readonly inProgress: ReadonlyMap<string, string>;
  /** Most recent action result (null until first action completes) */
  readonly lastResult: PackageActionResult | null;
  /** Results from batch operations */
  readonly batchResults: readonly PackageActionResult[];
  /** Whether a batch operation is in progress */
  readonly isBatchRunning: boolean;
}

export interface ActionActions {
  startAction: (modulePath: string, requestId: string) => void;
  completeAction: (result: PackageActionResult) => void;
  clearResult: () => void;
  startBatch: () => void;
  batchComplete: (results: readonly PackageActionResult[]) => void;
  clearBatch: () => void;
  reset: () => void;
}

export type ActionStore = ActionState & ActionActions;

export const useActionStore = create<ActionStore>((set) => ({
  inProgress: new Map(),
  lastResult: null,
  batchResults: [],
  isBatchRunning: false,

  startAction: (modulePath, requestId) =>
    set((state) => ({
      inProgress: new Map([...state.inProgress, [modulePath, requestId]]),
      lastResult: null,
    })),

  completeAction: (result) =>
    set((state) => {
      const next = new Map(state.inProgress);
      next.delete(result.modulePath);
      return { inProgress: next, lastResult: result };
    }),

  clearResult: () =>
    set(() => ({ lastResult: null })),

  startBatch: () =>
    set(() => ({ isBatchRunning: true, batchResults: [] })),

  batchComplete: (results) =>
    set(() => ({ isBatchRunning: false, batchResults: results })),

  clearBatch: () =>
    set(() => ({ batchResults: [], isBatchRunning: false })),

  reset: () =>
    set(() => ({
      inProgress: new Map(),
      lastResult: null,
      batchResults: [],
      isBatchRunning: false,
    })),
}));
