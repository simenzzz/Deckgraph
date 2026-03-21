/**
 * Single source of truth for ecosystem labels, icons, and colors.
 *
 * Import this instead of duplicating ecosystem maps across components.
 */

import type { Ecosystem } from '@deckgraph/shared';
import { Package, Code2, Cog, Terminal, Coffee } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface EcosystemConfig {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly colorClass: string;
  readonly badgeClass: string;
}

export const ECOSYSTEM_CONFIG: Readonly<Record<Ecosystem, EcosystemConfig>> = {
  npm: {
    label: 'npm',
    icon: Package,
    colorClass: 'text-ecosystem-npm',
    badgeClass: 'bg-ecosystem-npm/15 text-ecosystem-npm border-ecosystem-npm/30',
  },
  pypi: {
    label: 'PyPI',
    icon: Code2,
    colorClass: 'text-ecosystem-pypi',
    badgeClass: 'bg-ecosystem-pypi/15 text-ecosystem-pypi border-ecosystem-pypi/30',
  },
  cargo: {
    label: 'Cargo',
    icon: Cog,
    colorClass: 'text-ecosystem-cargo',
    badgeClass: 'bg-ecosystem-cargo/15 text-ecosystem-cargo border-ecosystem-cargo/30',
  },
  go: {
    label: 'Go',
    icon: Terminal,
    colorClass: 'text-ecosystem-go',
    badgeClass: 'bg-ecosystem-go/15 text-ecosystem-go border-ecosystem-go/30',
  },
  maven: {
    label: 'Maven',
    icon: Coffee,
    colorClass: 'text-ecosystem-maven',
    badgeClass: 'bg-ecosystem-maven/15 text-ecosystem-maven border-ecosystem-maven/30',
  },
};

/** All ecosystems in display order. */
export const ALL_ECOSYSTEMS: readonly Ecosystem[] = ['npm', 'pypi', 'cargo', 'go', 'maven'];
