/**
 * Zod schemas for project types.
 *
 * These schemas validate external data (registry API responses,
 * parsed manifest content, WebSocket messages) to ensure type safety.
 *
 * Canonical types live in '../types/project.ts'. Schema files only
 * export schemas and parse functions — never type aliases.
 */

import { z } from 'zod';

import type {
  Ecosystem,
  AnalysisState,
  DependencyScope,
  CrossEdgeType,
  RegistryMeta,
  CrossEdgeEndpoint,
  CrossEdge,
  Dependency,
  Module,
  ProjectConfig,
  Project,
  HookEntry,
  HooksConfig,
  WorkspaceConfig,
  CrossRootVersion,
  CrossRootDependency,
  Workspace,
  DemoRepository,
} from '../types/project.js';
import type { Expect, Mutable } from '../types/typeUtils.js';

// Basic Enums

export const ecosystemSchema = z.enum(['npm', 'pypi', 'cargo', 'go', 'maven']);

export const analysisStateSchema = z.enum([
  'manifest-only',
  'imports-resolved',
  'registry-enriched',
]);

export const dependencyScopeSchema = z.enum(['runtime', 'dev', 'build', 'optional', 'peer']);

export const crossEdgeTypeSchema = z.enum(['proto', 'openapi', 'ffi', 'build', 'shared-config']);

// Registry Metadata

export const registryMetaSchema = z.object({
  latestVersion: z.string().min(1).max(256),
  description: z.string().max(4096),
  license: z.string().max(256).nullable(),
  homepage: z.string().url().max(2048).nullable(),
  downloads: z.number().nonnegative().nullable(),
  deprecated: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
});

// Cross Edge Types

export const crossEdgeEndpointSchema = z.object({
  module: z.string().min(1).max(1024),
  ecosystem: ecosystemSchema,
});

export const crossEdgeSchema = z.object({
  from: crossEdgeEndpointSchema,
  to: crossEdgeEndpointSchema,
  type: crossEdgeTypeSchema,
  evidence: z.string().min(1).max(2048),
  confidence: z.number().min(0).max(1),
});

// Dependency Type

export const dependencySchema = z.object({
  name: z.string().min(1).max(512),
  ecosystem: ecosystemSchema,
  version: z.string().min(1).max(256),
  constraint: z.string().max(512),
  scope: dependencyScopeSchema,
  source: z.enum(['manifest', 'import-only', 'both']),
  local: z.boolean().optional(),
  concerns: z.array(z.string().min(1).max(128)).max(64),
  usedInFiles: z.array(z.string().min(1).max(1024)).max(10000).nullable(),
  transitiveDeps: z.array(z.string().min(1).max(512)).max(10000).nullable(),
  registryMeta: registryMetaSchema.nullable(),
});

// Module Types

export const moduleSchema = z.object({
  path: z.string().min(1).max(1024),
  name: z.string().min(1).max(512),
  ecosystem: ecosystemSchema,
  manifests: z.array(z.string().min(1).max(256)).max(32),
  dependencies: z.array(dependencySchema).max(10000),
  analysisState: analysisStateSchema,
});

// Project Config

export const projectConfigSchema = z.object({
  ignorePaths: z.array(z.string().min(1).max(512)).max(256),
  concernOverrides: z.record(z.string().min(1).max(512), z.array(z.string().min(1).max(128)).max(64)),
});

// Project Type

export const projectSchema = z.object({
  root: z.string().min(1).max(1024),
  config: projectConfigSchema.nullable(),
  modules: z.array(moduleSchema).max(1000),
  crossEdges: z.array(crossEdgeSchema).max(10000),
  lastScannedAt: z.string().datetime(),
});

// Workspace Types

export const hookEntrySchema = z.object({
  cmd: z.string().min(1).max(4096),
});

export const hooksConfigSchema = z.object({
  onScanComplete: z.array(hookEntrySchema).max(32),
  onOutdated: z.array(hookEntrySchema).max(32),
  onUnused: z.array(hookEntrySchema).max(32),
  onLicenseViolation: z.array(hookEntrySchema).max(32),
});

export const workspaceConfigSchema = projectConfigSchema.extend({
  roots: z.array(z.string().min(1).max(1024)).min(1).max(64),
  hooks: hooksConfigSchema,
});

export const crossRootVersionSchema = z.object({
  projectRoot: z.string().min(1).max(1024),
  modulePath: z.string().min(1).max(1024),
  version: z.string().min(1).max(256),
  constraint: z.string().max(512),
});

export const crossRootDependencySchema = z.object({
  ecosystem: ecosystemSchema,
  packageName: z.string().min(1).max(512),
  versions: z.array(crossRootVersionSchema).min(2).max(256),
});

export const workspaceSchema = z.object({
  projects: z.array(projectSchema).min(1).max(64),
  config: workspaceConfigSchema.nullable(),
  crossRootDeps: z.array(crossRootDependencySchema).max(10000),
  lastScannedAt: z.string().datetime(),
});

export const demoRepositorySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  label: z.string().min(1).max(128),
  url: z.string().url().max(2048),
  description: z.string().min(1).max(512),
});

// Parse Functions

