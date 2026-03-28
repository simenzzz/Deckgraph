import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';
import { useViewStore } from '@/stores/viewStore';

describe('Sidebar', () => {
  beforeEach(() => {
    useViewStore.setState({ currentView: 'overview', result: null, isLoading: false, selectedModulePath: null });
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
});
