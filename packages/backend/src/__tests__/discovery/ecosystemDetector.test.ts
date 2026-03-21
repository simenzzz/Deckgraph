/**
 * Tests for ecosystem detector.
 */

import { describe, it, expect } from 'vitest';
import { detectEcosystem, getAllManifestFileNames } from '../../discovery/ecosystemDetector.js';

describe('detectEcosystem', () => {
  it('maps package.json to npm', () => {
    expect(detectEcosystem('package.json')).toBe('npm');
  });

  it('maps pyproject.toml to pypi', () => {
    expect(detectEcosystem('pyproject.toml')).toBe('pypi');
  });

  it('maps setup.cfg to pypi', () => {
    expect(detectEcosystem('setup.cfg')).toBe('pypi');
  });

  it('maps requirements.txt to pypi', () => {
    expect(detectEcosystem('requirements.txt')).toBe('pypi');
  });

  it('maps Pipfile to pypi', () => {
    expect(detectEcosystem('Pipfile')).toBe('pypi');
  });

  it('maps setup.py to pypi', () => {
    expect(detectEcosystem('setup.py')).toBe('pypi');
  });

  it('maps go.mod to go', () => {
    expect(detectEcosystem('go.mod')).toBe('go');
  });

  it('maps Cargo.toml to cargo', () => {
    expect(detectEcosystem('Cargo.toml')).toBe('cargo');
  });

  it('maps pom.xml to maven', () => {
    expect(detectEcosystem('pom.xml')).toBe('maven');
  });

  it('maps build.gradle to maven', () => {
    expect(detectEcosystem('build.gradle')).toBe('maven');
  });

  it('maps build.gradle.kts to maven', () => {
    expect(detectEcosystem('build.gradle.kts')).toBe('maven');
  });

  it('returns null for unknown filenames', () => {
    expect(detectEcosystem('README.md')).toBeNull();
    expect(detectEcosystem('tsconfig.json')).toBeNull();
    expect(detectEcosystem('')).toBeNull();
  });
});

describe('getAllManifestFileNames', () => {
  it('returns all recognized manifest filenames', () => {
    const names = getAllManifestFileNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain('package.json');
    expect(names).toContain('go.mod');
    expect(names).toContain('Cargo.toml');
  });

  it('returns a frozen snapshot (no mutations between calls)', () => {
    const first = getAllManifestFileNames();
    const second = getAllManifestFileNames();
    expect(first).toEqual(second);
  });
});
