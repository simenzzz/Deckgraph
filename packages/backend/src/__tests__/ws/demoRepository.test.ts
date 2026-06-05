import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';
import {
  DemoRepositoryError,
  checkGithubRepositoryAccess,
  importDemoRepository,
  importPublicGithubRepository,
  normalizePublicGithubRepositoryUrl,
  parseDemoRepositories,
} from '../../ws/demoRepository.js';

const mockedExeca = vi.mocked(execa);

/** Build a minimal fetch Response stub for the GitHub repo-access probe. */
function githubResponse(
  status: number,
  options: { body?: unknown; remaining?: string } = {},
): Response {
  const headers = new Headers();
  if (options.remaining !== undefined) headers.set('x-ratelimit-remaining', options.remaining);
  return {
    status,
    headers,
    json: async () => options.body ?? {},
  } as unknown as Response;
}

/** Default the probe to "public" so import tests reach the clone path. */
function stubGithubPublic(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(githubResponse(200, { body: { private: false } })),
  );
}

function repo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deckgraph-fixture',
    label: 'Deckgraph Fixture',
    url: 'https://github.com/simenzzz/Deckgraph.git',
    description: 'A public demo repository.',
    ...overrides,
  };
}

let cacheDir = '';

beforeEach(async () => {
  vi.clearAllMocks();
  stubGithubPublic();
  cacheDir = await mkdtemp(join(tmpdir(), 'deckgraph-demo-test-'));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  if (cacheDir) {
    await rm(cacheDir, { recursive: true, force: true });
  }
});

describe('parseDemoRepositories', () => {
  it('validates configured repositories with the shared ready-message limits', () => {
    const repos = Array.from({ length: 21 }, (_, index) =>
      repo({ id: `repo-${index}`, label: `Repo ${index}` }),
    );

    expect(() => parseDemoRepositories(JSON.stringify(repos))).toThrow(DemoRepositoryError);
  });

  it('rejects an explicitly empty repository list', () => {
    expect(() => parseDemoRepositories('[]')).toThrow(DemoRepositoryError);
  });

  it('rejects repository fields that exceed shared schema limits', () => {
    expect(() =>
      parseDemoRepositories(JSON.stringify([repo({ label: 'a'.repeat(129) })])),
    ).toThrow(DemoRepositoryError);
  });

  it('keeps demo repositories restricted to GitHub clone URLs', () => {
    expect(() =>
      parseDemoRepositories(JSON.stringify([repo({ url: 'https://gitlab.com/acme/demo.git' })])),
    ).toThrow(DemoRepositoryError);
  });

  it('returns normalized configured repositories', () => {
    expect(parseDemoRepositories(JSON.stringify([repo({ label: ' Deckgraph Fixture ' })]))).toEqual([
      repo(),
    ]);
  });
});

describe('normalizePublicGithubRepositoryUrl', () => {
  it('normalizes public GitHub owner/repo URLs to HTTPS clone URLs', () => {
    expect(normalizePublicGithubRepositoryUrl('https://github.com/example/project')).toEqual({
      owner: 'example',
      repo: 'project',
      cloneUrl: 'https://github.com/example/project.git',
      label: 'example/project',
    });
    expect(normalizePublicGithubRepositoryUrl('https://github.com/example/project.git')).toEqual({
      owner: 'example',
      repo: 'project',
      cloneUrl: 'https://github.com/example/project.git',
      label: 'example/project',
    });
  });

  it('rejects non-public-GitHub URL shapes', () => {
    expect(() => normalizePublicGithubRepositoryUrl('git@github.com:example/project.git')).toThrow(DemoRepositoryError);
    expect(() => normalizePublicGithubRepositoryUrl('https://github.com/user:token@example/project')).toThrow(DemoRepositoryError);
    expect(() => normalizePublicGithubRepositoryUrl('https://gitlab.com/example/project')).toThrow(DemoRepositoryError);
    expect(() => normalizePublicGithubRepositoryUrl('https://github.com/example/project/tree/main')).toThrow(DemoRepositoryError);
  });
});

