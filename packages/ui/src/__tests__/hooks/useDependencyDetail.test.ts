import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDependencyDetail } from '@/hooks/useDependencyDetail';
import { useDetailStore } from '@/stores/detailStore';
import { useProjectStore } from '@/stores/projectStore';
import type { Project, Module, Dependency } from '@deckgraph/shared';
import type { WsClient } from '@/lib/wsClient';

function createMockWsClient() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn().mockReturnValue(true),
    getStatus: vi.fn().mockReturnValue('connected' as const),
  };
}

const unenrichedDep: Dependency = {
  name: 'react',
  ecosystem: 'npm',
  version: '18.0.0',
  constraint: '^18',
  scope: 'runtime',
  source: 'manifest',
  concerns: [],
  usedInFiles: null,
  transitiveDeps: null,
  registryMeta: null,
};

const enrichedDep: Dependency = {
  ...unenrichedDep,
  usedInFiles: ['src/App.tsx'],
  registryMeta: {
    latestVersion: '19.0.0',
    description: 'React library',
    license: 'MIT',
    homepage: 'https://react.dev',
    downloads: 1000000,
    deprecated: false,
    publishedAt: '2024-01-01T00:00:00.000Z',
  },
};

const mockModule: Module = {
  path: 'packages/app',
  name: 'app',
  ecosystem: 'npm',
  manifests: ['package.json'],
  dependencies: [unenrichedDep],
  analysisState: 'manifest-only',
};

const mockProject: Project = {
  root: '/test',
  config: null,
  modules: [mockModule],
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

describe('useDependencyDetail', () => {
  beforeEach(() => {
    useDetailStore.setState({ selectedDep: null, isEnriching: false });
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null });
  });

  it('returns null when no dep is selected', () => {
    const { result } = renderHook(() => useDependencyDetail(null));
    expect(result.current.dependency).toBeNull();
    expect(result.current.outdatedSeverity).toBeNull();
  });

  it('resolves dependency from project store', () => {
    useProjectStore.getState().setProject(mockProject);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    const { result } = renderHook(() => useDependencyDetail(null));
    expect(result.current.dependency?.name).toBe('react');
    expect(result.current.analysisState).toBe('manifest-only');
  });

  it('computes outdated severity when registry data available', () => {
    const enrichedProject: Project = {
      ...mockProject,
      modules: [{ ...mockModule, dependencies: [enrichedDep] }],
    };
    useProjectStore.getState().setProject(enrichedProject);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    const { result } = renderHook(() => useDependencyDetail(null));
    expect(result.current.outdatedSeverity).toBe('major-behind');
  });

  it('auto-triggers enrichment when dep has no registry data', () => {
    const mockClient = createMockWsClient();
    useProjectStore.getState().setProject(mockProject);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    renderHook(() => useDependencyDetail(mockClient as unknown as WsClient));

    expect(mockClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'enrich_dependency',
        ecosystem: 'npm',
        packageName: 'react',
      }),
    );
  });

  it('does not auto-trigger enrichment for a local dependency', () => {
    const mockClient = createMockWsClient();
    const localDep: Dependency = { ...unenrichedDep, name: 'tideway-ingest', ecosystem: 'cargo', local: true };
    const localProject: Project = {
      ...mockProject,
      modules: [{ ...mockModule, ecosystem: 'cargo', dependencies: [localDep] }],
    };
    useProjectStore.getState().setProject(localProject);
    useDetailStore.getState().selectDep({ name: 'tideway-ingest', ecosystem: 'cargo' });

    renderHook(() => useDependencyDetail(mockClient as unknown as WsClient));

    expect(mockClient.send).not.toHaveBeenCalled();
    expect(useDetailStore.getState().isEnriching).toBe(false);
  });

  it('requestEnrichment sends WS message', () => {
    const mockClient = createMockWsClient();
    useProjectStore.getState().setProject(mockProject);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    const { result } = renderHook(() => useDependencyDetail(mockClient as unknown as WsClient));

    act(() => {
      result.current.requestEnrichment();
    });

    expect(mockClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'enrich_dependency',
        ecosystem: 'npm',
        packageName: 'react',
      }),
    );
    expect(useDetailStore.getState().isEnriching).toBe(true);
  });
});
