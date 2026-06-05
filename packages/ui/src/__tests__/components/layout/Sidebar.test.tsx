import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';
import { useViewStore } from '@/stores/viewStore';
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

describe('Sidebar', () => {
  beforeEach(() => {
    useViewStore.setState({ currentView: 'overview', result: null, isLoading: false, selectedModulePath: null });
    useConnectionStore.setState({ demoMode: false });
    useProjectStore.setState({ project: null });
  });

  it('renders navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Module Explorer')).toBeInTheDocument();
    expect(screen.getByText('Health Report')).toBeInTheDocument();
    expect(screen.getByText('Cross-Language')).toBeInTheDocument();
  });

  it('highlights active view', () => {
    render(<Sidebar />);
    const overviewBtn = screen.getByTestId('nav-overview');
    expect(overviewBtn.className).toContain('bg-accent');
  });

  it('switches view on click', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('nav-explorer'));
    expect(useViewStore.getState().currentView).toBe('explorer');
  });

  it('switches to health view on click', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('nav-health'));
    expect(useViewStore.getState().currentView).toBe('health');
  });

  it('switches to graph view on click', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('nav-graph'));
    expect(useViewStore.getState().currentView).toBe('graph');
  });

  it('shows only Overview in demo mode before a repo is imported', () => {
    useConnectionStore.setState({ demoMode: true });
    useProjectStore.setState({ project: null });
    render(<Sidebar />);

    expect(screen.getByTestId('nav-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-explorer')).toBeNull();
    expect(screen.queryByTestId('nav-health')).toBeNull();
    expect(screen.queryByTestId('nav-graph')).toBeNull();
  });

  it('shows all nav items in demo mode once a repo is imported', () => {
    useConnectionStore.setState({ demoMode: true });
    useProjectStore.setState({ project: mockProject });
    render(<Sidebar />);

    expect(screen.getByTestId('nav-overview')).toBeInTheDocument();
    expect(screen.getByTestId('nav-explorer')).toBeInTheDocument();
    expect(screen.getByTestId('nav-health')).toBeInTheDocument();
    expect(screen.getByTestId('nav-graph')).toBeInTheDocument();
  });

  it('shows all nav items in non-demo mode even with no project', () => {
    useConnectionStore.setState({ demoMode: false });
    useProjectStore.setState({ project: null });
    render(<Sidebar />);

    expect(screen.getByTestId('nav-overview')).toBeInTheDocument();
    expect(screen.getByTestId('nav-explorer')).toBeInTheDocument();
    expect(screen.getByTestId('nav-health')).toBeInTheDocument();
    expect(screen.getByTestId('nav-graph')).toBeInTheDocument();
  });
});
