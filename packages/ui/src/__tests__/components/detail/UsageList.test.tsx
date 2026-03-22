import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageList } from '@/components/detail/UsageList';

describe('UsageList', () => {
  it('shows not-analyzed message for manifest-only state', () => {
    render(<UsageList usedInFiles={null} analysisState="manifest-only" />);
    expect(screen.getByTestId('usage-not-analyzed')).toBeInTheDocument();
  });

  it('shows unused message when imports resolved but empty', () => {
    render(<UsageList usedInFiles={[]} analysisState="imports-resolved" />);
    expect(screen.getByTestId('usage-unused')).toBeInTheDocument();
  });

  it('shows file list when files found', () => {
    render(<UsageList usedInFiles={['src/App.tsx', 'src/main.ts']} analysisState="imports-resolved" />);
    expect(screen.getByTestId('usage-list')).toBeInTheDocument();
    expect(screen.getByText('src/App.tsx')).toBeInTheDocument();
    expect(screen.getByText('src/main.ts')).toBeInTheDocument();
  });

  it('shows correct file count', () => {
    render(<UsageList usedInFiles={['src/App.tsx', 'src/main.ts']} analysisState="imports-resolved" />);
    expect(screen.getByText('Used in 2 files')).toBeInTheDocument();
  });

  it('singular text for one file', () => {
    render(<UsageList usedInFiles={['src/App.tsx']} analysisState="imports-resolved" />);
    expect(screen.getByText('Used in 1 file')).toBeInTheDocument();
  });

  it('shows unused when usedInFiles is null but analysis done', () => {
    render(<UsageList usedInFiles={null} analysisState="imports-resolved" />);
    expect(screen.getByTestId('usage-unused')).toBeInTheDocument();
  });
});
