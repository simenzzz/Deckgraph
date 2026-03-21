/**
 * Tests for JS/TS manifest parser.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseJsManifests } from '../../../adapters/javascript/manifestParser.js';

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, readFile: vi.fn() };
});

import { readFile } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Helper to set up mock file reads for a given module.
 */
function mockFiles(files: Record<string, string | null>): void {
  mockReadFile.mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
    const pathStr = typeof path === 'string' ? path : path.toString();
    for (const [filePath, content] of Object.entries(files)) {
      if (pathStr.endsWith(filePath) || pathStr === filePath) {
        if (content === null) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return content;
      }
    }
    throw Object.assign(new Error(`ENOENT: ${pathStr}`), { code: 'ENOENT' });
  });
}

describe('parseJsManifests', () => {
  describe('basic package.json parsing', () => {
    it('parses a minimal package.json', async () => {
      mockFiles({
        'package.json': JSON.stringify({ name: 'my-app', version: '1.0.0' }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.moduleName).toBe('my-app');
      expect(result.dependencies).toHaveLength(0);
      expect(result.hasLockFile).toBe(false);
    });

    it('uses directory name when package name is missing', async () => {
      mockFiles({
        'package.json': JSON.stringify({ version: '1.0.0' }),
      });

      const result = await parseJsManifests('/project', 'packages/my-lib');

      expect(result.moduleName).toBe('my-lib');
    });

    it('extracts runtime dependencies', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { react: '^18.2.0', lodash: '4.17.21' },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.dependencies).toHaveLength(2);
      const react = result.dependencies.find((d) => d.name === 'react');
      expect(react?.scope).toBe('runtime');
      expect(react?.constraint).toBe('^18.2.0');
      // No lock file → version falls back to constraint
      expect(react?.version).toBe('^18.2.0');
    });

    it('extracts dev dependencies', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          devDependencies: { vitest: '^2.0.0' },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]?.scope).toBe('dev');
    });

    it('extracts peer dependencies', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'lib',
          peerDependencies: { react: '>=18' },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.dependencies[0]?.scope).toBe('peer');
    });

    it('extracts optional dependencies', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'lib',
          optionalDependencies: { fsevents: '^2.3.0' },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.dependencies[0]?.scope).toBe('optional');
    });

    it('extracts all 4 scope types together', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'full',
          dependencies: { react: '^18.0.0' },
          devDependencies: { vitest: '^2.0.0' },
          peerDependencies: { vue: '>=3' },
          optionalDependencies: { fsevents: '^2.3.0' },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.dependencies).toHaveLength(4);
      const scopes = result.dependencies.map((d) => d.scope);
      expect(scopes).toContain('runtime');
      expect(scopes).toContain('dev');
      expect(scopes).toContain('peer');
      expect(scopes).toContain('optional');
    });
  });

  describe('workspace filtering', () => {
    it('filters out workspace:* references', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: {
            react: '^18.0.0',
            '@myorg/shared': 'workspace:*',
            '@myorg/utils': 'workspace:^',
          },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]?.name).toBe('react');
    });
  });

  describe('pnpm-lock.yaml resolution', () => {
    it('resolves versions from pnpm-lock.yaml', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { react: '^18.0.0' },
        }),
        'pnpm-lock.yaml': `
lockfileVersion: '9.0'
packages:
  /react@18.2.0:
    version: '18.2.0'
`,
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      const react = result.dependencies.find((d) => d.name === 'react');
      expect(react?.version).toBe('18.2.0');
      expect(react?.constraint).toBe('^18.0.0');
    });

    it('resolves scoped packages from pnpm-lock.yaml', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { '@babel/core': '^7.24.0' },
        }),
        'pnpm-lock.yaml': `
lockfileVersion: '9.0'
packages:
  /@babel/core@7.24.5:
    version: '7.24.5'
`,
      });

      const result = await parseJsManifests('/project', '.');

      const babel = result.dependencies.find((d) => d.name === '@babel/core');
      expect(babel?.version).toBe('7.24.5');
    });

    it('falls back to key version when version field is missing in pnpm lock', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { react: '^18.0.0' },
        }),
        'pnpm-lock.yaml': `
lockfileVersion: '9.0'
packages:
  /react@18.2.0: {}
`,
      });

      const result = await parseJsManifests('/project', '.');

      const react = result.dependencies.find((d) => d.name === 'react');
      expect(react?.version).toBe('18.2.0');
    });
  });

  describe('package-lock.json resolution', () => {
    it('resolves versions from package-lock.json v3', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { express: '^4.18.0' },
        }),
        'package-lock.json': JSON.stringify({
          lockfileVersion: 3,
          packages: {
            'node_modules/express': { version: '4.18.2' },
          },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      const express = result.dependencies.find((d) => d.name === 'express');
      expect(express?.version).toBe('4.18.2');
    });

    it('resolves scoped packages from package-lock.json', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { '@types/node': '^22.0.0' },
        }),
        'package-lock.json': JSON.stringify({
          lockfileVersion: 3,
          packages: {
            'node_modules/@types/node': { version: '22.10.5' },
          },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      const typesNode = result.dependencies.find((d) => d.name === '@types/node');
      expect(typesNode?.version).toBe('22.10.5');
    });
  });

  describe('lock file at project root for nested module', () => {
    it('finds pnpm-lock.yaml at project root when module is in subdirectory', async () => {
      mockFiles({
        'packages/app/package.json': JSON.stringify({
          name: 'nested-app',
          dependencies: { react: '^18.0.0' },
        }),
        'pnpm-lock.yaml': `
lockfileVersion: '9.0'
packages:
  /react@18.2.0:
    version: '18.2.0'
`,
      });

      const result = await parseJsManifests('/project', 'packages/app');

      expect(result.hasLockFile).toBe(true);
      const react = result.dependencies.find((d) => d.name === 'react');
      expect(react?.version).toBe('18.2.0');
    });
  });

  describe('lock file priority', () => {
    it('prefers pnpm-lock.yaml over package-lock.json', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { react: '^18.0.0' },
        }),
        'pnpm-lock.yaml': `
lockfileVersion: '9.0'
packages:
  /react@18.2.0:
    version: '18.2.0'
`,
        'package-lock.json': JSON.stringify({
          lockfileVersion: 3,
          packages: {
            'node_modules/react': { version: '18.3.0' },
          },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      const react = result.dependencies.find((d) => d.name === 'react');
      expect(react?.version).toBe('18.2.0');
    });
  });

  describe('graceful degradation', () => {
    it('continues without lock file if none found', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { react: '^18.0.0' },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.hasLockFile).toBe(false);
      expect(result.dependencies[0]?.version).toBe('^18.0.0');
    });

    it('continues if pnpm-lock.yaml is malformed', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { react: '^18.0.0' },
        }),
        'pnpm-lock.yaml': 'not: valid: lock: file: format',
      });

      const result = await parseJsManifests('/project', '.');

      // Should fall through to no lock file
      expect(result.hasLockFile).toBe(false);
    });

    it('continues without lock file if package-lock.json fails Zod validation', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { react: '^18.0.0' },
        }),
        'package-lock.json': JSON.stringify({ notLockfileVersion: true }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.hasLockFile).toBe(false);
      expect(result.dependencies[0]?.version).toBe('^18.0.0');
    });

    it('continues without lock file if package-lock.json is not valid JSON', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { react: '^18.0.0' },
        }),
        'package-lock.json': 'not-json{{',
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.hasLockFile).toBe(false);
      expect(result.dependencies[0]?.version).toBe('^18.0.0');
    });

    it('warns but parses pnpm-lock.yaml with non-v9 lockfileVersion', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { react: '^18.0.0' },
        }),
        'pnpm-lock.yaml': `
lockfileVersion: '6.0'
packages:
  /react@18.2.0:
    version: '18.2.0'
`,
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      const react = result.dependencies.find((d) => d.name === 'react');
      expect(react?.version).toBe('18.2.0');
    });
  });

  describe('metadata extraction', () => {
    it('includes version in metadata', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          version: '2.0.0',
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.metadata['packageVersion']).toBe('2.0.0');
    });

    it('includes script names in metadata', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'app',
          scripts: { build: 'tsc', test: 'vitest' },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.metadata['scripts']).toEqual(['build', 'test']);
    });

    it('includes workspace patterns in metadata', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'monorepo',
          workspaces: ['packages/*'],
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.metadata['workspaces']).toEqual(['packages/*']);
    });

    it('handles workspaces object format', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'monorepo',
          workspaces: { packages: ['packages/*'] },
        }),
      });

      const result = await parseJsManifests('/project', '.');

      expect(result.metadata['workspaces']).toEqual(['packages/*']);
    });
  });

  describe('error handling', () => {
    it('throws when package.json is missing', async () => {
      mockFiles({});

      await expect(parseJsManifests('/project', '.')).rejects.toThrow('ENOENT');
    });

    it('throws when package.json contains invalid JSON', async () => {
      mockFiles({
        'package.json': 'not-json{{{',
      });

      await expect(parseJsManifests('/project', '.')).rejects.toThrow();
    });
  });

  describe('output validation', () => {
    it('output passes shared schema validation', async () => {
      mockFiles({
        'package.json': JSON.stringify({
          name: 'validated-app',
          dependencies: { react: '^18.0.0' },
          devDependencies: { vitest: '^2.0.0' },
        }),
      });

      // parseJsManifests calls parseManifestResult internally
      // If validation fails, this would throw a ZodError
      const result = await parseJsManifests('/project', '.');

      expect(result.moduleName).toBe('validated-app');
      expect(result.dependencies).toHaveLength(2);
    });
  });
});