export const parseEcosystem = (value: unknown) => ecosystemSchema.parse(value);
export const parseAnalysisState = (value: unknown) => analysisStateSchema.parse(value);
export const parseDependencyScope = (value: unknown) => dependencyScopeSchema.parse(value);
export const parseCrossEdgeType = (value: unknown) => crossEdgeTypeSchema.parse(value);
export const parseRegistryMeta = (value: unknown) => registryMetaSchema.parse(value);
export const parseCrossEdge = (value: unknown) => crossEdgeSchema.parse(value);
export const parseDependency = (value: unknown) => dependencySchema.parse(value);
export const parseModule = (value: unknown) => moduleSchema.parse(value);
export const parseProjectConfig = (value: unknown) => projectConfigSchema.parse(value);
export const parseProject = (value: unknown) => projectSchema.parse(value);

// Workspace parse functions
export const parseHookEntry = (value: unknown) => hookEntrySchema.parse(value);
export const parseHooksConfig = (value: unknown) => hooksConfigSchema.parse(value);
export const parseWorkspaceConfig = (value: unknown) => workspaceConfigSchema.parse(value);
export const parseCrossRootVersion = (value: unknown) => crossRootVersionSchema.parse(value);
export const parseCrossRootDependency = (value: unknown) => crossRootDependencySchema.parse(value);
export const parseWorkspace = (value: unknown) => workspaceSchema.parse(value);
export const parseDemoRepository = (value: unknown) => demoRepositorySchema.parse(value);

// Compile-time Assertions: bidirectional schema ↔ interface compatibility

// Forward: Zod output extends interface (catches extra schema fields)
// Reverse: Mutable<Interface> extends Zod output (catches missing schema fields)
// Exported to satisfy noUnusedLocals.

export type _ProjectSchemaAssertions = [
  // Forward direction: ZodOutput ⊆ Interface
  Expect<z.infer<typeof ecosystemSchema> extends Ecosystem ? true : false>,
  Expect<z.infer<typeof analysisStateSchema> extends AnalysisState ? true : false>,
  Expect<z.infer<typeof dependencyScopeSchema> extends DependencyScope ? true : false>,
  Expect<z.infer<typeof crossEdgeTypeSchema> extends CrossEdgeType ? true : false>,
  Expect<z.infer<typeof registryMetaSchema> extends RegistryMeta ? true : false>,
  Expect<z.infer<typeof crossEdgeEndpointSchema> extends CrossEdgeEndpoint ? true : false>,
  Expect<z.infer<typeof crossEdgeSchema> extends CrossEdge ? true : false>,
  Expect<z.infer<typeof dependencySchema> extends Dependency ? true : false>,
  Expect<z.infer<typeof moduleSchema> extends Module ? true : false>,
  Expect<z.infer<typeof projectConfigSchema> extends ProjectConfig ? true : false>,
  Expect<z.infer<typeof projectSchema> extends Project ? true : false>,
  Expect<z.infer<typeof hookEntrySchema> extends HookEntry ? true : false>,
  Expect<z.infer<typeof hooksConfigSchema> extends HooksConfig ? true : false>,
  Expect<z.infer<typeof workspaceConfigSchema> extends WorkspaceConfig ? true : false>,
  Expect<z.infer<typeof crossRootVersionSchema> extends CrossRootVersion ? true : false>,
  Expect<z.infer<typeof crossRootDependencySchema> extends CrossRootDependency ? true : false>,
  Expect<z.infer<typeof workspaceSchema> extends Workspace ? true : false>,
  Expect<z.infer<typeof demoRepositorySchema> extends DemoRepository ? true : false>,

  // Reverse direction: Interface ⊆ ZodOutput (catches missing schema fields)
  Expect<Mutable<Ecosystem> extends z.infer<typeof ecosystemSchema> ? true : false>,
  Expect<Mutable<AnalysisState> extends z.infer<typeof analysisStateSchema> ? true : false>,
  Expect<Mutable<DependencyScope> extends z.infer<typeof dependencyScopeSchema> ? true : false>,
  Expect<Mutable<CrossEdgeType> extends z.infer<typeof crossEdgeTypeSchema> ? true : false>,
  Expect<Mutable<RegistryMeta> extends z.infer<typeof registryMetaSchema> ? true : false>,
  Expect<Mutable<CrossEdgeEndpoint> extends z.infer<typeof crossEdgeEndpointSchema> ? true : false>,
  Expect<Mutable<CrossEdge> extends z.infer<typeof crossEdgeSchema> ? true : false>,
  Expect<Mutable<Dependency> extends z.infer<typeof dependencySchema> ? true : false>,
  Expect<Mutable<Module> extends z.infer<typeof moduleSchema> ? true : false>,
  Expect<Mutable<ProjectConfig> extends z.infer<typeof projectConfigSchema> ? true : false>,
  Expect<Mutable<Project> extends z.infer<typeof projectSchema> ? true : false>,
  Expect<Mutable<HookEntry> extends z.infer<typeof hookEntrySchema> ? true : false>,
  Expect<Mutable<HooksConfig> extends z.infer<typeof hooksConfigSchema> ? true : false>,
  Expect<Mutable<WorkspaceConfig> extends z.infer<typeof workspaceConfigSchema> ? true : false>,
  Expect<Mutable<CrossRootVersion> extends z.infer<typeof crossRootVersionSchema> ? true : false>,
  Expect<Mutable<CrossRootDependency> extends z.infer<typeof crossRootDependencySchema> ? true : false>,
  Expect<Mutable<Workspace> extends z.infer<typeof workspaceSchema> ? true : false>,
  Expect<Mutable<DemoRepository> extends z.infer<typeof demoRepositorySchema> ? true : false>,
];
