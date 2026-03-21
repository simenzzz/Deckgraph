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

export type { ViewQuery, ViewResult, ModuleView, ViewSummary } from './types/views.js';

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
  ServerMessage,
  ProjectOverviewMessage,
  ViewResultMessage,
  ModuleUpdatedMessage,
  DependencyEnrichedMessage,
  ProgressMessage,
  ErrorMessage,
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
} from './schemas/messages.js';
