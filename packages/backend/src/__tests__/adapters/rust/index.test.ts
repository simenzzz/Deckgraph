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

  it('throws "not implemented" for analyzeImports', () => {
    const adapter = createRustAdapter();
    expect(() => adapter.analyzeImports('main.rs', 'use std::io;')).toThrow('not implemented');
  });

  it('returns null for queryRegistry', async () => {
    const adapter = createRustAdapter();
    const result = await adapter.queryRegistry('serde');
    expect(result).toBeNull();
  });

  it('creates a new adapter instance each call', () => {
    const a = createRustAdapter();
    const b = createRustAdapter();
    expect(a).not.toBe(b);
  });
});
