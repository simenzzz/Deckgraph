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
      <RegistryInfo dependency={baseDep} outdatedSeverity={null} isEnriching={false} onEnrich={onEnrich} />,
    );
    expect(screen.getByTestId('enrich-button')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enrich-button'));
    expect(onEnrich).toHaveBeenCalledOnce();
  });

  it('shows skeleton when enriching', () => {
    render(
      <RegistryInfo dependency={baseDep} outdatedSeverity={null} isEnriching={true} onEnrich={vi.fn()} />,
    );
    expect(screen.getByTestId('enriching-skeleton')).toBeInTheDocument();
  });

  it('shows registry data when available', () => {
    render(
      <RegistryInfo dependency={enrichedDep} outdatedSeverity="major-behind" isEnriching={false} onEnrich={vi.fn()} />,
    );
    expect(screen.getByTestId('registry-info')).toBeInTheDocument();
    expect(screen.getByText('4.18.0')).toBeInTheDocument();
    expect(screen.getByText('5.0.0')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('Fast, unopinionated web framework')).toBeInTheDocument();
  });

  it('shows homepage link', () => {
    render(
      <RegistryInfo dependency={enrichedDep} outdatedSeverity={null} isEnriching={false} onEnrich={vi.fn()} />,
    );
    expect(screen.getByTestId('homepage-link')).toBeInTheDocument();
  });

  it('shows deprecation warning', () => {
    const deprecatedDep: Dependency = {
      ...enrichedDep,
      registryMeta: { ...enrichedDep.registryMeta!, deprecated: true },
    };
    render(
      <RegistryInfo dependency={deprecatedDep} outdatedSeverity={null} isEnriching={false} onEnrich={vi.fn()} />,
    );
    expect(screen.getByText('This package is deprecated')).toBeInTheDocument();
  });

  it('shows outdated badge when severity provided', () => {
    render(
      <RegistryInfo dependency={enrichedDep} outdatedSeverity="major-behind" isEnriching={false} onEnrich={vi.fn()} />,
    );
    expect(screen.getByText('Major behind')).toBeInTheDocument();
  });
});
