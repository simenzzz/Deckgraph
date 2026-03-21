/**
 * Tests for the shared config cross-language edge detector.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Module } from '@deckgraph/shared';
import { createSharedConfigDetector } from '../../crosslang/sharedConfigDetector.js';

vi.mock('../../crosslang/fileScanner.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../crosslang/fileScanner.js')>();
  return { ...actual, findFiles: vi.fn() };
});

vi.mock('../../adapters/utils.js', () => ({
  readFileSafe: vi.fn(),
}));

import { findFiles } from '../../crosslang/fileScanner.js';
import { readFileSafe } from '../../adapters/utils.js';

const mockFindFiles = vi.mocked(findFiles);
const mockReadFileSafe = vi.mocked(readFileSafe);

afterEach(() => {
  vi.restoreAllMocks();
});

function makeModule(overrides: Partial<Module> = {}): Module {
  return {
    path: 'packages/app',
    name: 'app',
    ecosystem: 'npm',
    manifests: ['package.json'],
    dependencies: [],
    analysisState: 'manifest-only',
    ...overrides,
  };
}

describe('sharedConfigDetector', () => {
  const detector = createSharedConfigDetector();

  it('returns empty array when no env files found', async () => {
    mockFindFiles.mockResolvedValue([]);
    const result = await detector.detect('/project', [makeModule()]);
    expect(result).toEqual([]);
  });

  it('detects shared env vars across different ecosystems', async () => {
    mockFindFiles.mockResolvedValue([
      'services/api/.env',
      'services/worker/.env',
    ]);

    mockReadFileSafe.mockImplementation(async (path) => {
      if (path.includes('api')) {
        return `
DATABASE_URL=postgres://localhost/db
REDIS_URL=redis://localhost:6379
API_KEY=secret123
LOG_LEVEL=info
PORT=8080
        `;
      }
      return `
DATABASE_URL=postgres://localhost/db
REDIS_URL=redis://localhost:6379
API_KEY=secret456
LOG_LEVEL=debug
WORKER_COUNT=4
      `;
    });

    const modules: Module[] = [
      makeModule({ path: 'services/api', ecosystem: 'npm' }),
      makeModule({ path: 'services/worker', ecosystem: 'pypi' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('shared-config');
    expect(result[0]!.confidence).toBe(0.3);
    expect(result[0]!.evidence).toContain('shared env vars');
  });

  it('ignores pairs with fewer than 3 shared vars', async () => {
    mockFindFiles.mockResolvedValue([
      'services/api/.env',
      'services/worker/.env',
    ]);

    mockReadFileSafe.mockImplementation(async (path) => {
      if (path.includes('api')) {
        return 'DATABASE_URL=postgres://localhost/db\nPORT=8080\n';
      }
      return 'DATABASE_URL=postgres://localhost/db\nWORKER_COUNT=4\n';
    });

    const modules: Module[] = [
      makeModule({ path: 'services/api', ecosystem: 'npm' }),
      makeModule({ path: 'services/worker', ecosystem: 'pypi' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result).toEqual([]);
  });

  it('ignores same-ecosystem pairs', async () => {
    mockFindFiles.mockResolvedValue([
      'packages/app/.env',
      'packages/lib/.env',
    ]);

    mockReadFileSafe.mockResolvedValue(`
DATABASE_URL=postgres://localhost/db
REDIS_URL=redis://localhost:6379
API_KEY=secret
LOG_LEVEL=info
    `);

    const modules: Module[] = [
      makeModule({ path: 'packages/app', ecosystem: 'npm' }),
      makeModule({ path: 'packages/lib', ecosystem: 'npm' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result).toEqual([]);
  });

  it('handles unreadable env files', async () => {
    mockFindFiles.mockResolvedValue(['services/api/.env']);
    mockReadFileSafe.mockResolvedValue(null);

    const result = await detector.detect('/project', [makeModule()]);
    expect(result).toEqual([]);
  });
});
