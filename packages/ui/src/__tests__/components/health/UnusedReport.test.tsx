import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnusedReport } from '@/components/health/UnusedReport';
import type { UnusedDep } from '@/hooks/useHealthReport';

const mockDeps: UnusedDep[] = [
  { name: 'unused-a', ecosystem: 'npm', scope: 'runtime', modulePath: 'pkg/a', moduleName: 'app-a' },
  { name: 'unused-b', ecosystem: 'pypi', scope: 'dev', modulePath: 'pkg/b', moduleName: 'app-b' },
];

describe('UnusedReport', () => {
  it('shows no-analysis message when import analysis not run', () => {
    render(<UnusedReport deps={[]} hasImportAnalysis={false} />);
    expect(screen.getByTestId('unused-no-analysis')).toBeInTheDocument();
  });

  it('shows none message when analysis run but no unused', () => {
    render(<UnusedReport deps={[]} hasImportAnalysis={true} />);
    expect(screen.getByTestId('unused-none')).toBeInTheDocument();
  });

  it('renders unused deps table', () => {
    render(<UnusedReport deps={mockDeps} hasImportAnalysis={true} />);
    expect(screen.getByTestId('unused-report')).toBeInTheDocument();
    expect(screen.getByText('unused-a')).toBeInTheDocument();
    expect(screen.getByText('unused-b')).toBeInTheDocument();
  });

  it('shows dep count', () => {
    render(<UnusedReport deps={mockDeps} hasImportAnalysis={true} />);
    expect(screen.getByText('2 potentially unused dependencies')).toBeInTheDocument();
  });

  it('shows module info', () => {
    render(<UnusedReport deps={mockDeps} hasImportAnalysis={true} />);
    expect(screen.getByText('app-a (pkg/a)')).toBeInTheDocument();
    expect(screen.getByText('app-b (pkg/b)')).toBeInTheDocument();
  });

  it('shows scope for each dep', () => {
    render(<UnusedReport deps={mockDeps} hasImportAnalysis={true} />);
    expect(screen.getByText('runtime')).toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();
  });

  it('singular text for one dep', () => {
    render(<UnusedReport deps={[mockDeps[0]]} hasImportAnalysis={true} />);
    expect(screen.getByText('1 potentially unused dependency')).toBeInTheDocument();
  });
});
