import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Workspace } from '@deckgraph/shared';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import { useProjectStore } from '@/stores/projectStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const workspace: Workspace = {
  config: null,
  projects: [
    {
      root: '/workspace/app',
      config: null,
      modules: [],
      crossEdges: [],
      lastScannedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      root: '/workspace/api',
      config: null,
      modules: [],
      crossEdges: [],
      lastScannedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  crossRootDeps: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspace, activeProjectRoot: null });
    useProjectStore.setState({
      project: null,
      isScanning: false,
      lastProgress: null,
      fileChangeInProgress: false,
    });
  });

  it('keeps All Projects as the workspace-wide selection', () => {
    render(<WorkspaceSwitcher />);

    const select = screen.getByLabelText('Project:');
    expect(select).toHaveValue('all');
    expect(screen.getByRole('option', { name: 'All Projects (2)' })).toBeInTheDocument();
  });

  it('can switch from a concrete project back to All Projects', () => {
    render(<WorkspaceSwitcher />);

    const select = screen.getByLabelText('Project:');
    fireEvent.change(select, { target: { value: '/workspace/api' } });
    expect(useProjectStore.getState().project?.root).toBe('/workspace/api');

    fireEvent.change(select, { target: { value: 'all' } });
    expect(useWorkspaceStore.getState().activeProjectRoot).toBeNull();
    expect(useProjectStore.getState().project).toBeNull();
  });
});
