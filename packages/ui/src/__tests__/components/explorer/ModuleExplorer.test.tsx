import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModuleExplorer } from '@/components/explorer/ModuleExplorer';

describe('ModuleExplorer', () => {
  it('renders heading', () => {
    render(<ModuleExplorer />);
    expect(screen.getByText('Module Explorer')).toBeInTheDocument();
  });

  it('renders filter bar', () => {
    render(<ModuleExplorer />);
    expect(screen.getByPlaceholderText('Search dependencies...')).toBeInTheDocument();
  });
});
