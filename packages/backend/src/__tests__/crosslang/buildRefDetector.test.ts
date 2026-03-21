/**
 * Tests for the build reference cross-language edge detector.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Module } from '@deckgraph/shared';
import { createBuildRefDetector } from '../../crosslang/buildRefDetector.js';

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

describe('buildRefDetector', () => {
  const detector = createBuildRefDetector();

  it('returns empty array when no build files found', async () => {
    mockFindFiles.mockResolvedValue([]);
    const result = await detector.detect('/project', [makeModule()]);
    expect(result).toEqual([]);
  });

  it('detects docker-compose build context references', async () => {
    mockFindFiles.mockResolvedValue(['docker-compose.yml']);
    mockReadFileSafe.mockResolvedValue(`
version: "3"
services:
  api:
    build:
      context: services/api
  worker:
    build: services/worker
    `);

    const modules: Module[] = [
      makeModule({ path: '.', ecosystem: 'npm' }),
      makeModule({ path: 'services/api', ecosystem: 'pypi' }),
      makeModule({ path: 'services/worker', ecosystem: 'go' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.type === 'build')).toBe(true);
    expect(result.every((e) => e.confidence === 0.4)).toBe(true);
  });

  it('detects Makefile cross-module references', async () => {
    mockFindFiles.mockResolvedValue(['Makefile']);
    mockReadFileSafe.mockResolvedValue(`
.PHONY: build test

build:
\t$(MAKE) -C services/api build
\t$(MAKE) -C packages/client build

test:
\tgo test ./...
    `);

    const modules: Module[] = [
      makeModule({ path: '.', ecosystem: 'npm' }),
      makeModule({ path: 'services/api', ecosystem: 'pypi' }),
      makeModule({ path: 'packages/client', ecosystem: 'npm' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.type === 'build')).toBe(true);
  });

  it('handles invalid docker-compose YAML gracefully', async () => {
    mockFindFiles.mockResolvedValue(['docker-compose.yml']);
    mockReadFileSafe.mockResolvedValue('invalid: [yaml: {broken');

    const result = await detector.detect('/project', [makeModule()]);
    expect(result).toEqual([]);
  });
});
