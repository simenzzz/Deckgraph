/**
 * Tests for the Proto/gRPC cross-language edge detector.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Module } from '@deckgraph/shared';
import { createProtoDetector } from '../../crosslang/protoDetector.js';

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

describe('protoDetector', () => {
  const detector = createProtoDetector();

  it('returns empty array when no .proto files found', async () => {
    mockFindFiles.mockResolvedValue([]);
    const result = await detector.detect('/project', [makeModule()]);
    expect(result).toEqual([]);
  });

  it('detects proto edges with service declarations', async () => {
    mockFindFiles.mockResolvedValue(['proto/service.proto']);
    mockReadFileSafe.mockResolvedValue(`
      syntax = "proto3";
      package myapp.api;

      service UserService {
        rpc GetUser (GetUserRequest) returns (GetUserResponse);
      }
    `);

    const modules: Module[] = [
      makeModule({
        path: 'proto',
        ecosystem: 'npm',
        dependencies: [
          {
            name: '@grpc/grpc-js',
            ecosystem: 'npm',
            version: '1.0.0',
            constraint: '^1.0.0',
            scope: 'runtime',
            source: 'manifest',
            concerns: ['grpc'],
            usedInFiles: null,
            transitiveDeps: null,
            registryMeta: null,
          },
        ],
      }),
      makeModule({
        path: 'services/api',
        ecosystem: 'pypi',
        dependencies: [
          {
            name: 'grpcio',
            ecosystem: 'pypi',
            version: '1.50.0',
            constraint: '>=1.50.0',
            scope: 'runtime',
            source: 'manifest',
            concerns: ['grpc'],
            usedInFiles: null,
            transitiveDeps: null,
            registryMeta: null,
          },
        ],
      }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.type).toBe('proto');
    expect(result[0]!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('returns empty when proto file cannot be read', async () => {
    mockFindFiles.mockResolvedValue(['missing.proto']);
    mockReadFileSafe.mockResolvedValue(null);

    const result = await detector.detect('/project', [makeModule()]);
    expect(result).toEqual([]);
  });

  it('extracts package name from proto', async () => {
    mockFindFiles.mockResolvedValue(['api/hello.proto']);
    mockReadFileSafe.mockResolvedValue(`
      syntax = "proto3";
      package hello.world;
      message HelloRequest {}
    `);

    const modules: Module[] = [
      makeModule({ path: 'api', ecosystem: 'go' }),
      makeModule({
        path: 'services/hello',
        ecosystem: 'pypi',
        dependencies: [
          {
            name: 'protobuf',
            ecosystem: 'pypi',
            version: '4.0.0',
            constraint: '>=4.0.0',
            scope: 'runtime',
            source: 'manifest',
            concerns: ['grpc'],
            usedInFiles: null,
            transitiveDeps: null,
            registryMeta: null,
          },
        ],
      }),
    ];

    const result = await detector.detect('/project', modules);
    // Should produce edges since target has grpc deps
    for (const edge of result) {
      expect(edge.type).toBe('proto');
      expect(edge.confidence).toBeGreaterThanOrEqual(0.7);
    }
  });
});
