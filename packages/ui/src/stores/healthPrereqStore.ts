import { create } from 'zustand';
import type { HealthPrereqTarget } from '@/lib/healthPrerequisites';

export type HealthPrereqKind = HealthPrereqTarget['kind'];

export interface HealthPrereqFailure {
  readonly targetId: string;
  readonly label: string;
  readonly message: string;
}

export interface ActiveHealthPrereqRequest {
  readonly requestId: string;
  readonly target: HealthPrereqTarget;
  readonly progress: string | null;
}

export interface HealthPrereqState {
  readonly kind: HealthPrereqKind | null;
  readonly isRunning: boolean;
  readonly queue: readonly HealthPrereqTarget[];
  readonly active: ActiveHealthPrereqRequest | null;
  readonly completed: number;
  readonly failures: readonly HealthPrereqFailure[];
  readonly total: number;
}

export interface HealthPrereqActions {
  startBatch: (kind: HealthPrereqKind, targets: readonly HealthPrereqTarget[]) => void;
  markSent: (requestId: string, target: HealthPrereqTarget) => void;
  markSendFailed: (target: HealthPrereqTarget, message: string) => void;
  setProgress: (requestId: string, progress: string) => void;
  completeRequest: (requestId: string) => void;
  failRequest: (requestId: string, message: string) => void;
  reset: () => void;
}

export type HealthPrereqStore = HealthPrereqState & HealthPrereqActions;

const INITIAL_STATE: HealthPrereqState = {
  kind: null,
  isRunning: false,
  queue: [],
  active: null,
  completed: 0,
  failures: [],
  total: 0,
};

function finishIfDone(state: HealthPrereqState): HealthPrereqState {
  if (state.queue.length > 0 || state.active !== null) return state;
  return { ...state, isRunning: false };
}

export const useHealthPrereqStore = create<HealthPrereqStore>((set) => ({
  ...INITIAL_STATE,

  startBatch: (kind, targets) =>
    set(() => ({
      kind,
      isRunning: targets.length > 0,
      queue: targets,
      active: null,
      completed: 0,
      failures: [],
      total: targets.length,
    })),

  markSent: (requestId, target) =>
    set((state) => ({
      ...state,
      queue: state.queue.filter((queued) => queued.targetId !== target.targetId),
      active: { requestId, target, progress: null },
    })),

  markSendFailed: (target, message) =>
    set((state) => finishIfDone({
      ...state,
      queue: state.queue.filter((queued) => queued.targetId !== target.targetId),
      failures: [...state.failures, { targetId: target.targetId, label: target.label, message }],
    })),

  setProgress: (requestId, progress) =>
    set((state) => {
      if (state.active?.requestId !== requestId) return state;
      return { ...state, active: { ...state.active, progress } };
    }),

  completeRequest: (requestId) =>
    set((state) => {
      if (state.active?.requestId !== requestId) return state;
      return finishIfDone({
        ...state,
        active: null,
        completed: state.completed + 1,
      });
    }),

  failRequest: (requestId, message) =>
    set((state) => {
      if (state.active?.requestId !== requestId) return state;
      return finishIfDone({
        ...state,
        active: null,
        failures: [
          ...state.failures,
          {
            targetId: state.active.target.targetId,
            label: state.active.target.label,
            message,
          },
        ],
      });
    }),

  reset: () => set(() => INITIAL_STATE),
}));
