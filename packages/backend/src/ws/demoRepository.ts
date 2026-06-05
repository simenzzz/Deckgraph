/**
 * Hosted demo repository import helpers.
 *
 * Demo mode accepts server-configured repository IDs and user-submitted public
 * GitHub URLs. User URLs are normalized and cloned over HTTPS without auth.
 */

import { lstat, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
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

export interface NormalizedPublicGithubRepositoryUrl {
  readonly owner: string;
  readonly repo: string;
  readonly cloneUrl: string;
  readonly label: string;
}

export interface ImportPublicGithubRepositoryOptions {
  readonly url: string;
  readonly cacheDir: string;
  readonly existingRepositories: readonly DemoRepository[];
}

/**
 * How an import failed, so the WS layer can pick a precise user-facing message.
 * - `validation`   — the submitted URL is malformed or a duplicate
 * - `not_found`    — GitHub returned 404 (repo is missing or private)
 * - `private`      — repo exists but is private (only detectable with a token)
 * - `rate_limited` — GitHub rate limit exhausted
 * - `clone_failed` — the clone itself failed (network, timeout, git error)
 * - `unavailable`  — generic / unclassified
 */
export type DemoRepositoryErrorKind =
  | 'validation'
  | 'not_found'
  | 'private'
  | 'rate_limited'
  | 'clone_failed'
  | 'unavailable';

export class DemoRepositoryError extends Error {
  readonly kind: DemoRepositoryErrorKind;

  constructor(message: string, kind: DemoRepositoryErrorKind = 'unavailable') {
    super(message);
    this.name = 'DemoRepositoryError';
    this.kind = kind;
  }
}

const cloneLocks = new Map<string, Promise<ImportedDemoRepository>>();
const demoRepositoryListSchema = z.array(demoRepositorySchema).max(20);
const MAX_DESCRIPTION_LENGTH = 512;
const MAX_CLONE_ATTEMPTS = 3;
const CLONE_RETRY_DELAY_MS = 1_000;
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_TIMEOUT_MS = 8_000;
/** Allowed characters for a GitHub owner or repository name segment. */
const GITHUB_SEGMENT = /^[A-Za-z0-9_.-]+$/;

/** Minimal shape of the GitHub "get a repository" response we rely on. */
const githubRepositorySchema = z.object({ private: z.boolean() });

/**
 * Result of probing a repository's accessibility on GitHub.
 * `unreachable` is best-effort: the caller should fall back to cloning rather
 * than block a valid import on a transient API hiccup.
 */
export type GithubRepositoryAccess =
  | 'public'
  | 'private'
  | 'not_found'
  | 'rate_limited'
  | 'unreachable';
const RETRYABLE_CLONE_FAILURES = [
  /early EOF/i,
  /RPC failed/i,
  /remote end hung up unexpectedly/i,
  /connection (?:reset|closed|timed out)/i,
  /unexpected disconnect/i,
];

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

  return importRepositoryByDefinition({
    repository,
    cacheDir: options.cacheDir,
  });
}

/**
 * Best-effort probe of a repository's accessibility via the GitHub REST API.
 *
 * An unauthenticated request returns 404 for both missing and private repos
 * (GitHub hides private repos' existence), so `not_found` covers both cases.
 * When a token is configured we can additionally surface a true `private`.
 * Any network/timeout/unexpected condition resolves to `unreachable` so the
 * caller can fall back to cloning instead of blocking a valid import.
 */
export async function checkGithubRepositoryAccess(
  owner: string,
  repo: string,
): Promise<GithubRepositoryAccess> {
  // Defense in depth: the production caller pre-validates owner/repo, but this
  // is an exported function — guard and encode so a future caller can never
  // inject path/query segments into the api.github.com URL.
  if (!GITHUB_SEGMENT.test(owner) || !GITHUB_SEGMENT.test(repo)) return 'unreachable';

  const token = process.env.GITHUB_TOKEN ?? process.env.DECKGRAPH_GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'deckgraph',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT_MS);

  let response: Response;
  try {
    const target = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    // `redirect: 'manual'` keeps the Authorization header from following a
    // redirect to another origin; the endpoint should never legitimately 3xx.
    response = await fetch(target, { headers, signal: controller.signal, redirect: 'manual' });
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) return 'not_found';

  if (response.status === 403 || response.status === 429) {
    return response.headers.get('x-ratelimit-remaining') === '0'
      ? 'rate_limited'
      : 'unreachable';
  }

  if (response.status === 200) {
    try {
      const body = githubRepositorySchema.parse(await response.json());
      return body.private ? 'private' : 'public';
    } catch {
      // 200 but an unreadable/unexpected body: stay best-effort and let the
      // clone be authoritative rather than guessing public/private.
      return 'unreachable';
    }
  }

  return 'unreachable';
}

