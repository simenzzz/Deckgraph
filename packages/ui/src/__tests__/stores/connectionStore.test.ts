import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from '@/stores/connectionStore';

describe('connectionStore', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: 'disconnected',
      lastError: null,
      lastErrorSuggestion: null,
      configPresent: null,
      hasScannedData: null,
      demoMode: false,
      demoRepositories: [],
    });
  });

  it('starts with disconnected status', () => {
    expect(useConnectionStore.getState().status).toBe('disconnected');
  });

  it('setStatus updates status', () => {
    useConnectionStore.getState().setStatus('connected');
    expect(useConnectionStore.getState().status).toBe('connected');
  });

  it('setError sets lastError', () => {
    useConnectionStore.getState().setError('Connection failed', 'Try again');
    expect(useConnectionStore.getState().lastError).toBe('Connection failed');
    expect(useConnectionStore.getState().lastErrorSuggestion).toBe('Try again');
  });

  it('clearError clears lastError', () => {
    useConnectionStore.getState().setError('err');
    useConnectionStore.getState().clearError();
    expect(useConnectionStore.getState().lastError).toBeNull();
  });
});
