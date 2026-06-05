import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModuleExplorer } from '@/components/explorer/ModuleExplorer';
import { useDetailStore } from '@/stores/detailStore';

describe('ModuleExplorer', () => {
  beforeEach(() => {
    useDetailStore.setState({ selectedDep: null, isEnriching: false });
  });

  it('renders heading', () => {
    render(<ModuleExplorer wsClient={null} />);
    expect(screen.getByText('Module Explorer')).toBeInTheDocument();
  });

  it('renders filter bar', () => {
    render(<ModuleExplorer wsClient={null} />);
    expect(screen.getByPlaceholderText('Search modules...')).toBeInTheDocument();
  });
});