export async function importPublicGithubRepository(
  options: ImportPublicGithubRepositoryOptions,
): Promise<ImportedDemoRepository> {
  const normalized = normalizePublicGithubRepositoryUrl(options.url);
  const id = createCustomRepositoryId(
    normalized.owner,
    normalized.repo,
    normalized.cloneUrl,
    options.existingRepositories,
  );
  const repository: DemoRepository = {
    id,
    label: normalized.label,
    url: normalized.cloneUrl,
    description: `Public GitHub repository imported from ${normalized.label}.`,
  };

  if (options.existingRepositories.some((repo) => repo.id === repository.id || repo.url === repository.url)) {
    throw new DemoRepositoryError('That public repository has already been added', 'validation');
  }

  const access = await checkGithubRepositoryAccess(normalized.owner, normalized.repo);
  if (access === 'not_found') {
    throw new DemoRepositoryError('Repository not found or is private', 'not_found');
  }
  if (access === 'private') {
    throw new DemoRepositoryError('That repository is private', 'private');
  }
  if (access === 'rate_limited') {
    throw new DemoRepositoryError('GitHub rate limit reached', 'rate_limited');
  }

  const imported = await importRepositoryByDefinition({
    repository,
    cacheDir: options.cacheDir,
  });
  const description = await readRepositoryDescription(imported.path, normalized.label);

  return {
    repository: {
      ...repository,
      description,
    },
    path: imported.path,
  };
}

export function normalizePublicGithubRepositoryUrl(
  value: string,
): NormalizedPublicGithubRepositoryUrl {
  const raw = value.trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DemoRepositoryError('Enter a valid GitHub repository URL', 'validation');
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new DemoRepositoryError('Public repositories must use https://github.com URLs', 'validation');
  }

  if (url.username || url.password) {
    throw new DemoRepositoryError('GitHub repository URLs must not include credentials', 'validation');
  }

  if (url.search || url.hash) {
    throw new DemoRepositoryError('GitHub repository URLs must point directly at owner/repo', 'validation');
  }

  const parts = url.pathname.replace(/\/+$/, '').replace(/\.git$/, '').split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new DemoRepositoryError('GitHub repository URLs must point directly at owner/repo', 'validation');
  }

  const [owner, repo] = parts;
  if (!owner || !repo || !GITHUB_SEGMENT.test(owner) || !GITHUB_SEGMENT.test(repo)) {
    throw new DemoRepositoryError('GitHub repository owner and name contain unsupported characters', 'validation');
  }

  return {
    owner,
    repo,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    label: `${owner}/${repo}`,
  };
}

async function importRepositoryByDefinition(options: {
  readonly repository: DemoRepository;
  readonly cacheDir: string;
}): Promise<ImportedDemoRepository> {
  assertGithubUrl(options.repository.url);

  const cacheRoot = resolve(options.cacheDir);
  const targetPath = resolve(join(cacheRoot, options.repository.id));

  if (!targetPath.startsWith(cacheRoot)) {
    throw new DemoRepositoryError('Invalid demo repository cache path');
  }

  const existingLock = cloneLocks.get(options.repository.id);
  if (existingLock) return existingLock;

  const clonePromise = cloneRepository(options.repository, cacheRoot, targetPath).finally(() => {
    cloneLocks.delete(options.repository.id);
  });
  cloneLocks.set(options.repository.id, clonePromise);
  return clonePromise;
}

