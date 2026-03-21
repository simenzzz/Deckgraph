/**
 * Connection state store.
 * Tracks WebSocket connection status.
 */

import { create } from 'zustand';
import type { ConnectionStatus } from '@/lib/wsClient';

export interface ConnectionState {
  readonly status: ConnectionStatus;
  readonly lastError: string | null;
}

export interface ConnectionActions {
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string) => void;
  clearError: () => void;
}

export type ConnectionStore = ConnectionState & ConnectionActions;

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'disconnected',
  lastError: null,

  setStatus: (status) =>
    set((state) => ({ ...state, status })),

  setError: (error) =>
    set((state) => ({ ...state, lastError: error })),

  clearError: () =>
    set((state) => ({ ...state, lastError: null })),
}));
