/**
 * Tests for project schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  ecosystemSchema,
  analysisStateSchema,
  dependencyScopeSchema,
  crossEdgeTypeSchema,
  registryMetaSchema,
  crossEdgeEndpointSchema,
  crossEdgeSchema,
  dependencySchema,
  moduleSchema,
  projectConfigSchema,
  projectSchema,
} from '../../schemas/project.js';

describe('project schemas', () => {
  describe('ecosystemSchema', () => {
    it('accepts valid ecosystems', () => {
      expect(ecosystemSchema.parse('npm')).toBe('npm');
      expect(ecosystemSchema.parse('pypi')).toBe('pypi');
      expect(ecosystemSchema.parse('cargo')).toBe('cargo');
      expect(ecosystemSchema.parse('go')).toBe('go');
      expect(ecosystemSchema.parse('maven')).toBe('maven');
    });

    it('rejects invalid ecosystems', () => {
      expect(() => ecosystemSchema.parse('invalid')).toThrow();
    });

    it('rejects non-string values', () => {
      expect(() => ecosystemSchema.parse(123)).toThrow();
      expect(() => ecosystemSchema.parse(null)).toThrow();
      expect(() => ecosystemSchema.parse(undefined)).toThrow();
    });
  });

  describe('analysisStateSchema', () => {
    it('accepts valid analysis states', () => {
      expect(analysisStateSchema.parse('manifest-only')).toBe('manifest-only');
      expect(analysisStateSchema.parse('imports-resolved')).toBe('imports-resolved');
      expect(analysisStateSchema.parse('registry-enriched')).toBe('registry-enriched');
    });

    it('rejects invalid analysis states', () => {
      expect(() => analysisStateSchema.parse('invalid')).toThrow();
    });
  });

  describe('dependencyScopeSchema', () => {
    it('accepts valid scopes', () => {
      expect(dependencyScopeSchema.parse('runtime')).toBe('runtime');
      expect(dependencyScopeSchema.parse('dev')).toBe('dev');
      expect(dependencyScopeSchema.parse('build')).toBe('build');
      expect(dependencyScopeSchema.parse('optional')).toBe('optional');
      expect(dependencyScopeSchema.parse('peer')).toBe('peer');
    });

    it('rejects invalid scopes', () => {
      expect(() => dependencyScopeSchema.parse('production')).toThrow();
      expect(() => dependencyScopeSchema.parse('')).toThrow();
    });
  });

  describe('crossEdgeTypeSchema', () => {
    it('accepts valid cross edge types', () => {
      expect(crossEdgeTypeSchema.parse('proto')).toBe('proto');
      expect(crossEdgeTypeSchema.parse('openapi')).toBe('openapi');
      expect(crossEdgeTypeSchema.parse('ffi')).toBe('ffi');
      expect(crossEdgeTypeSchema.parse('build')).toBe('build');
      expect(crossEdgeTypeSchema.parse('shared-config')).toBe('shared-config');
    });

    it('rejects invalid cross edge types', () => {
      expect(() => crossEdgeTypeSchema.parse('grpc')).toThrow();
      expect(() => crossEdgeTypeSchema.parse('')).toThrow();
    });
  });

  describe('registryMetaSchema', () => {
    const validMeta = {
      latestVersion: '1.0.0',
      description: 'Test package',
      license: 'MIT',
      homepage: 'https://example.com',
      downloads: 1000,
      deprecated: false,
      publishedAt: '2024-01-01T00:00:00Z',
    };

    it('accepts valid registry metadata', () => {
      expect(registryMetaSchema.parse(validMeta)).toEqual(validMeta);
    });

    it('accepts nullable fields', () => {
      expect(
        registryMetaSchema.parse({
          ...validMeta,
          license: null,
          homepage: null,
          downloads: null,
          publishedAt: null,
        }),
      ).toBeTruthy();
    });

    it('rejects wrong types', () => {
      expect(() => registryMetaSchema.parse({ ...validMeta, deprecated: 'yes' })).toThrow();
      expect(() => registryMetaSchema.parse({ ...validMeta, downloads: 'many' })).toThrow();
    });
  });

  describe('crossEdgeEndpointSchema', () => {
    it('accepts valid endpoints', () => {
      expect(
        crossEdgeEndpointSchema.parse({ module: 'services/auth', ecosystem: 'npm' }),
      ).toEqual({
        module: 'services/auth',
        ecosystem: 'npm',
      });
    });
  });

  describe('crossEdgeSchema', () => {
    const validEdge = {
      from: { module: 'services/auth', ecosystem: 'npm' },
      to: { module: 'libs/auth-proto', ecosystem: 'go' },
      type: 'proto' as const,
      evidence: 'Imported in auth.proto',
      confidence: 0.9,
    };

    it('accepts valid cross edges', () => {
      expect(crossEdgeSchema.parse(validEdge)).toEqual(validEdge);
    });

    it('validates confidence range', () => {
      expect(() => crossEdgeSchema.parse({ ...validEdge, confidence: -0.1 })).toThrow();
      expect(() => crossEdgeSchema.parse({ ...validEdge, confidence: 1.1 })).toThrow();
    });
  });

  describe('dependencySchema', () => {
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

    it('accepts valid dependencies', () => {
      expect(dependencySchema.parse(validDep)).toEqual(validDep);
    });

    it('accepts populated lazy fields', () => {
      expect(
        dependencySchema.parse({
          ...validDep,
          usedInFiles: ['src/App.tsx'],
          transitiveDeps: ['lodash'],
          registryMeta: {
            latestVersion: '19.0.0',
            description: 'React library',
            license: 'MIT',
            homepage: 'https://react.dev',
            downloads: 1000000,
            deprecated: false,
            publishedAt: '2024-01-01T00:00:00Z',
          },
        }),
      ).toBeTruthy();
    });

    it('rejects empty object', () => {
      expect(() => dependencySchema.parse({})).toThrow();
    });

    it('rejects wrong types for fields', () => {
      expect(() => dependencySchema.parse({ ...validDep, name: 123 })).toThrow();
      expect(() => dependencySchema.parse({ ...validDep, version: true })).toThrow();
      expect(() => dependencySchema.parse({ ...validDep, concerns: 'ui' })).toThrow();
    });

    it('rejects invalid source value', () => {
      expect(() => dependencySchema.parse({ ...validDep, source: 'lockfile' })).toThrow();
    });
  });

  describe('moduleSchema', () => {
    const validModule = {
      path: 'packages/frontend',
      name: 'frontend',
      ecosystem: 'npm' as const,
      manifests: ['package.json', 'pnpm-lock.yaml'],
      dependencies: [],
      analysisState: 'manifest-only' as const,
    };

    it('accepts valid modules', () => {
      expect(moduleSchema.parse(validModule)).toEqual(validModule);
    });

    it('rejects empty object', () => {
      expect(() => moduleSchema.parse({})).toThrow();
    });

    it('rejects invalid ecosystem', () => {
      expect(() => moduleSchema.parse({ ...validModule, ecosystem: 'dart' })).toThrow();
    });
  });

  describe('projectConfigSchema', () => {
    const validConfig = {
      ignorePaths: ['**/node_modules/**', '**/dist/**'],
      concernOverrides: {
        'package-name': ['http', 'async'],
      },
    };

    it('accepts valid project config', () => {
      expect(projectConfigSchema.parse(validConfig)).toEqual(validConfig);
    });
  });

  describe('projectSchema', () => {
    const validProject = {
      root: '/path/to/monorepo',
      config: {
        ignorePaths: [],
        concernOverrides: {},
      },
      modules: [],
      crossEdges: [],
      lastScannedAt: '2024-01-01T00:00:00Z',
    };

    it('accepts valid projects', () => {
      expect(projectSchema.parse(validProject)).toEqual(validProject);
    });

    it('accepts null config', () => {
      expect(projectSchema.parse({ ...validProject, config: null })).toBeTruthy();
    });

    it('rejects empty object', () => {
      expect(() => projectSchema.parse({})).toThrow();
    });
  });
});
