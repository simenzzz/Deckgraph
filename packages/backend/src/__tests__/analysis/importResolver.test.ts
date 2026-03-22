/**
 * Tests for import resolver orchestration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AdapterRegistry,
  EcosystemAdapter,
  ImportPackageMap,
  Module,
  ParsedImport,
} from '@deckgraph/shared';
import { resolveImports } from '../../analysis/importResolver.js';

// Mock fast-glob and fs
vi.mock('fast-glob', () => ({
  default: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';

const mockGlob = vi.mocked(fg);
const mockReadFile = vi.mocked(readFile);

function createMockAdapter(
  imports: readonly ParsedImport[] = [],
): EcosystemAdapter {
  return {
    ecosystem: 'npm',
    manifestFiles: ['package.json'],
    sourceExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    parseManifests: vi.fn(),
    analyzeImports: vi.fn().mockReturnValue(imports),
    queryRegistry: vi.fn().mockResolvedValue(null),
  };
}

function createMockRegistry(adapter: EcosystemAdapter): AdapterRegistry {
  return {
    register: vi.fn(),
    getAdapterForManifest: vi.fn().mockReturnValue(null),
    getAdapterForExtension: vi.fn().mockReturnValue(null),
    getAdapterForEcosystem: vi.fn().mockReturnValue(adapter),
    getRegisteredEcosystems: vi.fn().mockReturnValue(['npm']),
  };
}

function createMockPackageMap(): ImportPackageMap {
  return {
    resolvePackageName: vi.fn().mockReturnValue(null),
  };
}

function createTestModule(overrides: Partial<Module> = {}): Module {
  return {
    path: 'packages/app',
    name: 'my-app',
    ecosystem: 'npm',
    manifests: ['package.json'],
    dependencies: [
      {
        name: 'react',
        ecosystem: 'npm',
        version: '18.2.0',
        constraint: '^18.0.0',
        scope: 'runtime',
        source: 'manifest',
        concerns: [],
        usedInFiles: null,
        transitiveDeps: null,
        registryMeta: null,
      },
      {
        name: 'lodash',
        ecosystem: 'npm',
        version: '4.17.21',
        constraint: '^4.17.0',
        scope: 'runtime',
        source: 'manifest',
        concerns: [],
        usedInFiles: null,
        transitiveDeps: null,
        registryMeta: null,
      },
    ],
    analysisState: 'manifest-only',
    ...overrides,
  };
}

describe('resolveImports', () => {
  let adapter: EcosystemAdapter;
  let registry: AdapterRegistry;
  let packageMap: ImportPackageMap;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockAdapter();
    registry = createMockRegistry(adapter);
    packageMap = createMockPackageMap();

    // Default: no source files found
    mockGlob.mockResolvedValue([]);
  });

  it('returns module with imports-resolved state', async () => {
    const module = createTestModule();
    mockGlob.mockResolvedValue([]);

    const result = await resolveImports('/project', module, registry, packageMap);

    expect(result.updatedModule.analysisState).toBe('imports-resolved');
  });

  it('does not mutate original module', async () => {
    const module = createTestModule();
    mockGlob.mockResolvedValue([]);

    const result = await resolveImports('/project', module, registry, packageMap);

    expect(result.updatedModule).not.toBe(module);
    expect(module.analysisState).toBe('manifest-only');
  });

  it('detects used dependencies', async () => {
    const reactImport: ParsedImport = {
      source: 'react',
      specifiers: ['default'],
      isThirdParty: true,
      line: 1,
    };

    adapter = createMockAdapter([reactImport]);
    registry = createMockRegistry(adapter);

    mockGlob.mockResolvedValue(['/project/packages/app/src/index.ts']);
    mockReadFile.mockResolvedValue(`import React from 'react';`);

    const module = createTestModule();
    const result = await resolveImports('/project', module, registry, packageMap);

    const reactDep = result.updatedModule.dependencies.find(
      (d) => d.name === 'react',
    );
    expect(reactDep!.usedInFiles).toEqual(['packages/app/src/index.ts']);
    expect(reactDep!.source).toBe('both');
  });

  it('detects unused dependencies', async () => {
    // No imports at all
    adapter = createMockAdapter([]);
    registry = createMockRegistry(adapter);

    mockGlob.mockResolvedValue(['/project/packages/app/src/index.ts']);
    mockReadFile.mockResolvedValue('// empty file');

    const module = createTestModule();
    const result = await resolveImports('/project', module, registry, packageMap);

    expect(result.unusedDeps).toContain('react');
    expect(result.unusedDeps).toContain('lodash');
  });

  it('detects import-only dependencies', async () => {
    const chalkImport: ParsedImport = {
      source: 'chalk',
      specifiers: ['default'],
      isThirdParty: true,
      line: 1,
    };

    adapter = createMockAdapter([chalkImport]);
    registry = createMockRegistry(adapter);

    mockGlob.mockResolvedValue(['/project/packages/app/src/index.ts']);
    mockReadFile.mockResolvedValue(`import chalk from 'chalk';`);

    const module = createTestModule();
    const result = await resolveImports('/project', module, registry, packageMap);

    expect(result.importOnlyDeps).toContain('chalk');

    const chalkDep = result.updatedModule.dependencies.find(
      (d) => d.name === 'chalk',
    );
    expect(chalkDep).toBeDefined();
    expect(chalkDep!.source).toBe('import-only');
    expect(chalkDep!.version).toBe('unknown');
  });

  it('resolves deep npm imports to package names', async () => {
    const deepImport: ParsedImport = {
      source: 'lodash/get',
      specifiers: ['default'],
      isThirdParty: true,
      line: 1,
    };

    adapter = createMockAdapter([deepImport]);
    registry = createMockRegistry(adapter);

    mockGlob.mockResolvedValue(['/project/packages/app/src/index.ts']);
    mockReadFile.mockResolvedValue(`import get from 'lodash/get';`);

    const module = createTestModule();
    const result = await resolveImports('/project', module, registry, packageMap);

    const lodashDep = result.updatedModule.dependencies.find(
      (d) => d.name === 'lodash',
    );
    expect(lodashDep!.usedInFiles).toEqual(['packages/app/src/index.ts']);
  });

  it('uses ImportPackageMap for known mismatches', async () => {
    const customMap: ImportPackageMap = {
      resolvePackageName: vi.fn((src: string) => {
        if (src === 'PIL') return 'Pillow';
        return null;
      }),
    };

    const pilImport: ParsedImport = {
      source: 'PIL',
      specifiers: ['Image'],
      isThirdParty: true,
      line: 1,
    };

    adapter = createMockAdapter([pilImport]);
    (adapter as any).ecosystem = 'pypi';
    registry = createMockRegistry(adapter);

    mockGlob.mockResolvedValue(['/project/packages/app/src/main.py']);
    mockReadFile.mockResolvedValue(`from PIL import Image`);

    const module = createTestModule({ ecosystem: 'pypi' });
    const result = await resolveImports('/project', module, registry, customMap);

    expect(customMap.resolvePackageName).toHaveBeenCalledWith('PIL', 'pypi');
  });

  it('throws when no adapter found for ecosystem', async () => {
    const emptyRegistry: AdapterRegistry = {
      register: vi.fn(),
      getAdapterForManifest: vi.fn().mockReturnValue(null),
      getAdapterForExtension: vi.fn().mockReturnValue(null),
      getAdapterForEcosystem: vi.fn().mockReturnValue(null),
      getRegisteredEcosystems: vi.fn().mockReturnValue([]),
    };

    const module = createTestModule();

    await expect(
      resolveImports('/project', module, emptyRegistry, packageMap),
    ).rejects.toThrow("No adapter registered for ecosystem 'npm'");
  });

  it('handles files that fail to read', async () => {
    adapter = createMockAdapter([]);
    registry = createMockRegistry(adapter);

    mockGlob.mockResolvedValue(['/project/packages/app/src/broken.ts']);
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const module = createTestModule();
    const result = await resolveImports('/project', module, registry, packageMap);

    // Should not crash, module is still returned
    expect(result.updatedModule.analysisState).toBe('imports-resolved');
  });

  it('aggregates usage across multiple files', async () => {
    const reactImport: ParsedImport = {
      source: 'react',
      specifiers: ['default'],
      isThirdParty: true,
      line: 1,
    };

    adapter = createMockAdapter([reactImport]);
    registry = createMockRegistry(adapter);

    mockGlob.mockResolvedValue([
      '/project/packages/app/src/index.ts',
      '/project/packages/app/src/App.tsx',
    ]);
    mockReadFile.mockResolvedValue(`import React from 'react';`);

    const module = createTestModule();
    const result = await resolveImports('/project', module, registry, packageMap);

    const reactDep = result.updatedModule.dependencies.find(
      (d) => d.name === 'react',
    );
    expect(reactDep!.usedInFiles).toHaveLength(2);
    expect(reactDep!.usedInFiles).toContain('packages/app/src/index.ts');
    expect(reactDep!.usedInFiles).toContain('packages/app/src/App.tsx');
  });

  it('sets empty usedInFiles for unused deps (not null)', async () => {
    adapter = createMockAdapter([]);
    registry = createMockRegistry(adapter);
    mockGlob.mockResolvedValue([]);

    const module = createTestModule();
    const result = await resolveImports('/project', module, registry, packageMap);

    for (const dep of result.updatedModule.dependencies) {
      expect(dep.usedInFiles).toEqual([]);
    }
  });
});
