import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EcosystemCard } from '@/components/overview/EcosystemCard';
import type { Module } from '@deckgraph/shared';

afterEach(() => cleanup());

const mockModules: Module[] = [
  {
    path: 'pkg/a', name: 'a', ecosystem: 'npm', manifests: ['package.json'],
    dependencies: [
      { name: 'react', ecosystem: 'npm', version: '19.0.0', constraint: '^19', scope: 'runtime', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
      { name: 'vite', ecosystem: 'npm', version: '6.0.0', constraint: '^6', scope: 'dev', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
    ],
    analysisState: 'manifest-only',
  },
];

describe('EcosystemCard', () => {
  it('renders ecosystem label and counts', () => {
    render(<EcosystemCard ecosystem="npm" modules={mockModules} />);
    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText(/2 deps/)).toBeInTheDocument();
  });

  it('shows module count as large number', () => {
    render(<EcosystemCard ecosystem="npm" modules={mockModules} />);
    const bigNumber = screen.getByText('1');
    expect(bigNumber.className).toContain('font-bold');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(
      <EcosystemCard ecosystem="npm" modules={mockModules} onClick={onClick} />,
    );
    fireEvent.click(container.firstElementChild!);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
