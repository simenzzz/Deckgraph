/**
 * Tests for default adapter registry.
 */

import { describe, it, expect } from 'vitest';
import { createDefaultRegistry } from '../../adapters/index.js';

describe('createDefaultRegistry', () => {
  it('registers all 5 ecosystems', () => {
    const registry = createDefaultRegistry();
    const ecosystems = registry.getRegisteredEcosystems();
    expect(ecosystems).toContain('npm');
    expect(ecosystems).toContain('pypi');
    expect(ecosystems).toContain('go');
    expect(ecosystems).toContain('cargo');
    expect(ecosystems).toContain('maven');
    expect(ecosystems).toHaveLength(5);
  });

  // Manifest lookups
  it('has an adapter for package.json', () => {
    const registry = createDefaultRegistry();
    const adapter = registry.getAdapterForManifest('package.json');
    expect(adapter?.ecosystem).toBe('npm');
  });

  it('has an adapter for pyproject.toml', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('pyproject.toml')?.ecosystem).toBe('pypi');
  });

  it('has an adapter for requirements.txt', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('requirements.txt')?.ecosystem).toBe('pypi');
  });

  it('has an adapter for setup.cfg', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('setup.cfg')?.ecosystem).toBe('pypi');
  });

  it('has an adapter for Pipfile', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('Pipfile')?.ecosystem).toBe('pypi');
  });

  it('has an adapter for go.mod', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('go.mod')?.ecosystem).toBe('go');
  });

  it('has an adapter for Cargo.toml', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('Cargo.toml')?.ecosystem).toBe('cargo');
  });

  it('has an adapter for pom.xml', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('pom.xml')?.ecosystem).toBe('maven');
  });

  it('has an adapter for build.gradle', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('build.gradle')?.ecosystem).toBe('maven');
  });

  it('has an adapter for build.gradle.kts', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('build.gradle.kts')?.ecosystem).toBe('maven');
  });

  // Source extension lookups
  it('has an adapter for .ts files', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForExtension('.ts')?.ecosystem).toBe('npm');
  });

  it('has an adapter for .py files', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForExtension('.py')?.ecosystem).toBe('pypi');
  });

  it('has an adapter for .go files', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForExtension('.go')?.ecosystem).toBe('go');
  });

  it('has an adapter for .rs files', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForExtension('.rs')?.ecosystem).toBe('cargo');
  });

  it('has an adapter for .java files', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForExtension('.java')?.ecosystem).toBe('maven');
  });

  it('has an adapter for .kt files', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForExtension('.kt')?.ecosystem).toBe('maven');
  });

  it('returns null for unknown manifest', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('unknown.file')).toBeNull();
  });
});
