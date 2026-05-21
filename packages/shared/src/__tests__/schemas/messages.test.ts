/**
 * Tests for message schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  scanProjectMessageSchema,
  importDemoRepoMessageSchema,
  viewQueryMessageSchema,
  analyzeImportsMessageSchema,
  enrichDependencyMessageSchema,
  syncMessageSchema,
  clientMessageSchema,
  projectOverviewMessageSchema,
  viewResultMessageSchema,
  moduleUpdatedMessageSchema,
  dependencyEnrichedMessageSchema,
  progressMessageSchema,
  errorMessageSchema,
  serverMessageSchema,
  parseAnalyzeImportsMessage,
  parseEnrichDependencyMessage,
  parseSyncMessage,
  parseProjectOverviewMessage,
  parseModuleUpdatedMessage,
  parseDependencyEnrichedMessage,
} from '../../schemas/messages.js';

describe('client message schemas', () => {
  const baseMessage = { requestId: 'test-request-id' };

  describe('scanProjectMessageSchema', () => {
    it('accepts valid scan project messages', () => {
      const message = { ...baseMessage, type: 'scan_project' as const };
      expect(scanProjectMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('importDemoRepoMessageSchema', () => {
    it('accepts valid demo import messages', () => {
      const message = {
        ...baseMessage,
        type: 'import_demo_repo' as const,
        repoId: 'deckgraph-fixture',
      };
      expect(importDemoRepoMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('viewQueryMessageSchema', () => {
    it('accepts valid view query messages', () => {
      const message = {
        ...baseMessage,
        type: 'view_query' as const,
        query: {
          ecosystems: ['npm'],
          search: 'react',
        },
      };
      expect(viewQueryMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('analyzeImportsMessageSchema', () => {
    it('accepts valid analyze imports messages', () => {
      const message = {
        ...baseMessage,
        type: 'analyze_imports' as const,
        modulePath: 'services/auth',
      };
      expect(analyzeImportsMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('enrichDependencyMessageSchema', () => {
    it('accepts valid enrich dependency messages', () => {
      const message = {
        ...baseMessage,
        type: 'enrich_dependency' as const,
        ecosystem: 'npm' as const,
        packageName: 'react',
      };
      expect(enrichDependencyMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('syncMessageSchema', () => {
    it('accepts valid sync messages', () => {
      const message = { ...baseMessage, type: 'sync' as const };
      expect(syncMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('clientMessageSchema', () => {
    it('accepts all client message types', () => {
      expect(
        clientMessageSchema.parse({ ...baseMessage, type: 'scan_project' as const }),
      ).toBeTruthy();
      expect(
        clientMessageSchema.parse({
          ...baseMessage,
          type: 'import_demo_repo' as const,
          repoId: 'deckgraph-fixture',
        }),
      ).toBeTruthy();
      expect(
        clientMessageSchema.parse({
          ...baseMessage,
          type: 'view_query' as const,
          query: {},
        }),
      ).toBeTruthy();
      expect(
        clientMessageSchema.parse({
          ...baseMessage,
          type: 'analyze_imports' as const,
          modulePath: 'test',
        }),
      ).toBeTruthy();
      expect(
        clientMessageSchema.parse({
          ...baseMessage,
          type: 'enrich_dependency' as const,
          ecosystem: 'npm' as const,
          packageName: 'test',
        }),
      ).toBeTruthy();
      expect(clientMessageSchema.parse({ ...baseMessage, type: 'sync' as const })).toBeTruthy();
    });

    it('rejects invalid message types', () => {
      expect(() => clientMessageSchema.parse({ ...baseMessage, type: 'invalid' })).toThrow();
    });

    it('rejects missing requestId', () => {
      expect(() => clientMessageSchema.parse({ type: 'scan_project' })).toThrow();
    });

    it('rejects empty requestId', () => {
      expect(() =>
        clientMessageSchema.parse({ type: 'scan_project', requestId: '' }),
      ).toThrow();
    });
  });
});

describe('server message schemas', () => {
  const baseMessage = { requestId: 'test-request-id' };

  const validProject = {
    root: '/test',
    config: null,
    modules: [],
    crossEdges: [],
    lastScannedAt: '2024-01-01T00:00:00Z',
  };

  const validViewResult = {
    modules: [],
    crossEdges: [],
    summary: {
      totalDeps: 0,
      byEcosystem: { npm: 0, pypi: 0, cargo: 0, go: 0, maven: 0 },
      byScope: { runtime: 0, dev: 0, build: 0, optional: 0, peer: 0 },
      outdatedCount: null,
      unusedCount: null,
      moduleCount: 0,
      crossEdgeCount: 0,
    },
  };

  const validModule = {
    path: 'test',
    name: 'test',
    ecosystem: 'npm' as const,
    manifests: [],
    dependencies: [],
    analysisState: 'manifest-only' as const,
  };

  const validDependency = {
    name: 'test',
    ecosystem: 'npm' as const,
    version: '1.0.0',
    constraint: '^1.0.0',
    scope: 'runtime' as const,
    source: 'manifest' as const,
    concerns: [],
    usedInFiles: null,
    transitiveDeps: null,
    registryMeta: null,
  };

  describe('projectOverviewMessageSchema', () => {
    it('accepts valid project overview messages', () => {
      const message = {
        ...baseMessage,
        type: 'project_overview' as const,
        data: validProject,
      };
      expect(projectOverviewMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('viewResultMessageSchema', () => {
    it('accepts valid view result messages', () => {
      const message = {
        ...baseMessage,
        type: 'view_result' as const,
        data: validViewResult,
      };
      expect(viewResultMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('moduleUpdatedMessageSchema', () => {
    it('accepts valid module updated messages', () => {
      const message = {
        ...baseMessage,
        type: 'module_updated' as const,
        module: validModule,
      };
      expect(moduleUpdatedMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('dependencyEnrichedMessageSchema', () => {
    it('accepts valid dependency enriched messages', () => {
      const message = {
        ...baseMessage,
        type: 'dependency_enriched' as const,
        dependency: validDependency,
      };
      expect(dependencyEnrichedMessageSchema.parse(message)).toEqual(message);
    });
  });

  describe('progressMessageSchema', () => {
    it('accepts valid progress messages', () => {
      const message = {
        ...baseMessage,
        type: 'progress' as const,
        message: 'Scanning...',
        phase: 1 as const,
      };
      expect(progressMessageSchema.parse(message)).toEqual(message);
    });

    it('accepts all phase values', () => {
      [0, 1, 2, 3].forEach((phase) => {
        expect(
          progressMessageSchema.parse({
            ...baseMessage,
            type: 'progress' as const,
            message: 'Test',
            phase: phase as 0 | 1 | 2 | 3,
          }),
        ).toBeTruthy();
      });
    });

    it('rejects invalid phase values', () => {
      expect(() =>
        progressMessageSchema.parse({
          ...baseMessage,
          type: 'progress',
          message: 'Test',
          phase: 4,
        }),
      ).toThrow();
    });
  });

  describe('errorMessageSchema', () => {
    it('accepts valid error messages', () => {
      const message = {
        ...baseMessage,
        type: 'error' as const,
        message: 'Something went wrong',
        suggestion: 'Try again',
      };
      expect(errorMessageSchema.parse(message)).toEqual(message);
    });

    it('rejects missing suggestion', () => {
      expect(() =>
        errorMessageSchema.parse({
          ...baseMessage,
          type: 'error',
          message: 'Error',
        }),
      ).toThrow();
    });
  });

  describe('serverMessageSchema', () => {
    it('accepts all server message types', () => {
      expect(
        serverMessageSchema.parse({
          ...baseMessage,
          type: 'project_overview' as const,
          data: validProject,
        }),
      ).toBeTruthy();
      expect(
        serverMessageSchema.parse({
          ...baseMessage,
          type: 'view_result' as const,
          data: validViewResult,
        }),
      ).toBeTruthy();
      expect(
        serverMessageSchema.parse({
          ...baseMessage,
          type: 'module_updated' as const,
          module: validModule,
        }),
      ).toBeTruthy();
      expect(
        serverMessageSchema.parse({
          ...baseMessage,
          type: 'dependency_enriched' as const,
          dependency: validDependency,
        }),
      ).toBeTruthy();
      expect(
        serverMessageSchema.parse({
          ...baseMessage,
          type: 'progress' as const,
          message: 'Test',
          phase: 1 as const,
        }),
      ).toBeTruthy();
      expect(
        serverMessageSchema.parse({
          ...baseMessage,
          type: 'error' as const,
          message: 'Error',
          suggestion: 'Fix it',
        }),
      ).toBeTruthy();
      expect(
        serverMessageSchema.parse({
          ...baseMessage,
          type: 'ready' as const,
          configPresent: false,
          hasScannedData: false,
          demoMode: true,
          demoRepositories: [
            {
              id: 'deckgraph-fixture',
              label: 'Deckgraph Fixture',
              url: 'https://github.com/simenzzz/Deckgraph.git',
              description: 'A public demo repository.',
            },
          ],
        }),
      ).toBeTruthy();
    });

    it('rejects invalid message types', () => {
      expect(() => serverMessageSchema.parse({ ...baseMessage, type: 'invalid' })).toThrow();
    });

    it('rejects empty requestId', () => {
      expect(() =>
        serverMessageSchema.parse({
          requestId: '',
          type: 'error',
          message: 'Error',
          suggestion: 'Fix it',
        }),
      ).toThrow();
    });

    it('rejects missing message body fields', () => {
      expect(() =>
        serverMessageSchema.parse({
          ...baseMessage,
          type: 'project_overview',
        }),
      ).toThrow();
    });
  });

  describe('parse functions', () => {
    it('parseAnalyzeImportsMessage parses valid message', () => {
      const message = {
        ...baseMessage,
        type: 'analyze_imports' as const,
        modulePath: 'services/auth',
      };
      const result = parseAnalyzeImportsMessage(message);
      expect(result.type).toBe('analyze_imports');
      expect(result.modulePath).toBe('services/auth');
    });

    it('parseEnrichDependencyMessage parses valid message', () => {
      const message = {
        ...baseMessage,
        type: 'enrich_dependency' as const,
        ecosystem: 'npm' as const,
        packageName: 'react',
      };
      const result = parseEnrichDependencyMessage(message);
      expect(result.type).toBe('enrich_dependency');
      expect(result.packageName).toBe('react');
    });

    it('parseSyncMessage parses valid message', () => {
      const message = { ...baseMessage, type: 'sync' as const };
      const result = parseSyncMessage(message);
      expect(result.type).toBe('sync');
    });

    it('parseProjectOverviewMessage parses valid message', () => {
      const message = {
        ...baseMessage,
        type: 'project_overview' as const,
        data: validProject,
      };
      const result = parseProjectOverviewMessage(message);
      expect(result.type).toBe('project_overview');
      expect(result.data.root).toBe('/test');
    });

    it('parseModuleUpdatedMessage parses valid message', () => {
      const message = {
        ...baseMessage,
        type: 'module_updated' as const,
        module: validModule,
      };
      const result = parseModuleUpdatedMessage(message);
      expect(result.type).toBe('module_updated');
      expect(result.module.name).toBe('test');
    });

    it('parseDependencyEnrichedMessage parses valid message', () => {
      const message = {
        ...baseMessage,
        type: 'dependency_enriched' as const,
        dependency: validDependency,
      };
      const result = parseDependencyEnrichedMessage(message);
      expect(result.type).toBe('dependency_enriched');
      expect(result.dependency.name).toBe('test');
    });
  });
});
