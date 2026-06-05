import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransitiveDeps } from '@/components/detail/TransitiveDeps';

describe('TransitiveDeps', () => {
  it('shows a local-package message for local deps', () => {
    render(<TransitiveDeps transitiveDeps={null} local />);
    expect(screen.getByTestId('transitive-local')).toBeInTheDocument();
    expect(screen.queryByTestId('transitive-not-available')).not.toBeInTheDocument();
  });

  it('shows the unavailable message when data is null and not local', () => {
    render(<TransitiveDeps transitiveDeps={null} />);
    expect(screen.getByTestId('transitive-not-available')).toBeInTheDocument();
  });

  it('shows the empty message when there are no transitive deps', () => {
    render(<TransitiveDeps transitiveDeps={[]} />);
    expect(screen.getByTestId('transitive-none')).toBeInTheDocument();
  });

  it('lists transitive dependencies when present', () => {
    render(<TransitiveDeps transitiveDeps={['lodash', 'axios']} />);
    expect(screen.getByTestId('transitive-list')).toBeInTheDocument();
    expect(screen.getByText('lodash')).toBeInTheDocument();
    expect(screen.getByText('axios')).toBeInTheDocument();
  });
});
