/**
 * Tests for JavaScript adapter.
 */

import { describe, it, expect } from 'vitest';
import { createJavaScriptAdapter } from '../../../adapters/javascript/index.js';

describe('createJavaScriptAdapter', () => {
  it('returns adapter for npm ecosystem', () => {
    const adapter = createJavaScriptAdapter();
    expect(adapter.ecosystem).toBe('npm');
  });

  it('declares package.json as manifest file', () => {
    const adapter = createJavaScriptAdapter();
    expect(adapter.manifestFiles).toContain('package.json');
  });

  it('declares common JS/TS source extensions', () => {
    const adapter = createJavaScriptAdapter();
    expect(adapter.sourceExtensions).toContain('.ts');
    expect(adapter.sourceExtensions).toContain('.tsx');
    expect(adapter.sourceExtensions).toContain('.js');
    expect(adapter.sourceExtensions).toContain('.jsx');
    expect(adapter.sourceExtensions).toContain('.mjs');
    expect(adapter.sourceExtensions).toContain('.cjs');
    expect(adapter.sourceExtensions).toContain('.mts');
    expect(adapter.sourceExtensions).toContain('.cts');
  });

  it('analyzes imports from JS/TS source code', async () => {
    const adapter = createJavaScriptAdapter();
    const result = await adapter.analyzeImports('test.ts', 'import x from "y"');
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('y');
    expect(result[0]!.isThirdParty).toBe(true);
  });

  it('returns null for queryRegistry', async () => {
    const adapter = createJavaScriptAdapter();
    const result = await adapter.queryRegistry('react');
    expect(result).toBeNull();
  });

  it('creates a new adapter instance each call', () => {
    const a = createJavaScriptAdapter();
    const b = createJavaScriptAdapter();
    expect(a).not.toBe(b);
  });
});
