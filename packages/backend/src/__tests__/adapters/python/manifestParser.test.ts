/**
 * Tests for Python manifest parser.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parsePythonManifests } from '../../../adapters/python/manifestParser.js';

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, readFile: vi.fn() };
});

import { readFile } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFiles(files: Record<string, string | null>): void {
  mockReadFile.mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
    const pathStr = typeof path === 'string' ? path : path.toString();
    for (const [filePath, content] of Object.entries(files)) {
      if (pathStr.endsWith(filePath) || pathStr === filePath) {
        if (content === null) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return content;
      }
    }
    throw Object.assign(new Error(`ENOENT: ${pathStr}`), { code: 'ENOENT' });
  });
}

describe('parsePythonManifests', () => {
  describe('pyproject.toml — PEP 621', () => {
    it('parses project.dependencies as runtime', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "my-app"',
          'dependencies = ["flask>=2.0", "requests>=2.28"]',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.moduleName).toBe('my-app');
      expect(result.dependencies).toHaveLength(2);
      const flask = result.dependencies.find((d) => d.name === 'flask')!;
      expect(flask.scope).toBe('runtime');
      expect(flask.constraint).toBe('>=2.0');
    });

    it('parses optional-dependencies as optional', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "my-lib"',
          '',
          '[project.optional-dependencies]',
          'dev = ["pytest>=7.0"]',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]!.scope).toBe('optional');
    });

    it('parses build-system.requires as build', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "my-lib"',
          '',
          '[build-system]',
          'requires = ["setuptools>=68.0"]',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]!.scope).toBe('build');
      expect(result.dependencies[0]!.name).toBe('setuptools');
    });

    it('extracts module name from project.name', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "my-python-app"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.moduleName).toBe('my-python-app');
    });

    it('includes metadata', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "my-app"',
          'requires-python = ">=3.9"',
          '',
          '[project.optional-dependencies]',
          'dev = ["pytest"]',
          'docs = ["sphinx"]',
          '',
          '[build-system]',
          'requires = ["setuptools"]',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.metadata['manifestFormat']).toBe('pep621');
      expect(result.metadata['pythonVersion']).toBe('>=3.9');
      expect(result.metadata['extras']).toEqual(['dev', 'docs']);
    });
  });

  describe('pyproject.toml — Poetry', () => {
    it('parses tool.poetry.dependencies as runtime', async () => {
      mockFiles({
        'pyproject.toml': [
          '[tool.poetry]',
          'name = "my-poetry-app"',
          '',
          '[tool.poetry.dependencies]',
          'python = "^3.9"',
          'flask = "^2.0"',
          'requests = ">=2.28"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.moduleName).toBe('my-poetry-app');
      // python is filtered out
      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies.every((d) => d.scope === 'runtime')).toBe(true);
    });

    it('filters out python dependency', async () => {
      mockFiles({
        'pyproject.toml': [
          '[tool.poetry]',
          'name = "app"',
          '',
          '[tool.poetry.dependencies]',
          'python = "^3.9"',
          'flask = "^2.0"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]!.name).toBe('flask');
    });

    it('parses group.dev.dependencies as dev', async () => {
      mockFiles({
        'pyproject.toml': [
          '[tool.poetry]',
          'name = "app"',
          '',
          '[tool.poetry.group.dev.dependencies]',
          'pytest = "^7.0"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]!.scope).toBe('dev');
    });

    it('identifies as poetry format', async () => {
      mockFiles({
        'pyproject.toml': [
          '[tool.poetry]',
          'name = "app"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.metadata['manifestFormat']).toBe('poetry');
    });
  });

  describe('PEP 508 parsing', () => {
    it('parses basic name>=version', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "app"',
          'dependencies = ["requests>=2.0"]',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('requests');
      expect(result.dependencies[0]!.constraint).toBe('>=2.0');
    });

    it('parses extras: name[extra]>=version', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "app"',
          'dependencies = ["uvicorn[standard]>=0.20"]',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('uvicorn');
      expect(result.dependencies[0]!.constraint).toBe('>=0.20');
    });

    it('parses markers: name; condition', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "app"',
          `dependencies = ["pywin32>=300; sys_platform == 'win32'"]`,
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('pywin32');
      expect(result.dependencies[0]!.constraint).toBe('>=300');
    });

    it('parses bare name', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "app"',
          'dependencies = ["numpy"]',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('numpy');
      expect(result.dependencies[0]!.constraint).toBe('*');
    });
  });

  describe('requirements.txt parsing', () => {
    it('parses pinned versions', async () => {
      mockFiles({
        'requirements.txt': [
          'flask==2.3.0',
          'requests==2.31.0',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies[0]!.constraint).toBe('==2.3.0');
      expect(result.dependencies[0]!.scope).toBe('runtime');
    });

    it('parses range versions', async () => {
      mockFiles({
        'requirements.txt': 'flask>=2.0,<3.0',
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies[0]!.constraint).toBe('>=2.0,<3.0');
    });

    it('skips blank lines and comments', async () => {
      mockFiles({
        'requirements.txt': [
          '# Core deps',
          '',
          'flask==2.3.0',
          '',
          '# Dev deps',
          'pytest==7.0.0',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(2);
    });

    it('skips -r includes and -e editable installs', async () => {
      mockFiles({
        'requirements.txt': [
          '-r base.txt',
          '-e .',
          '--index-url https://pypi.org/simple',
          'flask==2.3.0',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]!.name).toBe('flask');
    });

    it('strips inline comments', async () => {
      mockFiles({
        'requirements.txt': 'flask==2.3.0 # web framework',
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('flask');
      expect(result.dependencies[0]!.constraint).toBe('==2.3.0');
    });

    it('uses directory name as module name', async () => {
      mockFiles({
        'requirements.txt': 'flask==2.3.0',
      });

      const result = await parsePythonManifests('/project', 'services/api');

      expect(result.moduleName).toBe('api');
    });
  });

  describe('Pipfile parsing', () => {
    it('parses packages as runtime', async () => {
      mockFiles({
        'Pipfile': [
          '[packages]',
          'flask = ">=2.0"',
          'requests = "*"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies.every((d) => d.scope === 'runtime')).toBe(true);
      expect(result.dependencies.find((d) => d.name === 'requests')!.constraint).toBe('*');
    });

    it('parses dev-packages as dev', async () => {
      mockFiles({
        'Pipfile': [
          '[dev-packages]',
          'pytest = ">=7.0"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]!.scope).toBe('dev');
    });

    it('handles table value format', async () => {
      mockFiles({
        'Pipfile': [
          '[packages]',
          '',
          '[packages.django]',
          'version = ">=4.0"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('django');
      expect(result.dependencies[0]!.constraint).toBe('>=4.0');
    });
  });

  describe('setup.cfg parsing', () => {
    it('parses install_requires as runtime', async () => {
      mockFiles({
        'setup.cfg': [
          '[metadata]',
          'name = my-cfg-app',
          '',
          '[options]',
          'install_requires =',
          '    flask>=2.0',
          '    requests>=2.28',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.moduleName).toBe('my-cfg-app');
      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies.every((d) => d.scope === 'runtime')).toBe(true);
    });

    it('parses extras_require as optional', async () => {
      mockFiles({
        'setup.cfg': [
          '[metadata]',
          'name = my-lib',
          '',
          '[options.extras_require]',
          'dev =',
          '    pytest>=7.0',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]!.scope).toBe('optional');
    });

    it('parses setup_requires as build', async () => {
      mockFiles({
        'setup.cfg': [
          '[metadata]',
          'name = my-lib',
          '',
          '[options]',
          'setup_requires =',
          '    setuptools>=68.0',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]!.scope).toBe('build');
    });

    it('extracts metadata name', async () => {
      mockFiles({
        'setup.cfg': [
          '[metadata]',
          'name = my-special-name',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.moduleName).toBe('my-special-name');
    });
  });

  describe('manifest priority', () => {
    it('prefers pyproject.toml over Pipfile', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "from-pyproject"',
          'dependencies = ["flask>=2.0"]',
        ].join('\n'),
        'Pipfile': [
          '[packages]',
          'requests = "*"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.moduleName).toBe('from-pyproject');
      expect(result.dependencies[0]!.name).toBe('flask');
    });

    it('prefers Pipfile over setup.cfg', async () => {
      mockFiles({
        'Pipfile': [
          '[packages]',
          'flask = ">=2.0"',
        ].join('\n'),
        'setup.cfg': [
          '[metadata]',
          'name = from-setup',
          '',
          '[options]',
          'install_requires =',
          '    requests>=2.28',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('flask');
    });

    it('prefers setup.cfg over requirements.txt', async () => {
      mockFiles({
        'setup.cfg': [
          '[metadata]',
          'name = from-setup',
          '',
          '[options]',
          'install_requires =',
          '    flask>=2.0',
        ].join('\n'),
        'requirements.txt': 'requests==2.31.0',
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.moduleName).toBe('from-setup');
      expect(result.dependencies[0]!.name).toBe('flask');
    });
  });

  describe('lock file resolution', () => {
    it('resolves versions from poetry.lock', async () => {
      mockFiles({
        'pyproject.toml': [
          '[tool.poetry]',
          'name = "app"',
          '',
          '[tool.poetry.dependencies]',
          'python = "^3.9"',
          'flask = "^2.0"',
        ].join('\n'),
        'poetry.lock': [
          '[[package]]',
          'name = "flask"',
          'version = "2.3.3"',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      expect(result.dependencies[0]!.version).toBe('2.3.3');
      expect(result.dependencies[0]!.constraint).toBe('^2.0');
    });

    it('resolves versions from Pipfile.lock', async () => {
      mockFiles({
        'Pipfile': [
          '[packages]',
          'flask = ">=2.0"',
        ].join('\n'),
        'Pipfile.lock': JSON.stringify({
          default: {
            flask: { version: '==2.3.3' },
          },
        }),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      expect(result.dependencies[0]!.version).toBe('2.3.3');
    });

    it('strips == prefix from Pipfile.lock versions', async () => {
      mockFiles({
        'Pipfile': [
          '[packages]',
          'requests = "*"',
        ].join('\n'),
        'Pipfile.lock': JSON.stringify({
          default: {
            requests: { version: '==2.31.0' },
          },
        }),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.dependencies[0]!.version).toBe('2.31.0');
    });

    it('continues without lock file if none found', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "app"',
          'dependencies = ["flask>=2.0"]',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.hasLockFile).toBe(false);
      expect(result.dependencies[0]!.version).toBe('>=2.0');
    });
  });

  describe('error handling', () => {
    it('throws when no manifest found', async () => {
      mockFiles({});

      await expect(parsePythonManifests('/project', '.')).rejects.toThrow(
        'No Python manifest found',
      );
    });

    it('throws when pyproject.toml has invalid TOML', async () => {
      mockFiles({
        'pyproject.toml': 'not valid toml {{{',
      });

      await expect(parsePythonManifests('/project', '.')).rejects.toThrow();
    });
  });

  describe('output validation', () => {
    it('output passes shared schema validation', async () => {
      mockFiles({
        'pyproject.toml': [
          '[project]',
          'name = "validated-app"',
          'dependencies = ["flask>=2.0", "requests>=2.28"]',
          '',
          '[project.optional-dependencies]',
          'dev = ["pytest>=7.0"]',
        ].join('\n'),
      });

      const result = await parsePythonManifests('/project', '.');

      expect(result.moduleName).toBe('validated-app');
      expect(result.dependencies).toHaveLength(3);
    });
  });
});