async function cloneRepository(
  repository: DemoRepository,
  cacheRoot: string,
  targetPath: string,
): Promise<ImportedDemoRepository> {
  await mkdir(cacheRoot, { recursive: true });

  if (await isDirectory(targetPath)) {
    const refreshed = await refreshCachedRepository(repository, targetPath);
    if (refreshed) {
      return { repository, path: targetPath };
    }
    await rm(targetPath, { recursive: true, force: true });
  }

  let lastError = 'git clone failed';

  for (let attempt = 1; attempt <= MAX_CLONE_ATTEMPTS; attempt++) {
    await rm(targetPath, { recursive: true, force: true });

    const result = await execa('git', [
      'clone',
      '--config',
      'core.symlinks=false',
      '--depth',
      '1',
      '--single-branch',
      '--no-tags',
      '--',
      repository.url,
      targetPath,
    ], {
      env: { GIT_TERMINAL_PROMPT: '0' },
      reject: false,
      timeout: 120_000,
    });

    if (result.exitCode === 0) {
      return { repository, path: targetPath };
    }

    lastError = result.stderr || result.stdout || (result.timedOut ? 'git clone timed out' : 'git clone failed');
    if (attempt < MAX_CLONE_ATTEMPTS && (result.timedOut || isRetryableCloneFailure(lastError))) {
      await delay(CLONE_RETRY_DELAY_MS * attempt);
      continue;
    }

    break;
  }

  await rm(targetPath, { recursive: true, force: true });
  throw new DemoRepositoryError(`Could not import demo repository: ${lastError}`, 'clone_failed');
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

  if (repos.length === 0) {
    throw new DemoRepositoryError('DECKGRAPH_DEMO_REPOS must include at least one repository');
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

function createCustomRepositoryId(
  owner: string,
  repo: string,
  cloneUrl: string,
  existingRepositories: readonly DemoRepository[],
): string {
  const baseSlug = `custom-${owner}-${repo}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const slug = baseSlug || 'custom-repository';

  const hasCollision = existingRepositories.some(
    (existing) => existing.id === slug && existing.url !== cloneUrl,
  );
  if (slug.length <= 64 && !hasCollision) return slug;

  const hash = createHash('sha256').update(cloneUrl).digest('hex').slice(0, 8);
  const prefix = slug.slice(0, 55).replace(/-$/g, '');
  return `${prefix}-${hash}`;
}

async function readRepositoryDescription(path: string, label: string): Promise<string> {
  const readmePath = await findReadmePath(path);
  if (!readmePath) {
    return `Public GitHub repository imported from ${label}.`;
  }

  try {
    const raw = await readFile(readmePath, 'utf-8');
    const snippet = normalizeReadmeSnippet(raw);
    return snippet || `Public GitHub repository imported from ${label}.`;
  } catch {
    return `Public GitHub repository imported from ${label}.`;
  }
}

async function findReadmePath(path: string): Promise<string | null> {
  try {
    const entries = await readdir(path);
    const readme = entries.find((entry) => /^readme(?:\.[a-z0-9_-]+)?$/i.test(entry));
    if (!readme) return null;

    const readmePath = join(path, readme);
    const linkStat = await lstat(readmePath);
    if (linkStat.isSymbolicLink()) return null;

    return readmePath;
  } catch {
    return null;
  }
}

function normalizeReadmeSnippet(raw: string): string {
  const cleaned = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/[*_~|]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= MAX_DESCRIPTION_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_DESCRIPTION_LENGTH - 3).trim()}...`;
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

function isRetryableCloneFailure(detail: string): boolean {
  return RETRYABLE_CLONE_FAILURES.some((pattern) => pattern.test(detail));
}

async function refreshCachedRepository(
  repository: DemoRepository,
  targetPath: string,
): Promise<boolean> {
  const isGitRepo = await gitOk(targetPath, ['rev-parse', '--is-inside-work-tree']);
  if (!isGitRepo) return false;

  const origin = await execa('git', ['-C', targetPath, 'remote', 'get-url', 'origin'], {
    reject: false,
    timeout: 10_000,
  });
  if (origin.exitCode !== 0 || origin.stdout.trim() !== repository.url) {
    return false;
  }

  const fetch = await execa('git', ['-C', targetPath, 'fetch', '--depth', '1', '--no-tags', 'origin', 'HEAD'], {
    reject: false,
    timeout: 120_000,
  });
  if (fetch.exitCode !== 0 || fetch.timedOut) return false;

  const reset = await execa('git', ['-C', targetPath, 'reset', '--hard', 'FETCH_HEAD'], {
    reject: false,
    timeout: 30_000,
  });
  if (reset.exitCode !== 0 || reset.timedOut) return false;

  const clean = await execa('git', ['-C', targetPath, 'clean', '-fdx'], {
    reject: false,
    timeout: 30_000,
  });
  return clean.exitCode === 0 && !clean.timedOut;
}

async function gitOk(cwd: string, args: readonly string[]): Promise<boolean> {
  const result = await execa('git', ['-C', cwd, ...args], {
    reject: false,
    timeout: 10_000,
  });
  return result.exitCode === 0 && !result.timedOut;
}