describe('importDemoRepository', () => {
  it('retries a transient early EOF once and then succeeds', async () => {
    mockedExeca
      .mockResolvedValueOnce({
        exitCode: 128,
        stderr: 'Cloning into \'/tmp/deckgraph-demo-cache/lucubrum\'...\nfatal: early EOF',
        stdout: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: '',
        stdout: '',
      } as never);

    const result = await importDemoRepository({
      repoId: 'lucubrum',
      repositories: [repo({ id: 'lucubrum', url: 'https://github.com/simenzzz/lucubrum.git' })],
      cacheDir,
    });

    expect(result.repository.id).toBe('lucubrum');
    expect(mockedExeca).toHaveBeenCalledTimes(2);
  });

  it('fails after exhausting retries for transient clone errors', async () => {
    mockedExeca.mockResolvedValue({
      exitCode: 128,
      stderr: 'fatal: early EOF',
      stdout: '',
    } as never);

    await expect(
      importDemoRepository({
        repoId: 'lucubrum',
        repositories: [repo({ id: 'lucubrum', url: 'https://github.com/simenzzz/lucubrum.git' })],
        cacheDir,
      }),
    ).rejects.toThrow(DemoRepositoryError);

    expect(mockedExeca).toHaveBeenCalledTimes(3);
  });

  it('retries clone timeouts', async () => {
    mockedExeca
      .mockResolvedValueOnce({
        exitCode: undefined,
        timedOut: true,
        stderr: '',
        stdout: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 0,
        timedOut: false,
        stderr: '',
        stdout: '',
      } as never);

    await importDemoRepository({
      repoId: 'lucubrum',
      repositories: [repo({ id: 'lucubrum', url: 'https://github.com/simenzzz/lucubrum.git' })],
      cacheDir,
    });

    expect(mockedExeca).toHaveBeenCalledTimes(2);
  });

  it('refreshes a valid cached repository', async () => {
    await mkdir(join(cacheDir, 'lucubrum'), { recursive: true });
    mockedExeca
      .mockResolvedValueOnce({ exitCode: 0, timedOut: false, stdout: 'true', stderr: '' } as never)
      .mockResolvedValueOnce({ exitCode: 0, timedOut: false, stdout: 'https://github.com/simenzzz/lucubrum.git\n', stderr: '' } as never)
      .mockResolvedValueOnce({ exitCode: 0, timedOut: false, stdout: '', stderr: '' } as never)
      .mockResolvedValueOnce({ exitCode: 0, timedOut: false, stdout: '', stderr: '' } as never)
      .mockResolvedValueOnce({ exitCode: 0, timedOut: false, stdout: '', stderr: '' } as never);

    const result = await importDemoRepository({
      repoId: 'lucubrum',
      repositories: [repo({ id: 'lucubrum', url: 'https://github.com/simenzzz/lucubrum.git' })],
      cacheDir,
    });

    expect(result.path).toBe(join(cacheDir, 'lucubrum'));
    expect(mockedExeca).toHaveBeenCalledWith('git', ['-C', join(cacheDir, 'lucubrum'), 'fetch', '--depth', '1', '--no-tags', 'origin', 'HEAD'], expect.any(Object));
  });

  it('reclones a cached repository with a mismatched origin', async () => {
    await mkdir(join(cacheDir, 'lucubrum'), { recursive: true });
    mockedExeca
      .mockResolvedValueOnce({ exitCode: 0, timedOut: false, stdout: 'true', stderr: '' } as never)
      .mockResolvedValueOnce({ exitCode: 0, timedOut: false, stdout: 'https://github.com/other/repo.git\n', stderr: '' } as never)
      .mockResolvedValueOnce({ exitCode: 0, timedOut: false, stdout: '', stderr: '' } as never);

    await importDemoRepository({
      repoId: 'lucubrum',
      repositories: [repo({ id: 'lucubrum', url: 'https://github.com/simenzzz/lucubrum.git' })],
      cacheDir,
    });

    expect(mockedExeca).toHaveBeenLastCalledWith(
      'git',
      ['clone', '--config', 'core.symlinks=false', '--depth', '1', '--single-branch', '--no-tags', '--', 'https://github.com/simenzzz/lucubrum.git', join(cacheDir, 'lucubrum')],
      expect.any(Object),
    );
  });
});

