/**
 * Proto/gRPC cross-language edge detector.
 *
 * Finds .proto files, extracts package and service declarations,
 * then matches modules that likely consume the proto definitions
 * based on gRPC dependencies and naming heuristics.
 */

import { join } from 'node:path';
import type { CrossEdge, Module } from '@deckgraph/shared';
import { readFileSafe } from '../adapters/utils.js';
import { findFiles, findOwningModule } from './fileScanner.js';
import type { EdgeDetector } from './types.js';
import { createLogger } from '../logger.js';

const logger = createLogger('protoDetector');

/** Regex to extract proto package declaration */
const PACKAGE_RE = /^\s*package\s+([\w.]+)\s*;/m;

/** Regex to extract proto service declarations */
const SERVICE_RE = /^\s*service\s+(\w+)\s*\{/gm;

/** Minimum proto package segment length to avoid single-letter false matches */
const MIN_SEGMENT_LENGTH = 3;

interface ProtoInfo {
  readonly filePath: string;
  readonly packageName: string | null;
  readonly services: readonly string[];
}

export function createProtoDetector(): EdgeDetector {
  return {
    name: 'proto',

    async detect(
      projectRoot: string,
      modules: readonly Module[],
    ): Promise<readonly CrossEdge[]> {
      const protoFiles = await findFiles(projectRoot, ['**/*.proto']);
      if (protoFiles.length === 0) return [];

      logger.debug({ count: protoFiles.length }, 'Found .proto files');

      const protoInfos = await Promise.all(
        protoFiles.map((f) => parseProtoFile(projectRoot, f)),
      );
      const validInfos = protoInfos.filter(
        (info): info is ProtoInfo => info !== null,
      );

      if (validInfos.length === 0) return [];

      return detectEdges(validInfos, modules);
    },
  };
}

async function parseProtoFile(
  projectRoot: string,
  filePath: string,
): Promise<ProtoInfo | null> {
  const content = await readFileSafe(join(projectRoot, filePath));
  if (!content) return null;

  const packageMatch = content.match(PACKAGE_RE);
  const packageName = packageMatch ? packageMatch[1]! : null;

  const services: string[] = [];
  let match: RegExpExecArray | null;
  const serviceRe = new RegExp(SERVICE_RE.source, SERVICE_RE.flags);
  while ((match = serviceRe.exec(content)) !== null) {
    services.push(match[1]!);
  }

  return { filePath, packageName, services };
}

function detectEdges(
  protos: readonly ProtoInfo[],
  modules: readonly Module[],
): readonly CrossEdge[] {
  const edges: CrossEdge[] = [];

  for (const proto of protos) {
    const sourceModule = findOwningModule(proto.filePath, modules);
    if (!sourceModule) continue;

    for (const targetModule of modules) {
      if (targetModule.path === sourceModule.path) continue;
      if (targetModule.ecosystem === sourceModule.ecosystem) continue;

      if (!isLikelyProtoConsumer(proto, targetModule)) continue;

      const hasService = proto.services.length > 0;
      const confidence = hasService ? 0.9 : 0.7;
      const evidence = hasService
        ? `Proto services [${proto.services.join(', ')}] from ${proto.filePath} consumed by ${targetModule.path}`
        : `Proto package ${proto.packageName ?? 'unknown'} from ${proto.filePath} consumed by ${targetModule.path}`;

      edges.push({
        from: { module: sourceModule.path, ecosystem: sourceModule.ecosystem },
        to: { module: targetModule.path, ecosystem: targetModule.ecosystem },
        type: 'proto',
        evidence,
        confidence,
      });
    }
  }

  return edges;
}

/**
 * Check if a target module likely consumes a proto definition.
 *
 * Requires the target to have gRPC/protobuf dependencies AND
 * either a proto package namespace match or a proto filename match.
 */
function isLikelyProtoConsumer(
  proto: ProtoInfo,
  targetModule: Module,
): boolean {
  const grpcDeps = targetModule.dependencies.filter(
    (d) =>
      d.concerns.includes('grpc') ||
      d.name.includes('grpc') ||
      d.name.includes('protobuf') ||
      d.name.includes('proto'),
  );

  if (grpcDeps.length === 0) return false;

  const targetPath = targetModule.path === '.' ? '' : targetModule.path;

  // Check if proto package namespace matches a target path component
  if (proto.packageName) {
    const parts = proto.packageName
      .split('.')
      .filter((p) => p.length >= MIN_SEGMENT_LENGTH);
    const hasMatchingPath = parts.some((part) =>
      targetPath.toLowerCase().includes(part.toLowerCase()),
    );
    if (hasMatchingPath) return true;
  }

  // Check if proto filename stem matches the target path
  const protoStem = proto.filePath
    .split('/')
    .pop()!
    .replace('.proto', '');

  if (protoStem.length >= MIN_SEGMENT_LENGTH &&
      targetPath.toLowerCase().includes(protoStem.toLowerCase())) {
    return true;
  }

  return false;
}
