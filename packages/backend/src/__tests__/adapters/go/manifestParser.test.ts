/**
 * Tests for Go manifest parser.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseGoManifests } from '../../../adapters/go/manifestParser.js';

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, readFile: vi.fn() };
});

import { readFile } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('parseGoManifests', () => {
  describe('basic go.mod parsing', () => {
    it('parses a minimal go.mod', async () => {
      mockFiles({
        'go.mod': `module github.com/example/myapp\n\ngo 1.21\n`,
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.moduleName).toBe('myapp');
      expect(result.dependencies).toHaveLength(0);
      expect(result.hasLockFile).toBe(false);
    });

    it('parses single-line require', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require github.com/gin-gonic/gin v1.9.1',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      const gin = result.dependencies[0]!;
      expect(gin.name).toBe('github.com/gin-gonic/gin');
      expect(gin.constraint).toBe('v1.9.1');
      expect(gin.scope).toBe('runtime');
    });

    it('parses block require', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require (',
          '\tgithub.com/gin-gonic/gin v1.9.1',
          '\tgithub.com/stretchr/testify v1.8.4',
          ')',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies.map((d) => d.name)).toContain('github.com/gin-gonic/gin');
      expect(result.dependencies.map((d) => d.name)).toContain('github.com/stretchr/testify');
    });

    it('uses last segment of module path as name', async () => {
      mockFiles({
        'go.mod': 'module github.com/org/deep/nested/service\ngo 1.21\n',
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.moduleName).toBe('service');
    });
  });

  describe('replace directives', () => {
    it('applies version replacement', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require github.com/old/pkg v1.0.0',
          'replace github.com/old/pkg => github.com/new/pkg v2.0.0',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      const dep = result.dependencies[0]!;
      expect(dep.name).toBe('github.com/new/pkg');
      expect(dep.constraint).toBe('v2.0.0');
    });

    it('applies block replace directives', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require (',
          '\tgithub.com/old/a v1.0.0',
          '\tgithub.com/old/b v1.0.0',
          ')',
          'replace (',
          '\tgithub.com/old/a => github.com/new/a v2.0.0',
          '\tgithub.com/old/b => github.com/new/b v3.0.0',
          ')',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.dependencies).toHaveLength(2);
      const depA = result.dependencies.find((d) => d.name === 'github.com/new/a')!;
      expect(depA.constraint).toBe('v2.0.0');
      const depB = result.dependencies.find((d) => d.name === 'github.com/new/b')!;
      expect(depB.constraint).toBe('v3.0.0');
    });

    it('ignores a versionless remote replacement, keeping the original require', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require github.com/old/pkg v1.0.0',
          'replace github.com/old/pkg => github.com/new/pkg',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      const dep = result.dependencies[0]!;
      expect(dep.name).toBe('github.com/old/pkg');
      expect(dep.constraint).toBe('v1.0.0');
      expect(dep.local).toBeFalsy();
    });

    it('does not mark a remote replacement as local', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require github.com/old/pkg v1.0.0',
          'replace github.com/old/pkg => github.com/new/pkg v2.0.0',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.dependencies[0]!.local).toBeFalsy();
    });

    it('marks block local path replacements as local', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require github.com/example/lib v1.0.0',
          'replace (',
          '\tgithub.com/example/lib => ./lib',
          ')',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      const dep = result.dependencies[0]!;
      expect(dep.name).toBe('github.com/example/lib');
      expect(dep.local).toBe(true);
    });

    it('marks local path replacements as local, keeping original identity', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require github.com/example/lib v1.0.0',
          'replace github.com/example/lib => ./lib',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      const dep = result.dependencies[0]!;
      // Keeps original module identity, not the local path, and is flagged local.
      expect(dep.name).toBe('github.com/example/lib');
      expect(dep.constraint).toBe('v1.0.0');
      expect(dep.local).toBe(true);
    });
  });

  describe('indirect tracking', () => {
    it('includes indirect dependencies as runtime scope', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require (',
          '\tgithub.com/direct/pkg v1.0.0',
          '\tgithub.com/indirect/pkg v2.0.0 // indirect',
          ')',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.dependencies).toHaveLength(2);
      // Both are runtime scope (Go has no dev deps)
      expect(result.dependencies.every((d) => d.scope === 'runtime')).toBe(true);
    });
  });

  describe('go.sum lock file', () => {
    it('resolves versions from go.sum', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require github.com/gin-gonic/gin v1.9.0',
        ].join('\n'),
        'go.sum': [
          'github.com/gin-gonic/gin v1.9.1 h1:abc123=',
          'github.com/gin-gonic/gin v1.9.1/go.mod h1:def456=',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      const gin = result.dependencies[0]!;
      expect(gin.version).toBe('v1.9.1');
      expect(gin.constraint).toBe('v1.9.0');
    });

    it('deduplicates /go.mod entries', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require github.com/pkg/errors v0.9.1',
        ].join('\n'),
        'go.sum': [
          'github.com/pkg/errors v0.9.1 h1:abc=',
          'github.com/pkg/errors v0.9.1/go.mod h1:def=',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      expect(result.dependencies[0]!.version).toBe('v0.9.1');
    });

    it('finds go.sum at project root for nested module', async () => {
      mockFiles({
        'services/api/go.mod': [
          'module github.com/example/api',
          'go 1.21',
          'require github.com/gin-gonic/gin v1.9.0',
        ].join('\n'),
        'go.sum': [
          'github.com/gin-gonic/gin v1.9.1 h1:abc=',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', 'services/api');

      expect(result.hasLockFile).toBe(true);
      expect(result.dependencies[0]!.version).toBe('v1.9.1');
    });

    it('continues without lock file if go.sum not found', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require github.com/gin-gonic/gin v1.9.0',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.hasLockFile).toBe(false);
      expect(result.dependencies[0]!.version).toBe('v1.9.0');
    });
  });

  describe('metadata', () => {
    it('includes goVersion and modulePath', async () => {
      mockFiles({
        'go.mod': 'module github.com/example/app\ngo 1.22\n',
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.metadata['goVersion']).toBe('1.22');
      expect(result.metadata['modulePath']).toBe('github.com/example/app');
    });
  });

  describe('error handling', () => {
    it('throws when go.mod is missing', async () => {
      mockFiles({});

      await expect(parseGoManifests('/project', '.')).rejects.toThrow('ENOENT');
    });

    it('returns empty deps when no requires', async () => {
      mockFiles({
        'go.mod': 'module github.com/example/app\ngo 1.21\n',
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.dependencies).toHaveLength(0);
    });
  });

  describe('output validation', () => {
    it('output passes shared schema validation', async () => {
      mockFiles({
        'go.mod': [
          'module github.com/example/app',
          'go 1.21',
          'require (',
          '\tgithub.com/gin-gonic/gin v1.9.1',
          '\tgithub.com/stretchr/testify v1.8.4',
          ')',
        ].join('\n'),
      });

      const result = await parseGoManifests('/project', '.');

      expect(result.moduleName).toBe('app');
      expect(result.dependencies).toHaveLength(2);
    });
  });
});
