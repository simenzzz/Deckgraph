/**
 * Tests for schema string/array constraints and security refinements.
 *
 * Validates that bounded inputs are enforced on all schemas
 * to prevent DoS via unbounded payloads over WebSocket.
 */

import { describe, it, expect } from 'vitest';
import {
  registryMetaSchema,
  dependencySchema,
  crossEdgeSchema,
  projectSchema,
} from '../../schemas/project.js';
import { manifestResultSchema, minimalDependencySchema } from '../../schemas/adapters.js';
import { viewQuerySchema } from '../../schemas/views.js';

describe('string length constraints', () => {
  it('rejects empty dependency name', () => {
    expect(() =>
      minimalDependencySchema.parse({ name: '', version: '1.0.0', constraint: '^1', scope: 'runtime' }),
    ).toThrow();
  });

  it('rejects empty dependency version', () => {
    expect(() =>
      minimalDependencySchema.parse({ name: 'x', version: '', constraint: '^1', scope: 'runtime' }),
    ).toThrow();
  });

  it('rejects empty evidence in cross edge', () => {
    expect(() =>
      crossEdgeSchema.parse({
        from: { module: 'a', ecosystem: 'npm' },
        to: { module: 'b', ecosystem: 'go' },
        type: 'proto',
        evidence: '',
        confidence: 0.9,
      }),
    ).toThrow();
  });

  it('rejects empty latestVersion in registry meta', () => {
    expect(() =>
      registryMetaSchema.parse({
        latestVersion: '',
        description: 'Test',
        license: null,
        homepage: null,
        downloads: null,
        deprecated: false,
        publishedAt: null,
      }),
    ).toThrow();
  });
});

describe('URL and datetime validation', () => {
  it('rejects invalid homepage URL', () => {
    expect(() =>
      registryMetaSchema.parse({
        latestVersion: '1.0.0',
        description: 'Test',
        license: null,
        homepage: 'not-a-url',
        downloads: null,
        deprecated: false,
        publishedAt: null,
      }),
    ).toThrow();
  });

  it('rejects invalid publishedAt datetime', () => {
    expect(() =>
      registryMetaSchema.parse({
        latestVersion: '1.0.0',
        description: 'Test',
        license: null,
        homepage: null,
        downloads: null,
        deprecated: false,
        publishedAt: 'yesterday',
      }),
    ).toThrow();
  });

  it('rejects invalid lastScannedAt datetime', () => {
    expect(() =>
      projectSchema.parse({
        root: '/test',
        config: null,
        modules: [],
        crossEdges: [],
        lastScannedAt: 'not-a-date',
      }),
    ).toThrow();
  });

  it('rejects negative downloads', () => {
    expect(() =>
      registryMetaSchema.parse({
        latestVersion: '1.0.0',
        description: 'Test',
        license: null,
        homepage: null,
        downloads: -1,
        deprecated: false,
        publishedAt: null,
      }),
    ).toThrow();
  });
});

describe('array max constraints', () => {
  it('rejects viewQuery with more than 5 ecosystems', () => {
    expect(() =>
      viewQuerySchema.parse({
        ecosystems: ['npm', 'pypi', 'cargo', 'go', 'maven', 'npm'],
      }),
    ).toThrow();
  });

  it('rejects viewQuery with more than 5 scopes', () => {
    expect(() =>
      viewQuerySchema.parse({
        scopes: ['runtime', 'dev', 'build', 'optional', 'peer', 'runtime'],
      }),
    ).toThrow();
  });

  it('rejects viewQuery with depth > 32', () => {
    expect(() => viewQuerySchema.parse({ depth: 33 })).toThrow();
  });
});

describe('metadata prototype pollution prevention', () => {
  it('strips constructor key from metadata', () => {
    const result = manifestResultSchema.parse({
      moduleName: 'test',
      dependencies: [],
      hasLockFile: false,
      metadata: { constructor: {}, safe: 'value' },
    });
    expect(result.metadata).toEqual({ safe: 'value' });
    expect(Object.hasOwn(result.metadata, 'constructor')).toBe(false);
  });

  it('strips prototype key from metadata', () => {
    const result = manifestResultSchema.parse({
      moduleName: 'test',
      dependencies: [],
      hasLockFile: false,
      metadata: { prototype: {}, safe: 'value' },
    });
    expect(result.metadata).toEqual({ safe: 'value' });
  });

  it('strips __proto__ key from JSON-parsed metadata', () => {
    // JSON.parse is the actual attack vector — it creates __proto__ as an own key
    const input = JSON.parse('{"__proto__": {"polluted": true}, "safe": "value"}') as Record<
      string,
      unknown
    >;
    const result = manifestResultSchema.parse({
      moduleName: 'test',
      dependencies: [],
      hasLockFile: false,
      metadata: input,
    });
    expect(result.metadata).toEqual({ safe: 'value' });
    expect(Object.hasOwn(result.metadata, '__proto__')).toBe(false);
  });

  it('preserves safe metadata keys', () => {
    const result = manifestResultSchema.parse({
      moduleName: 'test',
      dependencies: [],
      hasLockFile: false,
      metadata: { scripts: { build: 'tsc' }, version: '1.0.0' },
    });
    expect(result.metadata).toEqual({ scripts: { build: 'tsc' }, version: '1.0.0' });
  });
});

describe('full dependency schema constraints', () => {
  const validDep = {
    name: 'react',
    ecosystem: 'npm' as const,
    version: '18.2.0',
    constraint: '^18.0.0',
    scope: 'runtime' as const,
    source: 'manifest' as const,
    concerns: ['ui'],
    usedInFiles: null,
    transitiveDeps: null,
    registryMeta: null,
  };

  it('rejects empty concern tags', () => {
    expect(() => dependencySchema.parse({ ...validDep, concerns: [''] })).toThrow();
  });

  it('accepts valid concern array within limits', () => {
    const concerns = Array.from({ length: 64 }, (_, i) => `tag-${i}`);
    expect(dependencySchema.parse({ ...validDep, concerns })).toBeTruthy();
  });

  it('rejects concern array exceeding max', () => {
    const concerns = Array.from({ length: 65 }, (_, i) => `tag-${i}`);
    expect(() => dependencySchema.parse({ ...validDep, concerns })).toThrow();
  });
});
