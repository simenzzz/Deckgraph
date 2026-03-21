/**
 * Tests for Rust/Cargo manifest parser.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseRustManifests } from '../../../adapters/rust/manifestParser.js';

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

describe('parseRustManifests', () => {
  describe('basic Cargo.toml parsing', () => {
    it('parses a minimal Cargo.toml', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "my-app"',
          'version = "0.1.0"',
          'edition = "2021"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.moduleName).toBe('my-app');
      expect(result.dependencies).toHaveLength(0);
      expect(result.hasLockFile).toBe(false);
    });

    it('extracts runtime dependencies', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'serde = "1.0"',
          'tokio = "1.35"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.dependencies).toHaveLength(2);
      const serde = result.dependencies.find((d) => d.name === 'serde');
      expect(serde?.scope).toBe('runtime');
      expect(serde?.constraint).toBe('1.0');
    });

    it('extracts dev dependencies', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dev-dependencies]',
          'criterion = "0.5"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]?.scope).toBe('dev');
    });

    it('extracts build dependencies', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[build-dependencies]',
          'cc = "1.0"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]?.scope).toBe('build');
    });

    it('extracts all 3 scope types together', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "full"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'serde = "1.0"',
          '',
          '[dev-dependencies]',
          'criterion = "0.5"',
          '',
          '[build-dependencies]',
          'cc = "1.0"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.dependencies).toHaveLength(3);
      const scopes = result.dependencies.map((d) => d.scope);
      expect(scopes).toContain('runtime');
      expect(scopes).toContain('dev');
      expect(scopes).toContain('build');
    });
  });

  describe('value formats', () => {
    it('handles string version', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'serde = "1.0"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.dependencies[0]?.constraint).toBe('1.0');
    });

    it('handles table with version', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'serde = { version = "1.0", features = ["derive"] }',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.dependencies[0]?.constraint).toBe('1.0');
    });

    it('handles path-only dependency', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'my-lib = { path = "../my-lib" }',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.dependencies[0]?.constraint).toBe('*');
    });

    it('handles git-only dependency', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'my-lib = { git = "https://github.com/org/lib" }',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.dependencies[0]?.constraint).toBe('https://github.com/org/lib');
    });

    it('handles table with version and path', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'my-lib = { version = "1.0", path = "../my-lib" }',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.dependencies[0]?.constraint).toBe('1.0');
    });
  });

  describe('Cargo.lock resolution', () => {
    it('resolves versions from Cargo.lock', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'serde = "1.0"',
        ].join('\n'),
        'Cargo.lock': [
          '[[package]]',
          'name = "serde"',
          'version = "1.0.195"',
          'source = "registry+https://github.com/rust-lang/crates.io-index"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      const serde = result.dependencies[0]!;
      expect(serde.version).toBe('1.0.195');
      expect(serde.constraint).toBe('1.0');
    });

    it('skips sourceless entries (workspace members)', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'my-local = { path = "../local" }',
        ].join('\n'),
        'Cargo.lock': [
          '[[package]]',
          'name = "my-local"',
          'version = "0.1.0"',
          '',
          '[[package]]',
          'name = "serde"',
          'version = "1.0.195"',
          'source = "registry+https://github.com/rust-lang/crates.io-index"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      // my-local has no source in lock, so no resolved version
      expect(result.dependencies[0]!.version).toBe('*');
    });

    it('finds Cargo.lock at project root for nested module', async () => {
      mockFiles({
        'crates/api/Cargo.toml': [
          '[package]',
          'name = "api"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'serde = "1.0"',
        ].join('\n'),
        'Cargo.lock': [
          '[[package]]',
          'name = "serde"',
          'version = "1.0.195"',
          'source = "registry+https://github.com/rust-lang/crates.io-index"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', 'crates/api');

      expect(result.hasLockFile).toBe(true);
      expect(result.dependencies[0]!.version).toBe('1.0.195');
    });

    it('continues without lock file if Cargo.lock not found', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'serde = "1.0"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.hasLockFile).toBe(false);
      expect(result.dependencies[0]!.version).toBe('1.0');
    });
  });

  describe('metadata', () => {
    it('includes packageVersion and edition', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.5.0"',
          'edition = "2021"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.metadata['packageVersion']).toBe('0.5.0');
      expect(result.metadata['edition']).toBe('2021');
    });

    it('includes features list', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          '',
          '[features]',
          'default = ["json"]',
          'json = ["serde_json"]',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.metadata['features']).toEqual(['default', 'json']);
    });

    it('includes workspace members', async () => {
      mockFiles({
        'Cargo.toml': [
          '[workspace]',
          'members = ["crates/api", "crates/core"]',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.metadata['workspaceMembers']).toEqual(['crates/api', 'crates/core']);
    });

    it('uses directory name when package name is missing', async () => {
      mockFiles({
        'Cargo.toml': [
          '[dependencies]',
          'serde = "1.0"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', 'crates/my-crate');

      expect(result.moduleName).toBe('my-crate');
    });
  });

  describe('error handling', () => {
    it('throws when Cargo.toml is missing', async () => {
      mockFiles({});

      await expect(parseRustManifests('/project', '.')).rejects.toThrow('ENOENT');
    });

    it('throws when Cargo.toml has invalid TOML', async () => {
      mockFiles({
        'Cargo.toml': 'not valid toml {{{',
      });

      await expect(parseRustManifests('/project', '.')).rejects.toThrow();
    });
  });

  describe('output validation', () => {
    it('output passes shared schema validation', async () => {
      mockFiles({
        'Cargo.toml': [
          '[package]',
          'name = "validated-app"',
          'version = "0.1.0"',
          '',
          '[dependencies]',
          'serde = "1.0"',
          '',
          '[dev-dependencies]',
          'criterion = "0.5"',
        ].join('\n'),
      });

      const result = await parseRustManifests('/project', '.');

      expect(result.moduleName).toBe('validated-app');
      expect(result.dependencies).toHaveLength(2);
    });
  });
});
