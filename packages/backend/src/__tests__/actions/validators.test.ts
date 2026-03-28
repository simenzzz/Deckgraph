import { describe, it, expect } from 'vitest';
import type { Module } from '@deckgraph/shared';
import {
  validateUpdateRequest,
  validateInstallRequest,
  validateRemoveRequest,
  validateEcosystem,
} from '../../actions/validators.js';

const mockModule: Module = {
  path: 'packages/app',
  name: 'app',
  ecosystem: 'npm',
  manifests: ['package.json'],
  dependencies: [
    {
      name: 'react',
      ecosystem: 'npm',
      version: '18.0.0',
      constraint: '^18',
      scope: 'runtime',
      source: 'manifest',
      concerns: [],
      usedInFiles: null,
      transitiveDeps: null,
      registryMeta: null,
    },
    {
      name: 'vitest',
      ecosystem: 'npm',
      version: '2.0.0',
      constraint: '^2',
      scope: 'dev',
      source: 'manifest',
      concerns: ['testing'],
      usedInFiles: null,
      transitiveDeps: null,
      registryMeta: null,
    },
  ],
  analysisState: 'manifest-only',
};

describe('validateUpdateRequest', () => {
  it('passes for valid update', () => {
    const result = validateUpdateRequest(mockModule, 'react', '19.0.0');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('rejects invalid version format', () => {
    const result = validateUpdateRequest(mockModule, 'react', 'rm -rf /');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid version');
  });

  it('rejects empty version', () => {
    const result = validateUpdateRequest(mockModule, 'react', '');
    expect(result.valid).toBe(false);
  });

  it('rejects shell metacharacters in version', () => {
    const result = validateUpdateRequest(mockModule, 'react', '1.0.0; echo pwned');
    expect(result.valid).toBe(false);
  });

  it('rejects invalid package name characters', () => {
    const result = validateUpdateRequest(mockModule, 'react; echo pwned', '19.0.0');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid package name');
  });

  it('accepts scoped npm package names', () => {
    const modWithScoped: Module = {
      ...mockModule,
      dependencies: [
        ...mockModule.dependencies,
        {
          name: '@babel/core',
          ecosystem: 'npm',
          version: '7.0.0',
          constraint: '^7',
          scope: 'dev',
          source: 'manifest',
          concerns: [],
          usedInFiles: null,
          transitiveDeps: null,
          registryMeta: null,
        },
      ],
    };
    const result = validateUpdateRequest(modWithScoped, '@babel/core', '7.1.0');
    expect(result.valid).toBe(true);
  });

  it('accepts maven-style package names with colons', () => {
    const modWithMaven: Module = {
      ...mockModule,
      ecosystem: 'maven',
      dependencies: [
        {
          name: 'org.apache:commons-lang3',
          ecosystem: 'maven',
          version: '3.12.0',
          constraint: '3.12.0',
          scope: 'runtime',
          source: 'manifest',
          concerns: [],
          usedInFiles: null,
          transitiveDeps: null,
          registryMeta: null,
        },
      ],
    };
    const result = validateUpdateRequest(modWithMaven, 'org.apache:commons-lang3', '3.13.0');
    expect(result.valid).toBe(true);
  });

  it('rejects package not in module', () => {
    const result = validateUpdateRequest(mockModule, 'nonexistent', '1.0.0');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects same version', () => {
    const result = validateUpdateRequest(mockModule, 'react', '18.0.0');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already at version');
  });
});

describe('validateInstallRequest', () => {
  it('rejects invalid package name', () => {
    const result = validateInstallRequest(mockModule, '$(rm -rf /)', '1.0.0');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid package name');
  });

  it('passes for new package', () => {
    const result = validateInstallRequest(mockModule, 'lodash', '4.17.0');
    expect(result.valid).toBe(true);
  });

  it('passes with null version (latest)', () => {
    const result = validateInstallRequest(mockModule, 'lodash', null);
    expect(result.valid).toBe(true);
  });

  it('rejects already installed package', () => {
    const result = validateInstallRequest(mockModule, 'react', '18.0.0');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already installed');
  });

  it('rejects invalid version format', () => {
    const result = validateInstallRequest(mockModule, 'lodash', '$(cmd)');
    expect(result.valid).toBe(false);
  });
});

describe('validateRemoveRequest', () => {
  it('rejects invalid package name', () => {
    const result = validateRemoveRequest(mockModule, 'pkg && rm -rf /');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid package name');
  });

  it('passes for existing package', () => {
    const result = validateRemoveRequest(mockModule, 'react');
    expect(result.valid).toBe(true);
  });

  it('rejects package not in module', () => {
    const result = validateRemoveRequest(mockModule, 'nonexistent');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('validateEcosystem', () => {
  const supported = new Set(['npm', 'pypi', 'go', 'cargo', 'maven'] as const);

  it('passes for supported ecosystem', () => {
    const result = validateEcosystem('npm', supported);
    expect(result.valid).toBe(true);
  });

  it('provides list of supported ecosystems on failure', () => {
    // Create a limited set to test the error message
    const limited = new Set(['npm', 'pypi'] as const);
    const result = validateEcosystem('cargo', limited);
    expect(result.valid).toBe(false);
    expect(result.suggestion).toContain('npm');
    expect(result.suggestion).toContain('pypi');
  });
});
