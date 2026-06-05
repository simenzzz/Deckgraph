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

  it('analyzes imports from Go source code', async () => {
    const adapter = createGoAdapter();
    const result = await adapter.analyzeImports('main.go', 'package main\nimport "github.com/gin-gonic/gin"');
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('github.com/gin-gonic/gin');
    expect(result[0]!.isThirdParty).toBe(true);
  });

  it('returns error for queryRegistry without a cache', async () => {
    const adapter = createGoAdapter();
    const result = await adapter.queryRegistry('github.com/gin-gonic/gin');
    expect(result).toEqual({ status: 'error' });
  });

  it('creates a new adapter instance each call', () => {
    const a = createGoAdapter();
    const b = createGoAdapter();
    expect(a).not.toBe(b);
  });
});
