import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoNavLock } from '@/hooks/useDemoNavLock';
import { useConnectionStore } from '@/stores/connectionStore';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@deckgraph/shared';

const mockProject: Project = {
  root: '/repo',
  config: null,
  modules: [],
  crossEdges: [],
  lastScannedAt: '2025-01-01T00:00:00.000Z',
};

describe('useDemoNavLock', () => {
  beforeEach(() => {
    useConnectionStore.setState({ demoMode: false });
    useProjectStore.setState({ project: null });
  });

  it('is false in non-demo mode with no project', () => {
    const { result } = renderHook(() => useDemoNavLock());
    expect(result.current).toBe(false);
  });

  it('is true in demo mode with no project', () => {
    useConnectionStore.setState({ demoMode: true });
    useProjectStore.setState({ project: null });
    const { result } = renderHook(() => useDemoNavLock());
    expect(result.current).toBe(true);
  });

  it('is false in demo mode once a project is imported', () => {
    useConnectionStore.setState({ demoMode: true });
    useProjectStore.setState({ project: mockProject });
    const { result } = renderHook(() => useDemoNavLock());
    expect(result.current).toBe(false);
  });

  it('is false in non-demo mode with a project', () => {
    useConnectionStore.setState({ demoMode: false });
    useProjectStore.setState({ project: mockProject });
    const { result } = renderHook(() => useDemoNavLock());
    expect(result.current).toBe(false);
  });
});
