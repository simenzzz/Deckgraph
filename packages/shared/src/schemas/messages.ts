/**
 * Zod schemas for WebSocket message types.
 *
 * Validates all client→server and server→client messages.
 *
 * Canonical types live in '../types/messages.ts'. Schema files only
 * export schemas and parse functions — never type aliases.
 */

import { z } from 'zod';
import { dependencySchema, ecosystemSchema, moduleSchema, projectSchema } from './project.js';
import { viewQuerySchema, viewResultSchema } from './views.js';

import type {
  ScanProjectMessage,
  ViewQueryMessage,
  AnalyzeImportsMessage,
  EnrichDependencyMessage,
  SyncMessage,
  ClientMessage,
  ProjectOverviewMessage,
  ViewResultMessage,
  ModuleUpdatedMessage,
  DependencyEnrichedMessage,
  ProgressMessage,
  ErrorMessage,
  ServerMessage,
} from '../types/messages.js';
import type { Expect, Mutable } from '../types/typeUtils.js';

// ============================================================================
// Client Messages (UI → Backend)
// ============================================================================

export const scanProjectMessageSchema = z.object({
  type: z.literal('scan_project'),
  requestId: z.string().min(1).max(128),
});

export const viewQueryMessageSchema = z.object({
  type: z.literal('view_query'),
  requestId: z.string().min(1).max(128),
  query: viewQuerySchema,
});

export const analyzeImportsMessageSchema = z.object({
  type: z.literal('analyze_imports'),
  requestId: z.string().min(1).max(128),
  modulePath: z.string().min(1).max(1024),
});

export const enrichDependencyMessageSchema = z.object({
  type: z.literal('enrich_dependency'),
  requestId: z.string().min(1).max(128),
  ecosystem: ecosystemSchema,
  packageName: z.string().min(1).max(512),
});

export const syncMessageSchema = z.object({
  type: z.literal('sync'),
  requestId: z.string().min(1).max(128),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  scanProjectMessageSchema,
  viewQueryMessageSchema,
  analyzeImportsMessageSchema,
  enrichDependencyMessageSchema,
  syncMessageSchema,
]);

// ============================================================================
// Server Messages (Backend → UI)
// ============================================================================

export const projectOverviewMessageSchema = z.object({
  type: z.literal('project_overview'),
  requestId: z.string().min(1).max(128),
  data: projectSchema,
});

export const viewResultMessageSchema = z.object({
  type: z.literal('view_result'),
  requestId: z.string().min(1).max(128),
  data: viewResultSchema,
});

export const moduleUpdatedMessageSchema = z.object({
  type: z.literal('module_updated'),
  requestId: z.string().min(1).max(128),
  module: moduleSchema,
});

export const dependencyEnrichedMessageSchema = z.object({
  type: z.literal('dependency_enriched'),
  requestId: z.string().min(1).max(128),
  dependency: dependencySchema,
});

