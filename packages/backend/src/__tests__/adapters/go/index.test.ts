/**
 * Tests for Go adapter.
 */

import { describe, it, expect } from 'vitest';
import { createGoAdapter } from '../../../adapters/go/index.js';

describe('createGoAdapter', () => {
  it('returns adapter for go ecosystem', () => {
    const adapter = createGoAdapter();
    expect(adapter.ecosystem).toBe('go');
  });

  it('declares go.mod as manifest file', () => {
    const adapter = createGoAdapter();
    expect(adapter.manifestFiles).toContain('go.mod');
  });

  it('declares .go source extension', () => {
    const adapter = createGoAdapter();
    expect(adapter.sourceExtensions).toContain('.go');
  });

  it('throws "not implemented" for analyzeImports', () => {
    const adapter = createGoAdapter();
    expect(() => adapter.analyzeImports('main.go', 'package main')).toThrow('not implemented');
  });

  it('returns null for queryRegistry', async () => {
    const adapter = createGoAdapter();
    const result = await adapter.queryRegistry('github.com/gin-gonic/gin');
    expect(result).toBeNull();
  });

  it('creates a new adapter instance each call', () => {
    const a = createGoAdapter();
    const b = createGoAdapter();
    expect(a).not.toBe(b);
  });
});
