import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegistryInfo } from '@/components/detail/RegistryInfo';
import type { Dependency } from '@deckgraph/shared';

const baseDep: Dependency = {
  name: 'express',
  ecosystem: 'npm',
  version: '4.18.0',
  constraint: '^4',
  scope: 'runtime',
  source: 'manifest',
  concerns: ['http'],
  usedInFiles: null,
  transitiveDeps: null,
  registryMeta: null,
};

const enrichedDep: Dependency = {
  ...baseDep,
  registryMeta: {
    latestVersion: '5.0.0',
    description: 'Fast, unopinionated web framework',
    license: 'MIT',
    homepage: 'https://expressjs.com',
    downloads: 50000000,
    deprecated: false,
    publishedAt: '2024-06-01T00:00:00.000Z',
  },
};

describe('RegistryInfo', () => {
  it('shows fetch button when no registry data and not enriching', () => {
    const onEnrich = vi.fn();
    render(
      <RegistryInfo dependency={baseDep} outdatedSeverity={null} isEnriching={false} enrichError={null} onEnrich={onEnrich} />,
    );
    expect(screen.getByTestId('enrich-button')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enrich-button'));
    expect(onEnrich).toHaveBeenCalledOnce();
  });

  it('shows skeleton when enriching', () => {
    render(
      <RegistryInfo dependency={baseDep} outdatedSeverity={null} isEnriching={true} enrichError={null} onEnrich={vi.fn()} />,
    );
    expect(screen.getByTestId('enriching-skeleton')).toBeInTheDocument();
  });

  it('shows registry data when available', () => {
    render(
      <RegistryInfo dependency={enrichedDep} outdatedSeverity="major-behind" isEnriching={false} enrichError={null} onEnrich={vi.fn()} />,
    );
    expect(screen.getByTestId('registry-info')).toBeInTheDocument();
    expect(screen.getByText('4.18.0')).toBeInTheDocument();
    expect(screen.getByText('5.0.0')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('Fast, unopinionated web framework')).toBeInTheDocument();
  });

  it('shows homepage link', () => {
    render(
      <RegistryInfo dependency={enrichedDep} outdatedSeverity={null} isEnriching={false} enrichError={null} onEnrich={vi.fn()} />,
    );
    expect(screen.getByTestId('homepage-link')).toBeInTheDocument();
  });

  it('shows deprecation warning', () => {
    const deprecatedDep: Dependency = {
      ...enrichedDep,
      registryMeta: { ...enrichedDep.registryMeta!, deprecated: true },
    };
    render(
      <RegistryInfo dependency={deprecatedDep} outdatedSeverity={null} isEnriching={false} enrichError={null} onEnrich={vi.fn()} />,
    );
    expect(screen.getByText('This package is deprecated')).toBeInTheDocument();
  });

  it('shows outdated badge when severity provided', () => {
    render(
      <RegistryInfo dependency={enrichedDep} outdatedSeverity="major-behind" isEnriching={false} enrichError={null} onEnrich={vi.fn()} />,
    );
    expect(screen.getByText('Major behind')).toBeInTheDocument();
  });

  it('shows a local-package card with no fetch button for local deps', () => {
    const localDep: Dependency = { ...baseDep, name: 'tideway-ingest', ecosystem: 'cargo', local: true };
    render(
      <RegistryInfo dependency={localDep} outdatedSeverity={null} isEnriching={false} enrichError={null} onEnrich={vi.fn()} />,
    );
    expect(screen.getByTestId('registry-local')).toBeInTheDocument();
    expect(screen.getByText(/Local package/)).toBeInTheDocument();
    expect(screen.queryByTestId('enrich-button')).not.toBeInTheDocument();
  });

  it('shows an in-panel error with a retry button when enrichment fails', () => {
    const onEnrich = vi.fn();
    render(
      <RegistryInfo
        dependency={baseDep}
        outdatedSeverity={null}
        isEnriching={false}
        enrichError={{ message: 'Package not found on the registry', suggestion: 'Check the package name' }}
        onEnrich={onEnrich}
      />,
    );
    expect(screen.getByTestId('registry-error')).toBeInTheDocument();
    expect(screen.getByText('Package not found on the registry')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enrich-retry-button'));
    expect(onEnrich).toHaveBeenCalledOnce();
  });

  it('prefers registry data over a stale error once data arrives', () => {
    render(
      <RegistryInfo
        dependency={enrichedDep}
        outdatedSeverity={null}
        isEnriching={false}
        enrichError={{ message: 'old error', suggestion: 'old' }}
        onEnrich={vi.fn()}
      />,
    );
    expect(screen.getByTestId('registry-info')).toBeInTheDocument();
    expect(screen.queryByTestId('registry-error')).not.toBeInTheDocument();
  });
});
