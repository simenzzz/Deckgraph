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

  it('analyzes imports from Python source code', async () => {
    const adapter = createPythonAdapter();
    const result = await adapter.analyzeImports('main.py', 'import flask');
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('flask');
    expect(result[0]!.isThirdParty).toBe(true);
  });

  it('returns error for queryRegistry without a cache', async () => {
    const adapter = createPythonAdapter();
    const result = await adapter.queryRegistry('flask');
    expect(result).toEqual({ status: 'error' });
  });

  it('creates a new adapter instance each call', () => {
    const a = createPythonAdapter();
    const b = createPythonAdapter();
    expect(a).not.toBe(b);
  });
});
