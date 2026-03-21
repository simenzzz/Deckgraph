/**
 * Tests for config loader.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadConfig, DeckgraphConfigError } from '../../config/configLoader.js';

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, readFile: vi.fn() };
});

import { readFile } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadConfig', () => {
  it('returns null when .deckgraph.yaml does not exist', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    mockReadFile.mockRejectedValue(error);

    const result = await loadConfig('/project');
    expect(result).toBeNull();
  });

  it('returns defaults for empty YAML file', async () => {
    mockReadFile.mockResolvedValue('');

    const result = await loadConfig('/project');
    expect(result).toEqual({
      ignorePaths: [],
      concernOverrides: {},
    });
  });

  it('parses valid config with ignore-paths', async () => {
    mockReadFile.mockResolvedValue(`
ignore-paths:
  - vendor
  - tmp
`);

    const result = await loadConfig('/project');
    expect(result).toEqual({
      ignorePaths: ['vendor', 'tmp'],
      concernOverrides: {},
    });
  });

  it('parses valid config with concern-overrides', async () => {
    mockReadFile.mockResolvedValue(`
concern-overrides:
  lodash:
    - utility
    - data-manipulation
`);

    const result = await loadConfig('/project');
    expect(result).toEqual({
      ignorePaths: [],
      concernOverrides: {
        lodash: ['utility', 'data-manipulation'],
      },
    });
  });

  it('parses full config with both fields', async () => {
    mockReadFile.mockResolvedValue(`
ignore-paths:
  - vendor
concern-overrides:
  react:
    - ui
`);

    const result = await loadConfig('/project');
    expect(result).toEqual({
      ignorePaths: ['vendor'],
      concernOverrides: { react: ['ui'] },
    });
  });

  it('throws DeckgraphConfigError for invalid YAML syntax', async () => {
    // Unbalanced braces cause a YAML parse error
    mockReadFile.mockResolvedValue('key: [unclosed');

    await expect(loadConfig('/project')).rejects.toThrow(DeckgraphConfigError);
    await expect(loadConfig('/project')).rejects.toThrow('invalid YAML syntax');
  });

  it('throws DeckgraphConfigError for unknown keys (strict mode)', async () => {
    mockReadFile.mockResolvedValue(`
typo-field: true
`);

    await expect(loadConfig('/project')).rejects.toThrow(DeckgraphConfigError);
    await expect(loadConfig('/project')).rejects.toThrow('Invalid .deckgraph.yaml');
  });

  it('throws DeckgraphConfigError for wrong value types', async () => {
    mockReadFile.mockResolvedValue(`
ignore-paths: not-an-array
`);

    await expect(loadConfig('/project')).rejects.toThrow(DeckgraphConfigError);
  });

  it('re-throws non-ENOENT filesystem errors', async () => {
    const error = new Error('EACCES: permission denied');
    (error as NodeJS.ErrnoException).code = 'EACCES';
    mockReadFile.mockRejectedValue(error);

    await expect(loadConfig('/project')).rejects.toThrow('EACCES');
  });

  it('DeckgraphConfigError has correct name', () => {
    const error = new DeckgraphConfigError('test');
    expect(error.name).toBe('DeckgraphConfigError');
    expect(error.message).toBe('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('handles config with empty arrays', async () => {
    mockReadFile.mockResolvedValue(`
ignore-paths: []
concern-overrides: {}
`);

    const result = await loadConfig('/project');
    expect(result).toEqual({
      ignorePaths: [],
      concernOverrides: {},
    });
  });

  it('validates that ignore-paths items are non-empty strings', async () => {
    mockReadFile.mockResolvedValue(`
ignore-paths:
  - ""
`);

    await expect(loadConfig('/project')).rejects.toThrow(DeckgraphConfigError);
  });
});
