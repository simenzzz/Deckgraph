/**
 * Hosted demo repository import helpers.
 *
 * Demo mode only accepts server-configured repository IDs. The browser never
 * sends an arbitrary clone URL, which keeps the public demo small and safer.
 */

import { mkdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execa } from 'execa';
import { z } from 'zod';
import { demoRepositorySchema, type DemoRepository } from '@deckgraph/shared';

export interface ImportDemoRepositoryOptions {
  readonly repoId: string;
  readonly repositories: readonly DemoRepository[];
  readonly cacheDir: string;
}

export interface ImportedDemoRepository {
  readonly repository: DemoRepository;
  readonly path: string;
}

export class DemoRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoRepositoryError';
  }
}

const cloneLocks = new Map<string, Promise<ImportedDemoRepository>>();
const demoRepositoryListSchema = z.array(demoRepositorySchema).max(20);

export function parseDemoRepositories(raw: string | undefined): readonly DemoRepository[] {
  if (!raw) return defaultDemoRepositories();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DemoRepositoryError('DECKGRAPH_DEMO_REPOS must be valid JSON');
  }

  return parseDemoRepositoryList(parsed);
}

export function defaultDemoRepositories(): readonly DemoRepository[] {
  return [
    {
      id: 'deckgraph-fixture',
      label: 'Deckgraph Polyglot Fixture',
      url: 'https://github.com/simenzzz/Deckgraph.git',
      description: 'A compact npm, PyPI, Go, Cargo, and Maven fixture bundled with Deckgraph.',
    },
  ];
}

export async function importDemoRepository(
  options: ImportDemoRepositoryOptions,
): Promise<ImportedDemoRepository> {
  const repository = options.repositories.find((repo) => repo.id === options.repoId);
  if (!repository) {
    throw new DemoRepositoryError('That demo repository is not available');
  }

  assertGithubUrl(repository.url);

  const cacheRoot = resolve(options.cacheDir);
  const targetPath = resolve(join(cacheRoot, repository.id));

  if (!targetPath.startsWith(cacheRoot)) {
    throw new DemoRepositoryError('Invalid demo repository cache path');
  }

  const existingLock = cloneLocks.get(repository.id);
  if (existingLock) return existingLock;

  const clonePromise = cloneRepository(repository, cacheRoot, targetPath).finally(() => {
    cloneLocks.delete(repository.id);
  });
  cloneLocks.set(repository.id, clonePromise);
  return clonePromise;
}

async function cloneRepository(
  repository: DemoRepository,
  cacheRoot: string,
  targetPath: string,
): Promise<ImportedDemoRepository> {
  await mkdir(cacheRoot, { recursive: true });

  if (await isDirectory(targetPath)) {
    return { repository, path: targetPath };
  }

  await rm(targetPath, { recursive: true, force: true });

  const result = await execa('git', [
    'clone',
    '--depth',
    '1',
    '--',
    repository.url,
    targetPath,
  ], {
    reject: false,
    timeout: 120_000,
  });

  if (result.exitCode !== 0) {
    await rm(targetPath, { recursive: true, force: true });
    const detail = result.stderr || result.stdout || 'git clone failed';
    throw new DemoRepositoryError(`Could not import demo repository: ${detail}`);
  }

  return { repository, path: targetPath };
}

function normalizeDemoRepository(value: unknown): DemoRepository {
  if (!value || typeof value !== 'object') {
    throw new DemoRepositoryError('Each demo repository must be an object');
  }

  const record = value as Record<string, unknown>;
  const repo: DemoRepository = {
    id: readString(record, 'id'),
    label: readString(record, 'label'),
    url: readString(record, 'url'),
    description: readString(record, 'description'),
  };

  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(repo.id)) {
    throw new DemoRepositoryError(`Invalid demo repository id: ${repo.id}`);
  }
  assertGithubUrl(repo.url);
  return repo;
}

function parseDemoRepositoryList(value: unknown): readonly DemoRepository[] {
  let repos: readonly DemoRepository[];
  try {
    repos = demoRepositoryListSchema.parse(value);
  } catch {
    throw new DemoRepositoryError('DECKGRAPH_DEMO_REPOS does not match the demo repository schema');
  }

  return repos.map((repo) => normalizeDemoRepository(repo));
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DemoRepositoryError(`Demo repository field "${key}" is required`);
  }
  return value.trim();
}

function assertGithubUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DemoRepositoryError(`Invalid GitHub repository URL: ${value}`);
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new DemoRepositoryError('Demo repositories must use https://github.com URLs');
  }

  const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new DemoRepositoryError('Demo repositories must point at a GitHub owner/repo URL');
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
