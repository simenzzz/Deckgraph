/**
 * Tests for the cross-language edge detection aggregator.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { CrossEdge, Module } from '@deckgraph/shared';

vi.mock('../../crosslang/protoDetector.js', () => ({
  createProtoDetector: vi.fn(),
}));
vi.mock('../../crosslang/ffiDetector.js', () => ({
  createFfiDetector: vi.fn(),
}));
vi.mock('../../crosslang/openapiDetector.js', () => ({
  createOpenapiDetector: vi.fn(),
}));
vi.mock('../../crosslang/buildRefDetector.js', () => ({
  createBuildRefDetector: vi.fn(),
}));
vi.mock('../../crosslang/sharedConfigDetector.js', () => ({
  createSharedConfigDetector: vi.fn(),
}));

import { createProtoDetector } from '../../crosslang/protoDetector.js';
import { createFfiDetector } from '../../crosslang/ffiDetector.js';
import { createOpenapiDetector } from '../../crosslang/openapiDetector.js';
import { createBuildRefDetector } from '../../crosslang/buildRefDetector.js';
import { createSharedConfigDetector } from '../../crosslang/sharedConfigDetector.js';
import { detectCrossEdges } from '../../crosslang/index.js';

const mockCreateProto = vi.mocked(createProtoDetector);
const mockCreateFfi = vi.mocked(createFfiDetector);
const mockCreateOpenapi = vi.mocked(createOpenapiDetector);
const mockCreateBuild = vi.mocked(createBuildRefDetector);
const mockCreateSharedConfig = vi.mocked(createSharedConfigDetector);

afterEach(() => {
  vi.restoreAllMocks();
});

function makeEdge(overrides: Partial<CrossEdge> = {}): CrossEdge {
  return {
    from: { module: 'services/api', ecosystem: 'npm' },
    to: { module: 'services/worker', ecosystem: 'pypi' },
    type: 'proto',
    evidence: 'test evidence',
    confidence: 0.9,
    ...overrides,
  };
}

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

function setupMocks(edges: readonly CrossEdge[][] = [[], [], [], [], []]) {
  const detectors = edges.map((e, i) => ({
    name: ['proto', 'ffi', 'openapi', 'build', 'shared-config'][i]!,
    detect: vi.fn().mockResolvedValue(e),
  }));

  mockCreateProto.mockReturnValue(detectors[0]!);
  mockCreateFfi.mockReturnValue(detectors[1]!);
  mockCreateOpenapi.mockReturnValue(detectors[2]!);
  mockCreateBuild.mockReturnValue(detectors[3]!);
  mockCreateSharedConfig.mockReturnValue(detectors[4]!);

  return detectors;
}

describe('detectCrossEdges', () => {
  it('returns empty for projects with fewer than 2 modules', async () => {
    setupMocks();
    const result = await detectCrossEdges('/project', [makeModule()]);
    expect(result).toEqual([]);
  });

  it('aggregates edges from all detectors', async () => {
    const protoEdge = makeEdge({ type: 'proto' });
    const ffiEdge = makeEdge({ type: 'ffi', confidence: 0.6 });
    setupMocks([[protoEdge], [ffiEdge], [], [], []]);

    const modules = [makeModule(), makeModule({ path: 'services/worker', ecosystem: 'pypi' })];
    const result = await detectCrossEdges('/project', modules);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.type)).toContain('proto');
    expect(result.map((e) => e.type)).toContain('ffi');
  });

  it('deduplicates edges keeping highest confidence', async () => {
    const edge1 = makeEdge({ type: 'proto', confidence: 0.7 });
    const edge2 = makeEdge({ type: 'proto', confidence: 0.9 });
    setupMocks([[edge1, edge2], [], [], [], []]);

    const modules = [makeModule(), makeModule({ path: 'services/worker', ecosystem: 'pypi' })];
    const result = await detectCrossEdges('/project', modules);

    expect(result).toHaveLength(1);
    expect(result[0]!.confidence).toBe(0.9);
  });

  it('handles detector failures gracefully', async () => {
    const goodEdge = makeEdge({ type: 'ffi', confidence: 0.6 });
    const detectors = setupMocks([[], [goodEdge], [], [], []]);
    detectors[0]!.detect.mockRejectedValue(new Error('boom'));

    const modules = [makeModule(), makeModule({ path: 'services/worker', ecosystem: 'pypi' })];
    const result = await detectCrossEdges('/project', modules);

    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('ffi');
  });

  it('runs all detectors in parallel', async () => {
    const detectors = setupMocks();

    const modules = [makeModule(), makeModule({ path: 'services/worker', ecosystem: 'pypi' })];
    await detectCrossEdges('/project', modules);

    // All detectors should have been called
    for (const d of detectors) {
      expect(d.detect).toHaveBeenCalledOnce();
    }
  });

  it('returns empty for empty project', async () => {
    setupMocks();
    const result = await detectCrossEdges('/project', []);
    expect(result).toEqual([]);
  });

  it('validates edges and skips invalid ones', async () => {
    const validEdge = makeEdge({ type: 'proto', confidence: 0.9 });
    const invalidEdge = {
      ...makeEdge({
        from: { module: 'services/other', ecosystem: 'go' },
        type: 'ffi',
      }),
      confidence: 2.0, // Invalid: > 1
    };
    setupMocks([[validEdge], [invalidEdge], [], [], []]);

    const modules = [makeModule(), makeModule({ path: 'services/worker', ecosystem: 'pypi' })];
    const result = await detectCrossEdges('/project', modules);

    expect(result).toHaveLength(1);
    expect(result[0]!.confidence).toBe(0.9);
  });
});
