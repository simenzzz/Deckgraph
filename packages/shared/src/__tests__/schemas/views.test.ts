/**
 * Tests for view schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  viewQuerySchema,
  moduleViewSchema,
  viewSummarySchema,
  viewResultSchema,
} from '../../schemas/views.js';

describe('view schemas', () => {
  describe('viewQuerySchema', () => {
    it('accepts empty queries', () => {
      expect(viewQuerySchema.parse({})).toEqual({});
    });

    it('accepts queries with all filters', () => {
      const query = {
        ecosystems: ['npm', 'pypi'],
        modules: ['services/auth'],
        scopes: ['runtime', 'dev'],
        depth: 2,
        concern: 'http',
        search: 'express',
        showCrossEdges: true,
        crossEdgeTypes: ['proto', 'ffi'],
        analysisLevel: 'registry' as const,
      };
      expect(viewQuerySchema.parse(query)).toEqual(query);
    });

    it('accepts partial queries', () => {
      expect(
        viewQuerySchema.parse({
          ecosystems: ['npm'],
          search: 'react',
        }),
      ).toBeTruthy();
    });

    it('rejects invalid ecosystem in filter', () => {
      expect(() => viewQuerySchema.parse({ ecosystems: ['invalid'] })).toThrow();
    });

    it('rejects non-positive depth', () => {
      expect(() => viewQuerySchema.parse({ depth: 0 })).toThrow();
      expect(() => viewQuerySchema.parse({ depth: -1 })).toThrow();
    });
  });

  describe('moduleViewSchema', () => {
    const validModuleView = {
      path: 'packages/frontend',
      name: 'frontend',
      ecosystem: 'npm' as const,
      analysisState: 'manifest-only' as const,
      dependencies: [
        {
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
        },
      ],
      totalDependencyCount: 1,
    };

    it('accepts valid module views', () => {
      expect(moduleViewSchema.parse(validModuleView)).toEqual(validModuleView);
    });

    it('accepts empty dependencies', () => {
      expect(
        moduleViewSchema.parse({ ...validModuleView, dependencies: [], totalDependencyCount: 0 }),
      ).toBeTruthy();
    });

    it('rejects missing required fields', () => {
      expect(() => moduleViewSchema.parse({})).toThrow();
    });
  });

  describe('viewSummarySchema', () => {
    const validSummary = {
      totalDeps: 10,
      byEcosystem: { npm: 8, pypi: 2, cargo: 0, go: 0, maven: 0 },
      byScope: { runtime: 6, dev: 3, build: 1, optional: 0, peer: 0 },
      outdatedCount: 2,
      unusedCount: 1,
      moduleCount: 3,
      crossEdgeCount: 0,
    };

    it('accepts valid view summaries', () => {
      expect(viewSummarySchema.parse(validSummary)).toEqual(validSummary);
    });

    it('accepts null counts for uncomputed stats', () => {
      expect(
        viewSummarySchema.parse({ ...validSummary, outdatedCount: null, unusedCount: null }),
      ).toBeTruthy();
    });

    it('rejects negative counts', () => {
      expect(() => viewSummarySchema.parse({ ...validSummary, totalDeps: -1 })).toThrow();
    });

    it('rejects invalid ecosystem key in byEcosystem', () => {
      expect(() =>
        viewSummarySchema.parse({
          ...validSummary,
          byEcosystem: { invalid: 5 },
        }),
      ).toThrow();
    });

    it('rejects invalid scope key in byScope', () => {
      expect(() =>
        viewSummarySchema.parse({
          ...validSummary,
          byScope: { production: 6 },
        }),
      ).toThrow();
    });

    it('rejects missing required fields', () => {
      expect(() => viewSummarySchema.parse({})).toThrow();
    });
  });

  describe('viewResultSchema', () => {
    const validResult = {
      modules: [
        {
          path: 'packages/frontend',
          name: 'frontend',
          ecosystem: 'npm' as const,
          analysisState: 'manifest-only' as const,
          dependencies: [],
          totalDependencyCount: 0,
        },
      ],
      crossEdges: [],
      summary: {
        totalDeps: 0,
        byEcosystem: { npm: 0, pypi: 0, cargo: 0, go: 0, maven: 0 },
        byScope: { runtime: 0, dev: 0, build: 0, optional: 0, peer: 0 },
        outdatedCount: null,
        unusedCount: null,
        moduleCount: 1,
        crossEdgeCount: 0,
      },
    };

    it('accepts valid view results', () => {
      expect(viewResultSchema.parse(validResult)).toEqual(validResult);
    });

    it('accepts results with cross edges', () => {
      expect(
        viewResultSchema.parse({
          ...validResult,
          crossEdges: [
            {
              from: { module: 'services/auth', ecosystem: 'npm' as const },
              to: { module: 'libs/auth-proto', ecosystem: 'go' as const },
              type: 'proto' as const,
              evidence: 'Imported in auth.proto',
              confidence: 0.9,
            },
          ],
          summary: { ...validResult.summary, crossEdgeCount: 1 },
        }),
      ).toBeTruthy();
    });

    it('rejects missing required fields', () => {
      expect(() => viewResultSchema.parse({})).toThrow();
      expect(() => viewResultSchema.parse({ modules: [] })).toThrow();
    });
  });
});
