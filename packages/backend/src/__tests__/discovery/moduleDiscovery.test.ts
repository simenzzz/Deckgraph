/**
 * Tests for module discovery.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { discoverModules } from '../../discovery/moduleDiscovery.js';

vi.mock('fast-glob', () => ({
  default: vi.fn(),
}));

import fg from 'fast-glob';

const mockFg = vi.mocked(fg);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discoverModules', () => {
  it('discovers a single npm module', async () => {
    mockFg.mockResolvedValue(['packages/app/package.json']);

    const modules = await discoverModules('/project', null);

    expect(modules).toHaveLength(1);
    expect(modules[0]).toEqual({
      path: 'packages/app',
      manifests: ['package.json'],
      ecosystem: 'npm',
    });
  });

  it('discovers multiple modules in different ecosystems', async () => {
    mockFg.mockResolvedValue([
      'frontend/package.json',
      'backend/go.mod',
      'lib/Cargo.toml',
    ]);

    const modules = await discoverModules('/project', null);

    expect(modules).toHaveLength(3);
    // Sorted by path
    expect(modules[0]?.path).toBe('backend');
    expect(modules[0]?.ecosystem).toBe('go');
    expect(modules[1]?.path).toBe('frontend');
    expect(modules[1]?.ecosystem).toBe('npm');
    expect(modules[2]?.path).toBe('lib');
    expect(modules[2]?.ecosystem).toBe('cargo');
  });

  it('groups multiple manifests in the same directory', async () => {
    mockFg.mockResolvedValue([
      'services/api/package.json',
      'services/api/pyproject.toml',
    ]);

    const modules = await discoverModules('/project', null);

    expect(modules).toHaveLength(1);
    expect(modules[0]?.manifests).toContain('package.json');
    expect(modules[0]?.manifests).toContain('pyproject.toml');
    // npm has higher priority than pypi
    expect(modules[0]?.ecosystem).toBe('npm');
  });

  it('returns empty array when no manifests found', async () => {
    mockFg.mockResolvedValue([]);

    const modules = await discoverModules('/project', null);

    expect(modules).toHaveLength(0);
  });

  it('passes default ignore patterns to fast-glob', async () => {
    mockFg.mockResolvedValue([]);

    await discoverModules('/project', null);

    expect(mockFg).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        ignore: expect.arrayContaining([
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
        ]),
      }),
    );
  });

  it('merges user ignore paths with defaults', async () => {
    mockFg.mockResolvedValue([]);
    const config = {
      ignorePaths: ['custom-vendor', 'tmp'],
      concernOverrides: {},
    };

    await discoverModules('/project', config);

    expect(mockFg).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        ignore: expect.arrayContaining([
          '**/node_modules/**',
          '**/custom-vendor/**',
          '**/tmp/**',
        ]),
      }),
    );
  });

  it('preserves glob patterns in user ignore paths', async () => {
    mockFg.mockResolvedValue([]);
    const config = {
      ignorePaths: ['**/generated/**'],
      concernOverrides: {},
    };

    await discoverModules('/project', config);

    expect(mockFg).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        ignore: expect.arrayContaining(['**/generated/**']),
      }),
    );
  });

  it('sorts modules by path', async () => {
    mockFg.mockResolvedValue([
      'z-last/package.json',
      'a-first/package.json',
      'm-middle/package.json',
    ]);

    const modules = await discoverModules('/project', null);

    expect(modules.map((m) => m.path)).toEqual([
      'a-first',
      'm-middle',
      'z-last',
    ]);
  });

  it('handles root-level manifest', async () => {
    mockFg.mockResolvedValue(['package.json']);

    const modules = await discoverModules('/project', null);

    expect(modules).toHaveLength(1);
    expect(modules[0]?.path).toBe('.');
    expect(modules[0]?.ecosystem).toBe('npm');
  });

  it('picks npm over pypi when both exist in same directory', async () => {
    mockFg.mockResolvedValue([
      'hybrid/package.json',
      'hybrid/requirements.txt',
    ]);

    const modules = await discoverModules('/project', null);

    expect(modules[0]?.ecosystem).toBe('npm');
  });

  it('uses fast-glob with correct options', async () => {
    mockFg.mockResolvedValue([]);

    await discoverModules('/project', null);

    expect(mockFg).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cwd: '/project',
        dot: false,
        onlyFiles: true,
        followSymbolicLinks: false,
      }),
    );
  });

  it('handles deeply nested modules', async () => {
    mockFg.mockResolvedValue([
      'a/b/c/d/package.json',
    ]);

    const modules = await discoverModules('/project', null);

    expect(modules).toHaveLength(1);
    expect(modules[0]?.path).toBe('a/b/c/d');
  });

  it('discovers Java/Maven modules', async () => {
    mockFg.mockResolvedValue([
      'java-service/pom.xml',
    ]);

    const modules = await discoverModules('/project', null);

    expect(modules[0]?.ecosystem).toBe('maven');
  });

  it('discovers Gradle modules', async () => {
    mockFg.mockResolvedValue([
      'kotlin-service/build.gradle.kts',
    ]);

    const modules = await discoverModules('/project', null);

    expect(modules[0]?.ecosystem).toBe('maven');
  });

  it('handles empty config with no ignore paths', async () => {
    mockFg.mockResolvedValue(['app/package.json']);
    const config = {
      ignorePaths: [],
      concernOverrides: {},
    };

    const modules = await discoverModules('/project', config);

    expect(modules).toHaveLength(1);
  });

  it('skips directories with unrecognized manifest files', async () => {
    mockFg.mockResolvedValue(['somedir/README.md']);

    const modules = await discoverModules('/project', null);

    expect(modules).toHaveLength(0);
  });
});
