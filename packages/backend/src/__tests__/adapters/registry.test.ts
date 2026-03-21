/**
 * Tests for adapter registry.
 */

import { describe, it, expect } from 'vitest';
import { createAdapterRegistry } from '../../adapters/registry.js';
import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryMeta } from '@deckgraph/shared';

function createMockAdapter(overrides: Partial<EcosystemAdapter> = {}): EcosystemAdapter {
  return {
    ecosystem: 'npm',
    manifestFiles: ['package.json'],
    sourceExtensions: ['.ts', '.js'],
    parseManifests: async (): Promise<ManifestResult> => ({
      moduleName: 'test',
      dependencies: [],
      hasLockFile: false,
      metadata: {},
    }),
    analyzeImports: (): readonly ParsedImport[] => [],
    queryRegistry: async (): Promise<RegistryMeta | null> => null,
    ...overrides,
  };
}

describe('createAdapterRegistry', () => {
  it('creates an empty registry', () => {
    const registry = createAdapterRegistry();
    expect(registry.getRegisteredEcosystems()).toEqual([]);
  });

  it('registers an adapter and retrieves it by manifest', () => {
    const registry = createAdapterRegistry();
    const adapter = createMockAdapter();
    registry.register(adapter);

    expect(registry.getAdapterForManifest('package.json')).toBe(adapter);
  });

  it('retrieves adapter by source extension', () => {
    const registry = createAdapterRegistry();
    const adapter = createMockAdapter();
    registry.register(adapter);

    expect(registry.getAdapterForExtension('.ts')).toBe(adapter);
    expect(registry.getAdapterForExtension('.js')).toBe(adapter);
  });

  it('returns null for unregistered manifest', () => {
    const registry = createAdapterRegistry();
    expect(registry.getAdapterForManifest('go.mod')).toBeNull();
  });

  it('returns null for unregistered extension', () => {
    const registry = createAdapterRegistry();
    expect(registry.getAdapterForExtension('.go')).toBeNull();
  });

  it('lists registered ecosystems', () => {
    const registry = createAdapterRegistry();
    registry.register(createMockAdapter({ ecosystem: 'npm' }));
    registry.register(createMockAdapter({
      ecosystem: 'go',
      manifestFiles: ['go.mod'],
      sourceExtensions: ['.go'],
    }));

    const ecosystems = registry.getRegisteredEcosystems();
    expect(ecosystems).toContain('npm');
    expect(ecosystems).toContain('go');
    expect(ecosystems).toHaveLength(2);
  });

  it('throws on duplicate ecosystem registration', () => {
    const registry = createAdapterRegistry();
    registry.register(createMockAdapter());

    expect(() => registry.register(createMockAdapter())).toThrow(
      "Adapter for ecosystem 'npm' is already registered",
    );
  });

  it('registers adapter with multiple manifest files', () => {
    const registry = createAdapterRegistry();
    const adapter = createMockAdapter({
      ecosystem: 'pypi',
      manifestFiles: ['pyproject.toml', 'requirements.txt', 'setup.py'],
      sourceExtensions: ['.py'],
    });
    registry.register(adapter);

    expect(registry.getAdapterForManifest('pyproject.toml')).toBe(adapter);
    expect(registry.getAdapterForManifest('requirements.txt')).toBe(adapter);
    expect(registry.getAdapterForManifest('setup.py')).toBe(adapter);
  });

  it('registers adapter with multiple source extensions', () => {
    const registry = createAdapterRegistry();
    const adapter = createMockAdapter({
      ecosystem: 'npm',
      sourceExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    });
    registry.register(adapter);

    expect(registry.getAdapterForExtension('.tsx')).toBe(adapter);
    expect(registry.getAdapterForExtension('.jsx')).toBe(adapter);
  });

  it('handles adapter with empty manifest and extension arrays', () => {
    const registry = createAdapterRegistry();
    const adapter = createMockAdapter({
      ecosystem: 'cargo',
      manifestFiles: [],
      sourceExtensions: [],
    });
    registry.register(adapter);

    expect(registry.getRegisteredEcosystems()).toContain('cargo');
    expect(registry.getAdapterForManifest('Cargo.toml')).toBeNull();
  });

  it('returns new array for getRegisteredEcosystems (no mutation)', () => {
    const registry = createAdapterRegistry();
    registry.register(createMockAdapter());

    const first = registry.getRegisteredEcosystems();
    const second = registry.getRegisteredEcosystems();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
