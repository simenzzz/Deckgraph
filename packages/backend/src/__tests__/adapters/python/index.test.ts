/**
 * Tests for Python adapter.
 */

import { describe, it, expect } from 'vitest';
import { createPythonAdapter } from '../../../adapters/python/index.js';

describe('createPythonAdapter', () => {
  it('returns adapter for pypi ecosystem', () => {
    const adapter = createPythonAdapter();
    expect(adapter.ecosystem).toBe('pypi');
  });

  it('declares all Python manifest files', () => {
    const adapter = createPythonAdapter();
    expect(adapter.manifestFiles).toContain('pyproject.toml');
    expect(adapter.manifestFiles).toContain('setup.cfg');
    expect(adapter.manifestFiles).toContain('requirements.txt');
    expect(adapter.manifestFiles).toContain('Pipfile');
  });

  it('declares Python source extensions', () => {
    const adapter = createPythonAdapter();
    expect(adapter.sourceExtensions).toContain('.py');
    expect(adapter.sourceExtensions).toContain('.pyi');
  });

  it('throws "not implemented" for analyzeImports', () => {
    const adapter = createPythonAdapter();
    expect(() => adapter.analyzeImports('main.py', 'import flask')).toThrow('not implemented');
  });

  it('returns null for queryRegistry', async () => {
    const adapter = createPythonAdapter();
    const result = await adapter.queryRegistry('flask');
    expect(result).toBeNull();
  });

  it('creates a new adapter instance each call', () => {
    const a = createPythonAdapter();
    const b = createPythonAdapter();
    expect(a).not.toBe(b);
  });
});
