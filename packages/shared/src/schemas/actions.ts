/**
 * Zod schemas for package management action types.
 *
 * Canonical types live in '../types/actions.ts'. Schema files only
 * export schemas and parse functions — never type aliases.
 */

import { z } from 'zod';

import { dependencyScopeSchema, ecosystemSchema } from './project.js';

import type {
  PackageAction,
  PackageActionStatus,
  PackageActionResult,
  PackageBatchOperation,
} from '../types/actions.js';
import type { Expect, Mutable } from '../types/typeUtils.js';

// Enums

export const packageActionSchema = z.enum(['update', 'install', 'remove']);

export const packageActionStatusSchema = z.enum(['success', 'failure', 'rolled-back']);

// Composite Schemas

export const packageActionResultSchema = z.object({
  action: packageActionSchema,
  ecosystem: ecosystemSchema,
  packageName: z.string().min(1).max(512),
  modulePath: z.string().min(1).max(1024),
  status: packageActionStatusSchema,
  previousVersion: z.string().max(128).nullable(),
  newVersion: z.string().max(128).nullable(),
  error: z.string().max(4096).nullable(),
  command: z.string().min(1).max(2048),
});

export const packageBatchOperationSchema = z.object({
  action: packageActionSchema,
  ecosystem: ecosystemSchema,
  packageName: z.string().min(1).max(512),
  modulePath: z.string().min(1).max(1024),
  targetVersion: z.string().max(128).nullable(),
  scope: dependencyScopeSchema.nullable(),
});

// Parse Functions

export const parsePackageAction = (value: unknown) => packageActionSchema.parse(value);
export const parsePackageActionStatus = (value: unknown) => packageActionStatusSchema.parse(value);
export const parsePackageActionResult = (value: unknown) => packageActionResultSchema.parse(value);
export const parsePackageBatchOperation = (value: unknown) =>
  packageBatchOperationSchema.parse(value);

// Compile-time Assertions: bidirectional schema ↔ interface compatibility

export type _ActionSchemaAssertions = [
  // Forward: ZodOutput ⊆ Interface
  Expect<z.infer<typeof packageActionSchema> extends PackageAction ? true : false>,
  Expect<z.infer<typeof packageActionStatusSchema> extends PackageActionStatus ? true : false>,
  Expect<z.infer<typeof packageActionResultSchema> extends PackageActionResult ? true : false>,
  Expect<z.infer<typeof packageBatchOperationSchema> extends PackageBatchOperation ? true : false>,

  // Reverse: Interface ⊆ ZodOutput
  Expect<PackageAction extends z.infer<typeof packageActionSchema> ? true : false>,
  Expect<PackageActionStatus extends z.infer<typeof packageActionStatusSchema> ? true : false>,
  Expect<
    Mutable<PackageActionResult> extends z.infer<typeof packageActionResultSchema> ? true : false
  >,
  Expect<
    Mutable<PackageBatchOperation> extends z.infer<typeof packageBatchOperationSchema>
      ? true
      : false
  >,
];
