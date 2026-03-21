/**
 * Tests for default adapter registry.
 */

import { describe, it, expect } from 'vitest';
import { createDefaultRegistry } from '../../adapters/index.js';

describe('createDefaultRegistry', () => {
  it('creates a registry with npm registered', () => {
    const registry = createDefaultRegistry();
    expect(registry.getRegisteredEcosystems()).toContain('npm');
  });

  it('has an adapter for package.json', () => {
    const registry = createDefaultRegistry();
    const adapter = registry.getAdapterForManifest('package.json');
    expect(adapter).not.toBeNull();
    expect(adapter?.ecosystem).toBe('npm');
  });

  it('has an adapter for .ts files', () => {
    const registry = createDefaultRegistry();
    const adapter = registry.getAdapterForExtension('.ts');
    expect(adapter).not.toBeNull();
    expect(adapter?.ecosystem).toBe('npm');
  });

  it('returns null for unregistered ecosystems', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAdapterForManifest('go.mod')).toBeNull();
    expect(registry.getAdapterForManifest('Cargo.toml')).toBeNull();
  });
});