export const progressMessageSchema = z.object({
  type: z.literal('progress'),
  requestId: z.string().min(1).max(128),
  message: z.string().min(1).max(1024),
  phase: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

export const errorMessageSchema = z.object({
  type: z.literal('error'),
  requestId: z.string().min(1).max(128),
  message: z.string().min(1).max(2048),
  suggestion: z.string().min(1).max(2048),
});

export const serverMessageSchema = z.discriminatedUnion('type', [
  projectOverviewMessageSchema,
  viewResultMessageSchema,
  moduleUpdatedMessageSchema,
  dependencyEnrichedMessageSchema,
  progressMessageSchema,
  errorMessageSchema,
]);

// ============================================================================
// Parse Functions
// ============================================================================

export const parseClientMessage = (value: unknown) => clientMessageSchema.parse(value);
export const parseScanProjectMessage = (value: unknown) => scanProjectMessageSchema.parse(value);
export const parseViewQueryMessage = (value: unknown) => viewQueryMessageSchema.parse(value);
export const parseAnalyzeImportsMessage = (value: unknown) =>
  analyzeImportsMessageSchema.parse(value);
export const parseEnrichDependencyMessage = (value: unknown) =>
  enrichDependencyMessageSchema.parse(value);
export const parseSyncMessage = (value: unknown) => syncMessageSchema.parse(value);

export const parseServerMessage = (value: unknown) => serverMessageSchema.parse(value);
export const parseProjectOverviewMessage = (value: unknown) =>
  projectOverviewMessageSchema.parse(value);
export const parseViewResultMessage = (value: unknown) => viewResultMessageSchema.parse(value);
export const parseModuleUpdatedMessage = (value: unknown) =>
  moduleUpdatedMessageSchema.parse(value);
export const parseDependencyEnrichedMessage = (value: unknown) =>
  dependencyEnrichedMessageSchema.parse(value);
export const parseProgressMessage = (value: unknown) => progressMessageSchema.parse(value);
export const parseErrorMessage = (value: unknown) => errorMessageSchema.parse(value);

// ============================================================================
// Compile-time Assertions: bidirectional schema ↔ interface compatibility
// ============================================================================

// Exported to satisfy noUnusedLocals.

export type _MessageSchemaAssertions = [
  // Forward direction: ZodOutput ⊆ Interface
  Expect<z.infer<typeof scanProjectMessageSchema> extends ScanProjectMessage ? true : false>,
  Expect<z.infer<typeof viewQueryMessageSchema> extends ViewQueryMessage ? true : false>,
  Expect<z.infer<typeof analyzeImportsMessageSchema> extends AnalyzeImportsMessage ? true : false>,
  Expect<
    z.infer<typeof enrichDependencyMessageSchema> extends EnrichDependencyMessage ? true : false
  >,
  Expect<z.infer<typeof syncMessageSchema> extends SyncMessage ? true : false>,
  Expect<z.infer<typeof clientMessageSchema> extends ClientMessage ? true : false>,
  Expect<
    z.infer<typeof projectOverviewMessageSchema> extends ProjectOverviewMessage ? true : false
  >,
  Expect<z.infer<typeof viewResultMessageSchema> extends ViewResultMessage ? true : false>,
  Expect<z.infer<typeof moduleUpdatedMessageSchema> extends ModuleUpdatedMessage ? true : false>,
  Expect<
    z.infer<typeof dependencyEnrichedMessageSchema> extends DependencyEnrichedMessage
      ? true
      : false
  >,
  Expect<z.infer<typeof progressMessageSchema> extends ProgressMessage ? true : false>,
  Expect<z.infer<typeof errorMessageSchema> extends ErrorMessage ? true : false>,
  Expect<z.infer<typeof serverMessageSchema> extends ServerMessage ? true : false>,

  // Reverse direction: Interface ⊆ ZodOutput
  Expect<Mutable<ScanProjectMessage> extends z.infer<typeof scanProjectMessageSchema> ? true : false>,
  Expect<Mutable<ViewQueryMessage> extends z.infer<typeof viewQueryMessageSchema> ? true : false>,
  Expect<Mutable<AnalyzeImportsMessage> extends z.infer<typeof analyzeImportsMessageSchema> ? true : false>,
  Expect<
    Mutable<EnrichDependencyMessage> extends z.infer<typeof enrichDependencyMessageSchema>
      ? true
      : false
  >,
  Expect<Mutable<SyncMessage> extends z.infer<typeof syncMessageSchema> ? true : false>,
  Expect<Mutable<ClientMessage> extends z.infer<typeof clientMessageSchema> ? true : false>,
  Expect<
    Mutable<ProjectOverviewMessage> extends z.infer<typeof projectOverviewMessageSchema>
      ? true
      : false
  >,
  Expect<Mutable<ViewResultMessage> extends z.infer<typeof viewResultMessageSchema> ? true : false>,
  Expect<Mutable<ModuleUpdatedMessage> extends z.infer<typeof moduleUpdatedMessageSchema> ? true : false>,
  Expect<
    Mutable<DependencyEnrichedMessage> extends z.infer<typeof dependencyEnrichedMessageSchema>
      ? true
      : false
  >,
  Expect<Mutable<ProgressMessage> extends z.infer<typeof progressMessageSchema> ? true : false>,
  Expect<Mutable<ErrorMessage> extends z.infer<typeof errorMessageSchema> ? true : false>,
  Expect<Mutable<ServerMessage> extends z.infer<typeof serverMessageSchema> ? true : false>,
];
