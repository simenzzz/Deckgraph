import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutdatedReport } from '@/components/health/OutdatedReport';
import type { OutdatedDep } from '@/hooks/useHealthReport';

const mockDeps: OutdatedDep[] = [
  { name: 'express', ecosystem: 'npm', version: '4.0.0', latestVersion: '5.0.0', severity: 'major-behind', modulePath: 'pkg/a' },
  { name: 'lodash', ecosystem: 'npm', version: '4.17.0', latestVersion: '4.17.21', severity: 'patch-behind', modulePath: 'pkg/b' },
  { name: 'flask', ecosystem: 'pypi', version: '2.0.0', latestVersion: '2.3.0', severity: 'minor-behind', modulePath: 'pkg/c' },
];

describe('OutdatedReport', () => {
  it('shows no-data message when no registry data', () => {
    render(<OutdatedReport deps={[]} hasRegistryData={false} />);
    expect(screen.getByTestId('outdated-no-data')).toBeInTheDocument();
  });

  it('shows all-current message when no outdated deps', () => {
    render(<OutdatedReport deps={[]} hasRegistryData={true} />);
    expect(screen.getByTestId('outdated-all-current')).toBeInTheDocument();
  });

  it('renders outdated deps table', () => {
    render(<OutdatedReport deps={mockDeps} hasRegistryData={true} />);
    expect(screen.getByTestId('outdated-report')).toBeInTheDocument();
    expect(screen.getByText('express')).toBeInTheDocument();
    expect(screen.getByText('lodash')).toBeInTheDocument();
    expect(screen.getByText('flask')).toBeInTheDocument();
  });

  it('shows severity badges', () => {
    render(<OutdatedReport deps={mockDeps} hasRegistryData={true} />);
    expect(screen.getByText('Major behind')).toBeInTheDocument();
    expect(screen.getByText('Patch behind')).toBeInTheDocument();
    expect(screen.getByText('Minor behind')).toBeInTheDocument();
  });

  it('shows dep count', () => {
    render(<OutdatedReport deps={mockDeps} hasRegistryData={true} />);
    expect(screen.getByText('3 outdated dependencies')).toBeInTheDocument();
  });

  it('shows installed and latest versions', () => {
    render(<OutdatedReport deps={mockDeps} hasRegistryData={true} />);
    expect(screen.getByText('4.0.0')).toBeInTheDocument();
    expect(screen.getByText('5.0.0')).toBeInTheDocument();
  });
});
