/**
 * Zod schemas for WebSocket message types.
 *
 * Validates all client→server and server→client messages.
 *
 * Canonical types live in '../types/messages.ts'. Schema files only
 * export schemas and parse functions — never type aliases.
 */

import { z } from 'zod';
import { packageActionResultSchema, packageBatchOperationSchema } from './actions.js';
import { demoRepositorySchema, dependencySchema, dependencyScopeSchema, ecosystemSchema, moduleSchema, projectSchema, workspaceSchema } from './project.js';
import { viewQuerySchema, viewResultSchema } from './views.js';

import type {
  ScanProjectMessage,
  ImportDemoRepoMessage,
  ScanWorkspaceMessage,
  ViewQueryMessage,
  AnalyzeImportsMessage,
  EnrichDependencyMessage,
  SyncMessage,
  PackageUpdateMessage,
  PackageInstallMessage,
  PackageRemoveMessage,
  PackageBatchMessage,
  ClientMessage,
  ProjectOverviewMessage,
  WorkspaceOverviewMessage,
  ViewResultMessage,
  ModuleUpdatedMessage,
  DependencyEnrichedMessage,
  ProgressMessage,
  ErrorMessage,
  NotificationMessage,
  FileChangeDetectedMessage,
  PackageActionResultMessage,
  PackageBatchResultMessage,
  ReadyMessage,
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

export const importDemoRepoMessageSchema = z.object({
  type: z.literal('import_demo_repo'),
  requestId: z.string().min(1).max(128),
  repoId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
});

export const scanWorkspaceMessageSchema = z.object({
  type: z.literal('scan_workspace'),
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

export const packageUpdateMessageSchema = z.object({
  type: z.literal('package_update'),
  requestId: z.string().min(1).max(128),
  ecosystem: ecosystemSchema,
  packageName: z.string().min(1).max(512),
  modulePath: z.string().min(1).max(1024),
  targetVersion: z.string().min(1).max(128),
});

export const packageInstallMessageSchema = z.object({
  type: z.literal('package_install'),
  requestId: z.string().min(1).max(128),
  ecosystem: ecosystemSchema,
  packageName: z.string().min(1).max(512),
  modulePath: z.string().min(1).max(1024),
  version: z.string().max(128).nullable(),
  scope: dependencyScopeSchema,
});

export const packageRemoveMessageSchema = z.object({
  type: z.literal('package_remove'),
  requestId: z.string().min(1).max(128),
  ecosystem: ecosystemSchema,
  packageName: z.string().min(1).max(512),
  modulePath: z.string().min(1).max(1024),
});

export const packageBatchMessageSchema = z.object({
  type: z.literal('package_batch'),
  requestId: z.string().min(1).max(128),
  operations: z.array(packageBatchOperationSchema).min(1).max(200),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  scanProjectMessageSchema,
  importDemoRepoMessageSchema,
  scanWorkspaceMessageSchema,
  viewQueryMessageSchema,
  analyzeImportsMessageSchema,
  enrichDependencyMessageSchema,
  syncMessageSchema,
  packageUpdateMessageSchema,
  packageInstallMessageSchema,
  packageRemoveMessageSchema,
  packageBatchMessageSchema,
]);

// ============================================================================
// Server Messages (Backend → UI)
// ============================================================================

export const projectOverviewMessageSchema = z.object({
  type: z.literal('project_overview'),
  requestId: z.string().min(1).max(128),
  data: projectSchema,
});

export const workspaceOverviewMessageSchema = z.object({
  type: z.literal('workspace_overview'),
  requestId: z.string().min(1).max(128),
  data: workspaceSchema,
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

export const notificationMessageSchema = z.object({
  type: z.literal('notification'),
  requestId: z.string().min(1).max(128),
  severity: z.enum(['info', 'warning', 'error']),
  title: z.string().min(1).max(256),
  body: z.string().min(1).max(4096),
  timestamp: z.string().min(1).max(64),
});

export const fileChangeDetectedMessageSchema = z.object({
  type: z.literal('file_change_detected'),
  requestId: z.string().min(1).max(128),
  affectedModules: z.array(z.string().min(1).max(1024)),
  timestamp: z.string().min(1).max(64),
});

export const packageActionResultMessageSchema = z.object({
  type: z.literal('package_action_result'),
  requestId: z.string().min(1).max(128),
  result: packageActionResultSchema,
});

export const packageBatchResultMessageSchema = z.object({
  type: z.literal('package_batch_result'),
  requestId: z.string().min(1).max(128),
  results: z.array(packageActionResultSchema),
  completedCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  stoppedEarly: z.boolean(),
});

export const readyMessageSchema = z.object({
  type: z.literal('ready'),
  requestId: z.string().min(1).max(128),
  configPresent: z.boolean(),
  hasScannedData: z.boolean(),
  demoMode: z.boolean(),
  demoRepositories: z.array(demoRepositorySchema).max(20),
});

export const serverMessageSchema = z.discriminatedUnion('type', [
  projectOverviewMessageSchema,
  workspaceOverviewMessageSchema,
  viewResultMessageSchema,
  moduleUpdatedMessageSchema,
  dependencyEnrichedMessageSchema,
  progressMessageSchema,
  errorMessageSchema,
  notificationMessageSchema,
  fileChangeDetectedMessageSchema,
  packageActionResultMessageSchema,
  packageBatchResultMessageSchema,
  readyMessageSchema,
]);

// ============================================================================
// Parse Functions
// ============================================================================

export const parseClientMessage = (value: unknown) => clientMessageSchema.parse(value);
export const parseScanProjectMessage = (value: unknown) => scanProjectMessageSchema.parse(value);
export const parseImportDemoRepoMessage = (value: unknown) => importDemoRepoMessageSchema.parse(value);
export const parseScanWorkspaceMessage = (value: unknown) => scanWorkspaceMessageSchema.parse(value);
export const parseViewQueryMessage = (value: unknown) => viewQueryMessageSchema.parse(value);
export const parseAnalyzeImportsMessage = (value: unknown) =>
  analyzeImportsMessageSchema.parse(value);
export const parseEnrichDependencyMessage = (value: unknown) =>
  enrichDependencyMessageSchema.parse(value);
export const parseSyncMessage = (value: unknown) => syncMessageSchema.parse(value);

export const parseServerMessage = (value: unknown) => serverMessageSchema.parse(value);
export const parseProjectOverviewMessage = (value: unknown) =>
  projectOverviewMessageSchema.parse(value);
export const parseWorkspaceOverviewMessage = (value: unknown) =>
  workspaceOverviewMessageSchema.parse(value);
export const parseViewResultMessage = (value: unknown) => viewResultMessageSchema.parse(value);
export const parseModuleUpdatedMessage = (value: unknown) =>
  moduleUpdatedMessageSchema.parse(value);
export const parseDependencyEnrichedMessage = (value: unknown) =>
  dependencyEnrichedMessageSchema.parse(value);
export const parseProgressMessage = (value: unknown) => progressMessageSchema.parse(value);
export const parseErrorMessage = (value: unknown) => errorMessageSchema.parse(value);
export const parseNotificationMessage = (value: unknown) => notificationMessageSchema.parse(value);
export const parseFileChangeDetectedMessage = (value: unknown) =>
  fileChangeDetectedMessageSchema.parse(value);
export const parsePackageUpdateMessage = (value: unknown) =>
  packageUpdateMessageSchema.parse(value);
export const parsePackageInstallMessage = (value: unknown) =>
  packageInstallMessageSchema.parse(value);
export const parsePackageRemoveMessage = (value: unknown) =>
  packageRemoveMessageSchema.parse(value);
export const parsePackageBatchMessage = (value: unknown) =>
  packageBatchMessageSchema.parse(value);
export const parsePackageActionResultMessage = (value: unknown) =>
  packageActionResultMessageSchema.parse(value);
export const parsePackageBatchResultMessage = (value: unknown) =>
  packageBatchResultMessageSchema.parse(value);

export const parseReadyMessage = (value: unknown) => readyMessageSchema.parse(value);

// ============================================================================
// Compile-time Assertions: bidirectional schema ↔ interface compatibility
// ============================================================================

// Exported to satisfy noUnusedLocals.

export type _MessageSchemaAssertions = [
  // Forward direction: ZodOutput ⊆ Interface
  Expect<z.infer<typeof scanProjectMessageSchema> extends ScanProjectMessage ? true : false>,
  Expect<z.infer<typeof importDemoRepoMessageSchema> extends ImportDemoRepoMessage ? true : false>,
  Expect<z.infer<typeof scanWorkspaceMessageSchema> extends ScanWorkspaceMessage ? true : false>,
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
  Expect<
    z.infer<typeof workspaceOverviewMessageSchema> extends WorkspaceOverviewMessage ? true : false
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
  Expect<z.infer<typeof notificationMessageSchema> extends NotificationMessage ? true : false>,
  Expect<
    z.infer<typeof fileChangeDetectedMessageSchema> extends FileChangeDetectedMessage ? true : false
  >,
  Expect<z.infer<typeof serverMessageSchema> extends ServerMessage ? true : false>,
  Expect<z.infer<typeof packageUpdateMessageSchema> extends PackageUpdateMessage ? true : false>,
  Expect<z.infer<typeof packageInstallMessageSchema> extends PackageInstallMessage ? true : false>,
  Expect<z.infer<typeof packageRemoveMessageSchema> extends PackageRemoveMessage ? true : false>,
  Expect<z.infer<typeof packageBatchMessageSchema> extends PackageBatchMessage ? true : false>,
  Expect<
    z.infer<typeof packageActionResultMessageSchema> extends PackageActionResultMessage
      ? true
      : false
  >,
  Expect<
    z.infer<typeof packageBatchResultMessageSchema> extends PackageBatchResultMessage
      ? true
      : false
  >,

  // Reverse direction: Interface ⊆ ZodOutput
  Expect<Mutable<ScanProjectMessage> extends z.infer<typeof scanProjectMessageSchema> ? true : false>,
  Expect<Mutable<ImportDemoRepoMessage> extends z.infer<typeof importDemoRepoMessageSchema> ? true : false>,
  Expect<Mutable<ScanWorkspaceMessage> extends z.infer<typeof scanWorkspaceMessageSchema> ? true : false>,
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
  Expect<
    Mutable<WorkspaceOverviewMessage> extends z.infer<typeof workspaceOverviewMessageSchema>
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
  Expect<Mutable<NotificationMessage> extends z.infer<typeof notificationMessageSchema> ? true : false>,
  Expect<
    Mutable<FileChangeDetectedMessage> extends z.infer<typeof fileChangeDetectedMessageSchema>
      ? true
      : false
  >,
  Expect<Mutable<ServerMessage> extends z.infer<typeof serverMessageSchema> ? true : false>,
  Expect<Mutable<PackageUpdateMessage> extends z.infer<typeof packageUpdateMessageSchema> ? true : false>,
  Expect<Mutable<PackageInstallMessage> extends z.infer<typeof packageInstallMessageSchema> ? true : false>,
  Expect<Mutable<PackageRemoveMessage> extends z.infer<typeof packageRemoveMessageSchema> ? true : false>,
  Expect<Mutable<PackageBatchMessage> extends z.infer<typeof packageBatchMessageSchema> ? true : false>,
  Expect<
    Mutable<PackageActionResultMessage> extends z.infer<typeof packageActionResultMessageSchema>
      ? true
      : false
  >,
  Expect<
    Mutable<PackageBatchResultMessage> extends z.infer<typeof packageBatchResultMessageSchema>
      ? true
      : false
  >,

  // ReadyMessage
  Expect<z.infer<typeof readyMessageSchema> extends ReadyMessage ? true : false>,
  Expect<Mutable<ReadyMessage> extends z.infer<typeof readyMessageSchema> ? true : false>,
];
