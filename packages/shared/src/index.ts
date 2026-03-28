/**
 * @deckgraph/shared
 *
 * Shared types and Zod schemas for Deckgraph.
 */

// ============================================================================
// Types - Project
// ============================================================================

export type {
  Ecosystem,
  AnalysisState,
  DependencyScope,
  CrossEdgeType,
  Project,
  ProjectConfig,
  Module,
  Dependency,
  RegistryMeta,
  CrossEdge,
  CrossEdgeEndpoint,
  UnifiedGraph,
} from './types/project.js';

// ============================================================================
// Types - Adapters
// ============================================================================

export type {
  EcosystemAdapter,
  ManifestResult,
  ParsedImport,
  ImportPackageMap,
  AdapterRegistry,
  MinimalDependency,
} from './types/adapters.js';

// ============================================================================
// Types - Views
// ============================================================================

export type { ViewQuery, ViewResult, ModuleView, ViewSummary, OutdatedSeverity } from './types/views.js';

// ============================================================================
// Types - Actions
// ============================================================================

export type {
  PackageAction,
  PackageActionStatus,
  PackageActionResult,
  PackageBatchOperation,
} from './types/actions.js';

// ============================================================================
// Types - Messages
// ============================================================================

export type {
  ClientMessage,
  ScanProjectMessage,
  ViewQueryMessage,
  AnalyzeImportsMessage,
  EnrichDependencyMessage,
  SyncMessage,
  PackageUpdateMessage,
  PackageInstallMessage,
  PackageRemoveMessage,
  PackageBatchMessage,
  ServerMessage,
  ProjectOverviewMessage,
  ViewResultMessage,
  ModuleUpdatedMessage,
  DependencyEnrichedMessage,
  ProgressMessage,
  ErrorMessage,
  FileChangeDetectedMessage,
  PackageActionResultMessage,
  PackageBatchResultMessage,
} from './types/messages.js';

// ============================================================================
// Schemas - Project
// ============================================================================

export {
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
  parseEcosystem,
  parseAnalysisState,
  parseDependencyScope,
  parseCrossEdgeType,
  parseRegistryMeta,
  parseCrossEdge,
  parseDependency,
  parseModule,
  parseProjectConfig,
  parseProject,
} from './schemas/project.js';

// ============================================================================
// Schemas - Adapters
// ============================================================================

export {
  parsedImportSchema,
  minimalDependencySchema,
  manifestResultSchema,
  parseParsedImport,
  parseManifestResult,
} from './schemas/adapters.js';

// ============================================================================
// Schemas - Views
// ============================================================================

export {
  viewQuerySchema,
  moduleViewSchema,
  viewSummarySchema,
  viewResultSchema,
  parseViewQuery,
  parseModuleView,
  parseViewSummary,
  parseViewResult,
} from './schemas/views.js';

// ============================================================================
// Schemas - Actions
// ============================================================================

export {
  packageActionSchema,
  packageActionStatusSchema,
  packageActionResultSchema,
  packageBatchOperationSchema,
  parsePackageAction,
  parsePackageActionStatus,
  parsePackageActionResult,
  parsePackageBatchOperation,
} from './schemas/actions.js';

// ============================================================================
// Analysis
// ============================================================================

export { classifyOutdated } from './analysis/outdated.js';

// ============================================================================
// Schemas - Messages
// ============================================================================

export {
  scanProjectMessageSchema,
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
  parseClientMessage,
  parseScanProjectMessage,
  parseViewQueryMessage,
  parseAnalyzeImportsMessage,
  parseEnrichDependencyMessage,
  parseSyncMessage,
  parseServerMessage,
  parseProjectOverviewMessage,
  parseViewResultMessage,
  parseModuleUpdatedMessage,
  parseDependencyEnrichedMessage,
  parseProgressMessage,
  parseErrorMessage,
  fileChangeDetectedMessageSchema,
  parseFileChangeDetectedMessage,
  packageUpdateMessageSchema,
  packageInstallMessageSchema,
  packageRemoveMessageSchema,
  packageBatchMessageSchema,
  packageActionResultMessageSchema,
  packageBatchResultMessageSchema,
  parsePackageUpdateMessage,
  parsePackageInstallMessage,
  parsePackageRemoveMessage,
  parsePackageBatchMessage,
  parsePackageActionResultMessage,
  parsePackageBatchResultMessage,
} from './schemas/messages.js';