describe('importPublicGithubRepository', () => {
  it('clones, reads a README snippet, and returns a session repository', async () => {
    mockedExeca.mockImplementation(async (_cmd, args) => {
      const targetPath = Array.isArray(args) ? args.at(-1) : undefined;
      if (typeof targetPath === 'string') {
        await mkdir(targetPath, { recursive: true });
        await writeFile(
          join(targetPath, 'README.md'),
          '# Demo Repo\n\nThis repository demonstrates a public import flow with a README snippet.',
        );
      }
      return { exitCode: 0, timedOut: false, stdout: '', stderr: '' } as never;
    });

    const result = await importPublicGithubRepository({
      url: 'https://github.com/example/demo-repo',
      cacheDir,
      existingRepositories: [],
    });

    expect(result.repository).toEqual({
      id: 'custom-example-demo-repo',
      label: 'example/demo-repo',
      url: 'https://github.com/example/demo-repo.git',
      description: 'Demo Repo This repository demonstrates a public import flow with a README snippet.',
    });
    expect(result.path).toBe(join(cacheDir, 'custom-example-demo-repo'));
    expect(mockedExeca).toHaveBeenCalledWith(
      'git',
      ['clone', '--config', 'core.symlinks=false', '--depth', '1', '--single-branch', '--no-tags', '--', 'https://github.com/example/demo-repo.git', join(cacheDir, 'custom-example-demo-repo')],
      expect.objectContaining({
        env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }),
      }),
    );
  });

  it('does not follow a symlinked README when building the description', async () => {
    const secret = await mkdtemp(join(tmpdir(), 'deckgraph-demo-secret-'));
    const secretFile = join(secret, 'secret.txt');
    await writeFile(secretFile, 'TOP-SECRET-HOST-CONTENTS');

    mockedExeca.mockImplementation(async (_cmd, args) => {
      const targetPath = Array.isArray(args) ? args.at(-1) : undefined;
      if (typeof targetPath === 'string') {
        await mkdir(targetPath, { recursive: true });
        await symlink(secretFile, join(targetPath, 'README.md'));
      }
      return { exitCode: 0, timedOut: false, stdout: '', stderr: '' } as never;
    });

    const result = await importPublicGithubRepository({
      url: 'https://github.com/example/symlink-readme',
      cacheDir,
      existingRepositories: [],
    });

    expect(result.repository.description).toBe(
      'Public GitHub repository imported from example/symlink-readme.',
    );
    expect(result.repository.description).not.toContain('TOP-SECRET-HOST-CONTENTS');

    await rm(secret, { recursive: true, force: true });
  });

  it('uses a fallback README snippet when no README is available', async () => {
    mockedExeca.mockImplementation(async (_cmd, args) => {
      const targetPath = Array.isArray(args) ? args.at(-1) : undefined;
      if (typeof targetPath === 'string') {
        await mkdir(targetPath, { recursive: true });
      }
      return { exitCode: 0, timedOut: false, stdout: '', stderr: '' } as never;
    });

    const result = await importPublicGithubRepository({
      url: 'https://github.com/example/no-readme',
      cacheDir,
      existingRepositories: [],
    });

    expect(result.repository.description).toBe('Public GitHub repository imported from example/no-readme.');
  });

  it('rejects duplicate custom repositories in the same session', async () => {
    await expect(
      importPublicGithubRepository({
        url: 'https://github.com/example/demo-repo',
        cacheDir,
        existingRepositories: [
          repo({
            id: 'custom-example-demo-repo',
            label: 'example/demo-repo',
            url: 'https://github.com/example/demo-repo.git',
          }),
        ],
      }),
    ).rejects.toThrow(DemoRepositoryError);

    expect(mockedExeca).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a not-found/private repository without attempting a clone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(githubResponse(404)));

    await expect(
      importPublicGithubRepository({
        url: 'https://github.com/example/missing',
        cacheDir,
        existingRepositories: [],
      }),
    ).rejects.toMatchObject({ kind: 'not_found' });

    expect(mockedExeca).not.toHaveBeenCalled();
  });

  it('reports a private repository when GitHub confirms it with a token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(githubResponse(200, { body: { private: true } })),
    );

    await expect(
      importPublicGithubRepository({
        url: 'https://github.com/example/secret',
        cacheDir,
        existingRepositories: [],
      }),
    ).rejects.toMatchObject({ kind: 'private' });

    expect(mockedExeca).not.toHaveBeenCalled();
  });

  it('reports a rate-limited probe without attempting a clone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(githubResponse(403, { remaining: '0' })));

    await expect(
      importPublicGithubRepository({
        url: 'https://github.com/example/limited',
        cacheDir,
        existingRepositories: [],
      }),
    ).rejects.toMatchObject({ kind: 'rate_limited' });

    expect(mockedExeca).not.toHaveBeenCalled();
  });

  it('falls back to cloning when the probe is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    mockedExeca.mockImplementation(async (_cmd, args) => {
      const targetPath = Array.isArray(args) ? args.at(-1) : undefined;
      if (typeof targetPath === 'string') await mkdir(targetPath, { recursive: true });
      return { exitCode: 0, timedOut: false, stdout: '', stderr: '' } as never;
    });

    const result = await importPublicGithubRepository({
      url: 'https://github.com/example/reachable-by-clone',
      cacheDir,
      existingRepositories: [],
    });

    expect(result.repository.id).toBe('custom-example-reachable-by-clone');
    expect(mockedExeca).toHaveBeenCalled();
  });
});

describe('checkGithubRepositoryAccess', () => {
  it('classifies HTTP statuses and the private flag', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(githubResponse(200, { body: { private: false } })));
    expect(await checkGithubRepositoryAccess('a', 'b')).toBe('public');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(githubResponse(200, { body: { private: true } })));
    expect(await checkGithubRepositoryAccess('a', 'b')).toBe('private');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(githubResponse(404)));
    expect(await checkGithubRepositoryAccess('a', 'b')).toBe('not_found');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(githubResponse(403, { remaining: '0' })));
    expect(await checkGithubRepositoryAccess('a', 'b')).toBe('rate_limited');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(githubResponse(403, { remaining: '12' })));
    expect(await checkGithubRepositoryAccess('a', 'b')).toBe('unreachable');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    expect(await checkGithubRepositoryAccess('a', 'b')).toBe('unreachable');
  });

  it('rejects unsafe owner/repo segments without making a request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await checkGithubRepositoryAccess('owner/../etc', 'repo')).toBe('unreachable');
    expect(await checkGithubRepositoryAccess('owner', 'repo?x=1')).toBe('unreachable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
