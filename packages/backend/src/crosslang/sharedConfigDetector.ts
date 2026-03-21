/**
 * Shared config cross-language edge detector.
 *
 * Finds .env/.env.shared files across modules and detects
 * shared environment variable names (threshold: 3+ shared vars).
 */

import type { CrossEdge, Module } from '@deckgraph/shared';
import { readFileSafe } from '../adapters/utils.js';
import { findFiles, findOwningModule } from './fileScanner.js';
import type { EdgeDetector } from './types.js';
import { createLogger } from '../logger.js';
import { join } from 'node:path';

const logger = createLogger('sharedConfigDetector');

const ENV_FILE_PATTERNS = [
  '**/.env',
  '**/.env.shared',
  '**/.env.example',
  '**/.env.sample',
];

/** Minimum number of shared env vars to create an edge */
const SHARED_VAR_THRESHOLD = 3;

/** Regex to extract env var names (KEY=value lines) */
const ENV_VAR_RE = /^([A-Z][A-Z0-9_]+)\s*=/gm;

interface ModuleEnvVars {
  readonly module: Module;
  readonly vars: ReadonlySet<string>;
}

export function createSharedConfigDetector(): EdgeDetector {
  return {
    name: 'shared-config',

    async detect(
      projectRoot: string,
      modules: readonly Module[],
    ): Promise<readonly CrossEdge[]> {
      const envFiles = await findFiles(projectRoot, ENV_FILE_PATTERNS);
      if (envFiles.length === 0) return [];

      logger.debug({ count: envFiles.length }, 'Found env files');

      const moduleEnvVars = await collectEnvVars(projectRoot, envFiles, modules);
      if (moduleEnvVars.length < 2) return [];

      return findSharedVarEdges(moduleEnvVars);
    },
  };
}

async function collectEnvVars(
  projectRoot: string,
  envFiles: readonly string[],
  modules: readonly Module[],
): Promise<readonly ModuleEnvVars[]> {
  // Note: Uses local Set mutation during construction (builder pattern).
  // Sets are not shared until the completed results are returned as readonly.
  const moduleVarsMap = new Map<string, Set<string>>();

  for (const file of envFiles) {
    const content = await readFileSafe(join(projectRoot, file));
    if (!content) continue;

    const owningModule = findOwningModule(file, modules);
    if (!owningModule) continue;

    const vars = extractEnvVars(content);
    const existing = moduleVarsMap.get(owningModule.path);
    if (existing) {
      for (const v of vars) existing.add(v);
    } else {
      moduleVarsMap.set(owningModule.path, new Set(vars));
    }
  }

  const result: ModuleEnvVars[] = [];
  for (const [modulePath, vars] of moduleVarsMap) {
    const mod = modules.find((m) => m.path === modulePath);
    if (mod && vars.size > 0) {
      result.push({ module: mod, vars });
    }
  }

  return result;
}

function extractEnvVars(content: string): readonly string[] {
  const vars: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(ENV_VAR_RE.source, ENV_VAR_RE.flags);

  while ((match = re.exec(content)) !== null) {
    vars.push(match[1]!);
  }

  return vars;
}

function findSharedVarEdges(
  moduleEnvVars: readonly ModuleEnvVars[],
): readonly CrossEdge[] {
  const edges: CrossEdge[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < moduleEnvVars.length; i++) {
    for (let j = i + 1; j < moduleEnvVars.length; j++) {
      const a = moduleEnvVars[i]!;
      const b = moduleEnvVars[j]!;

      // Only create edges between different ecosystems
      if (a.module.ecosystem === b.module.ecosystem) continue;

      const shared = intersection(a.vars, b.vars);
      if (shared.length < SHARED_VAR_THRESHOLD) continue;

      const edgeKey = [a.module.path, b.module.path].sort().join('|');
      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);

      edges.push({
        from: { module: a.module.path, ecosystem: a.module.ecosystem },
        to: { module: b.module.path, ecosystem: b.module.ecosystem },
        type: 'shared-config',
        evidence: `${shared.length} shared env vars: ${shared.slice(0, 5).join(', ')}${shared.length > 5 ? '...' : ''}`,
        confidence: 0.3,
      });
    }
  }

  return edges;
}

function intersection(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): readonly string[] {
  const result: string[] = [];
  for (const item of a) {
    if (b.has(item)) result.push(item);
  }
  return result;
}

