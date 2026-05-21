/**
 * Tests for CLI entry point.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getVersion, createProgram } from '../index.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return { ...actual, readFileSync: vi.fn() };
});

import { readFileSync } from 'node:fs';

const mockReadFileSync = vi.mocked(readFileSync);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getVersion', () => {
  it('returns a valid semver version', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.0.1' }));
    const version = getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('throws when package.json is missing', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });
    expect(() => getVersion()).toThrow('ENOENT');
  });

  it('throws when package.json contains invalid JSON', () => {
    mockReadFileSync.mockReturnValue('not-json');
    expect(() => getVersion()).toThrow();
  });

  it('throws when version field is missing', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'test' }));
    expect(() => getVersion()).toThrow('Missing version field');
  });

  it('throws when version field is not a string', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: 123 }));
    expect(() => getVersion()).toThrow('Missing version field');
  });
});

describe('createProgram', () => {
  it('parses --project argument', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.0.1' }));
    const program = createProgram();
    program.parse(['node', 'deckgraph', '--project', '/some/path']);
    const opts = program.opts();
    expect(opts.project).toBe('/some/path');
  });

  it('parses --port argument', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.0.1' }));
    const program = createProgram();
    program.parse(['node', 'deckgraph', '--project', '/path', '--port', '4000']);
    const opts = program.opts();
    expect(opts.port).toBe('4000');
  });

  it('defaults port to 3333', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.0.1' }));
    const program = createProgram();
    program.parse(['node', 'deckgraph', '--project', '/path']);
    const opts = program.opts();
    expect(opts.port).toBe('3333');
  });

  it('parses --no-open flag', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.0.1' }));
    const program = createProgram();
    program.parse(['node', 'deckgraph', '--project', '/path', '--no-open']);
    const opts = program.opts();
    expect(opts.open).toBe(false);
  });

  it('defaults open to true', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.0.1' }));
    const program = createProgram();
    program.parse(['node', 'deckgraph', '--project', '/path']);
    const opts = program.opts();
    expect(opts.open).toBe(true);
  });

  it('allows --project to be omitted so main can validate demo mode', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.0.1' }));
    const program = createProgram();
    program.parse(['node', 'deckgraph']);
    const opts = program.opts();
    expect(opts.project).toBeUndefined();
  });
});
