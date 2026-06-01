/**
 * Zod schemas for adapter types.
 *
 * Validates data returned by ecosystem adapters during manifest parsing,
 * import analysis, and registry queries.
 *
 * Canonical types live in '../types/adapters.ts'. Schema files only
 * export schemas and parse functions — never type aliases.
 */

import { z } from 'zod';
import {
  dependencyScopeSchema,
  registryMetaSchema as projectRegistryMetaSchema,
} from './project.js';

import type { ParsedImport, ManifestResult, MinimalDependency } from '../types/adapters.js';
import type { Expect, Mutable } from '../types/typeUtils.js';

// Parsed Import

export const parsedImportSchema = z.object({
  source: z.string().min(1).max(512),
  specifiers: z.array(z.string().min(1).max(256)).max(256),
  isThirdParty: z.boolean(),
  line: z.number().int().positive(),
});

// Manifest Result

/**
 * Minimal dependency schema for adapter manifest parsing results.
 * Adapters only provide these 4 fields; the full Dependency type
 * has additional fields populated during later analysis phases.
 */
export const minimalDependencySchema = z.object({
  name: z.string().min(1).max(512),
  version: z.string().min(1).max(256),
  constraint: z.string().max(512),
  scope: dependencyScopeSchema,
});

/** Keys that are stripped from metadata to prevent prototype pollution. */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sanitized metadata schema.
 * Strips dangerous keys (__proto__, constructor, prototype) to prevent
 * prototype pollution when metadata originates from untrusted JSON.
 */
const safeMetadataSchema = z
  .record(z.string().max(256), z.unknown())
  .transform((rec) => {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(rec)) {
      if (!DANGEROUS_KEYS.has(key)) {
        result[key] = rec[key];
      }
    }
    return result;
  });

export const manifestResultSchema = z.object({
  moduleName: z.string().min(1).max(512),
  dependencies: z.array(minimalDependencySchema),
  hasLockFile: z.boolean(),
  metadata: safeMetadataSchema,
});

// Registry Metadata

// Re-export from project.ts - single source of truth
export { projectRegistryMetaSchema as registryMetaSchema };

// Parse Functions

export const parseParsedImport = (value: unknown) => parsedImportSchema.parse(value);
export const parseManifestResult = (value: unknown) => manifestResultSchema.parse(value);
export const parseAdapterRegistryMeta = (value: unknown) => projectRegistryMetaSchema.parse(value);

// Compile-time Assertions: bidirectional schema ↔ interface compatibility

// Exported to satisfy noUnusedLocals.

export type _AdapterSchemaAssertions = [
  // Forward direction: ZodOutput ⊆ Interface
  Expect<z.infer<typeof parsedImportSchema> extends ParsedImport ? true : false>,
  Expect<z.infer<typeof manifestResultSchema> extends ManifestResult ? true : false>,
  Expect<z.infer<typeof minimalDependencySchema> extends MinimalDependency ? true : false>,

  // Reverse direction: Interface ⊆ ZodOutput
  Expect<Mutable<ParsedImport> extends z.infer<typeof parsedImportSchema> ? true : false>,
  Expect<Mutable<ManifestResult> extends z.infer<typeof manifestResultSchema> ? true : false>,
  Expect<Mutable<MinimalDependency> extends z.infer<typeof minimalDependencySchema> ? true : false>,
];
