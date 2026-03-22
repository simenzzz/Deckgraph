import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OutdatedBadge } from '@/components/detail/OutdatedBadge';
import type { OutdatedSeverity } from '@deckgraph/shared';

describe('OutdatedBadge', () => {
  const severities: OutdatedSeverity[] = ['up-to-date', 'patch-behind', 'minor-behind', 'major-behind'];

  it.each(severities)('renders %s severity', (severity) => {
    render(<OutdatedBadge severity={severity} />);
    expect(screen.getByTestId(`outdated-badge-${severity}`)).toBeInTheDocument();
  });

  it('shows "Up to date" for up-to-date', () => {
    render(<OutdatedBadge severity="up-to-date" />);
    expect(screen.getByText('Up to date')).toBeInTheDocument();
  });

  it('shows "Major behind" for major-behind', () => {
    render(<OutdatedBadge severity="major-behind" />);
    expect(screen.getByText('Major behind')).toBeInTheDocument();
  });

  it('shows "Patch behind" for patch-behind', () => {
    render(<OutdatedBadge severity="patch-behind" />);
    expect(screen.getByText('Patch behind')).toBeInTheDocument();
  });

  it('shows "Minor behind" for minor-behind', () => {
    render(<OutdatedBadge severity="minor-behind" />);
    expect(screen.getByText('Minor behind')).toBeInTheDocument();
  });
});
