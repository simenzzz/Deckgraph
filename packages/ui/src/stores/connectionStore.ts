/**
 * Connection state store.
 * Tracks WebSocket connection status, onboarding state, and error info.
 */

import { create } from 'zustand';
import type { DemoRepository } from '@deckgraph/shared';
import type { ConnectionStatus } from '@/lib/wsClient';

export interface ConnectionState {
  readonly status: ConnectionStatus;
  readonly lastError: string | null;
  readonly lastErrorSuggestion: string | null;
  readonly configPresent: boolean | null;
  readonly hasScannedData: boolean | null;
  readonly demoMode: boolean;
  readonly demoRepositories: readonly DemoRepository[];
}

export interface ConnectionActions {
  setStatus: (status: ConnectionStatus) => void;
  setError: (message: string, suggestion: string) => void;
  clearError: () => void;
  setReady: (
    configPresent: boolean,
    hasScannedData: boolean,
    demoMode: boolean,
    demoRepositories: readonly DemoRepository[],
  ) => void;
}

export type ConnectionStore = ConnectionState & ConnectionActions;

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'disconnected',
  lastError: null,
  lastErrorSuggestion: null,
  configPresent: null,
  hasScannedData: null,
  demoMode: false,
  demoRepositories: [],

  setStatus: (status) =>
    set((state) => ({ ...state, status })),

  setError: (message, suggestion) =>
    set((state) => ({ ...state, lastError: message, lastErrorSuggestion: suggestion })),

  clearError: () =>
    set((state) => ({ ...state, lastError: null, lastErrorSuggestion: null })),

  setReady: (configPresent, hasScannedData, demoMode, demoRepositories) =>
    set((state) => ({ ...state, configPresent, hasScannedData, demoMode, demoRepositories })),
}));
