import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LicenseAudit } from '@/components/health/LicenseAudit';
import type { LicenseEntry } from '@/hooks/useHealthReport';

const mockLicenses: LicenseEntry[] = [
  { license: 'MIT', count: 42, isCopyleft: false },
  { license: 'Apache-2.0', count: 15, isCopyleft: false },
  { license: 'GPL-3.0', count: 3, isCopyleft: true },
];

describe('LicenseAudit', () => {
  it('shows no-data message when no registry data', () => {
    render(<LicenseAudit licenses={[]} hasRegistryData={false} />);
    expect(screen.getByTestId('license-no-data')).toBeInTheDocument();
  });

  it('shows no-licenses message when empty', () => {
    render(<LicenseAudit licenses={[]} hasRegistryData={true} />);
    expect(screen.getByTestId('license-none')).toBeInTheDocument();
  });

  it('renders license distribution table', () => {
    render(<LicenseAudit licenses={mockLicenses} hasRegistryData={true} />);
    expect(screen.getByTestId('license-audit')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Apache-2.0')).toBeInTheDocument();
    expect(screen.getByText('GPL-3.0')).toBeInTheDocument();
  });

  it('shows copyleft warning when copyleft licenses present', () => {
    render(<LicenseAudit licenses={mockLicenses} hasRegistryData={true} />);
    expect(screen.getByTestId('copyleft-warning')).toBeInTheDocument();
  });

  it('does not show copyleft warning when no copyleft', () => {
    const permissive: LicenseEntry[] = [
      { license: 'MIT', count: 10, isCopyleft: false },
    ];
    render(<LicenseAudit licenses={permissive} hasRegistryData={true} />);
    expect(screen.queryByTestId('copyleft-warning')).not.toBeInTheDocument();
  });

  it('shows copyleft badge for GPL licenses', () => {
    render(<LicenseAudit licenses={mockLicenses} hasRegistryData={true} />);
    expect(screen.getByText('Copyleft')).toBeInTheDocument();
  });

  it('shows permissive badge for non-copyleft licenses', () => {
    render(<LicenseAudit licenses={mockLicenses} hasRegistryData={true} />);
    expect(screen.getAllByText('Permissive')).toHaveLength(2);
  });
});
