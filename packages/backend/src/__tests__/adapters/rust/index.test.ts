/**
 * Tests for Rust adapter.
 */

import { describe, it, expect } from 'vitest';
import { createRustAdapter } from '../../../adapters/rust/index.js';

describe('createRustAdapter', () => {
  it('returns adapter for cargo ecosystem', () => {
    const adapter = createRustAdapter();
    expect(adapter.ecosystem).toBe('cargo');
  });

  it('declares Cargo.toml as manifest file', () => {
    const adapter = createRustAdapter();
    expect(adapter.manifestFiles).toContain('Cargo.toml');
  });

  it('declares .rs source extension', () => {
    const adapter = createRustAdapter();
    expect(adapter.sourceExtensions).toContain('.rs');
  });

  it('analyzes imports from Rust source code', async () => {
    const adapter = createRustAdapter();
    const result = await adapter.analyzeImports('main.rs', 'use serde::Deserialize;');
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('serde');
    expect(result[0]!.isThirdParty).toBe(true);
  });

  it('returns error for queryRegistry without a cache', async () => {
    const adapter = createRustAdapter();
    const result = await adapter.queryRegistry('serde');
    expect(result).toEqual({ status: 'error' });
  });

  it('creates a new adapter instance each call', () => {
    const a = createRustAdapter();
    const b = createRustAdapter();
    expect(a).not.toBe(b);
  });
});
