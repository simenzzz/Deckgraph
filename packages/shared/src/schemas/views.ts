/**
 * Zod schemas for view types.
 *
 * Validates ViewQuery from client messages and ViewResult
 * returned by the query engine.
 *
 * Canonical types live in '../types/views.ts'. Schema files only
 * export schemas and parse functions — never type aliases.
 */

import { z } from 'zod';
import {
  analysisStateSchema,
  crossEdgeSchema,
  crossEdgeTypeSchema,
  dependencySchema,
  dependencyScopeSchema,
  ecosystemSchema,
} from './project.js';

import type { ViewQuery, ModuleView, ViewSummary, ViewResult } from '../types/views.js';
import type { Expect, Mutable } from '../types/typeUtils.js';

// View Query

export const viewQuerySchema = z.object({
  ecosystems: z.array(ecosystemSchema).max(5).optional(),
  modules: z.array(z.string().min(1).max(1024)).max(256).optional(),
  scopes: z.array(dependencyScopeSchema).max(5).optional(),
  depth: z.number().int().positive().max(32).optional(),
  concern: z.string().min(1).max(128).optional(),
  search: z.string().max(256).optional(),
  showCrossEdges: z.boolean().optional(),
  crossEdgeTypes: z.array(crossEdgeTypeSchema).max(5).optional(),
  analysisLevel: z.enum(['manifest', 'imports', 'registry']).optional(),
});

// Module View

export const moduleViewSchema = z.object({
  path: z.string().min(1).max(1024),
  name: z.string().min(1).max(512),
  ecosystem: ecosystemSchema,
  analysisState: analysisStateSchema,
  dependencies: z.array(dependencySchema).max(10000),
  totalDependencyCount: z.number().int().nonnegative(),
});

// View Summary

export const viewSummarySchema = z.object({
  totalDeps: z.number().int().nonnegative(),
  byEcosystem: z.object({
    npm: z.number().int().nonnegative(),
    pypi: z.number().int().nonnegative(),
    cargo: z.number().int().nonnegative(),
    go: z.number().int().nonnegative(),
    maven: z.number().int().nonnegative(),
  }),
  byScope: z.object({
    runtime: z.number().int().nonnegative(),
    dev: z.number().int().nonnegative(),
    build: z.number().int().nonnegative(),
    optional: z.number().int().nonnegative(),
    peer: z.number().int().nonnegative(),
  }),
  outdatedCount: z.number().int().nonnegative().nullable(),
  unusedCount: z.number().int().nonnegative().nullable(),
  moduleCount: z.number().int().nonnegative(),
  crossEdgeCount: z.number().int().nonnegative(),
});

// View Result

export const viewResultSchema = z.object({
  modules: z.array(moduleViewSchema).max(1000),
  crossEdges: z.array(crossEdgeSchema).max(10000),
  summary: viewSummarySchema,
});

// Parse Functions

export const parseViewQuery = (value: unknown) => viewQuerySchema.parse(value);
export const parseModuleView = (value: unknown) => moduleViewSchema.parse(value);
export const parseViewSummary = (value: unknown) => viewSummarySchema.parse(value);
export const parseViewResult = (value: unknown) => viewResultSchema.parse(value);

// Compile-time Assertions: bidirectional schema ↔ interface compatibility

// Exported to satisfy noUnusedLocals.

export type _ViewSchemaAssertions = [
  // Forward direction: ZodOutput ⊆ Interface
  Expect<z.infer<typeof viewQuerySchema> extends ViewQuery ? true : false>,
  Expect<z.infer<typeof moduleViewSchema> extends ModuleView ? true : false>,
  Expect<z.infer<typeof viewSummarySchema> extends ViewSummary ? true : false>,
  Expect<z.infer<typeof viewResultSchema> extends ViewResult ? true : false>,

  // Reverse direction: Interface ⊆ ZodOutput
  Expect<Mutable<ViewQuery> extends z.infer<typeof viewQuerySchema> ? true : false>,
  Expect<Mutable<ModuleView> extends z.infer<typeof moduleViewSchema> ? true : false>,
  Expect<Mutable<ViewSummary> extends z.infer<typeof viewSummarySchema> ? true : false>,
  Expect<Mutable<ViewResult> extends z.infer<typeof viewResultSchema> ? true : false>,
];
