/**
 * Tests for Rust import analyzer.
 */

import { describe, it, expect } from 'vitest';
import { analyzeRustImports } from '../../../adapters/rust/importAnalyzer.js';

describe('analyzeRustImports', () => {
  describe('use declarations', () => {
    it('detects simple use', async () => {
      const result = await analyzeRustImports('main.rs', 'use serde::Deserialize;');
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('serde');
      expect(result[0]!.specifiers).toEqual(['Deserialize']);
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('detects grouped use', async () => {
      const result = await analyzeRustImports(
        'main.rs',
        'use serde::{Deserialize, Serialize};',
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('serde');
      expect(result[0]!.specifiers).toContain('Deserialize');
      expect(result[0]!.specifiers).toContain('Serialize');
    });

    it('detects wildcard use', async () => {
      const result = await analyzeRustImports('main.rs', 'use serde::*;');
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('serde');
      expect(result[0]!.specifiers).toEqual(['*']);
    });

    it('detects deep path use', async () => {
      const result = await analyzeRustImports(
        'main.rs',
        'use tokio::time::sleep;',
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('tokio');
      expect(result[0]!.specifiers).toEqual(['sleep']);
    });
  });

  describe('extern crate', () => {
    it('detects extern crate', async () => {
      const result = await analyzeRustImports('main.rs', 'extern crate serde;');
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('serde');
      expect(result[0]!.isThirdParty).toBe(true);
    });
  });

  describe('stdlib classification', () => {
    it('std is NOT third-party', async () => {
      const result = await analyzeRustImports('main.rs', 'use std::fs;');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('core is NOT third-party', async () => {
      const result = await analyzeRustImports('main.rs', 'use core::fmt;');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('alloc is NOT third-party', async () => {
      const result = await analyzeRustImports('main.rs', 'use alloc::vec::Vec;');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('crate is NOT third-party', async () => {
      const result = await analyzeRustImports('main.rs', 'use crate::utils;');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('self is NOT third-party', async () => {
      const result = await analyzeRustImports('main.rs', 'use self::module;');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('serde IS third-party', async () => {
      const result = await analyzeRustImports('main.rs', 'use serde::Deserialize;');
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('tokio IS third-party', async () => {
      const result = await analyzeRustImports('main.rs', 'use tokio::spawn;');
      expect(result[0]!.isThirdParty).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty source', async () => {
      const result = await analyzeRustImports('main.rs', '');
      expect(result).toEqual([]);
    });

    it('handles multiple use declarations', async () => {
      const source = `
use std::fs;
use serde::Deserialize;
use tokio::spawn;
`;
      const result = await analyzeRustImports('main.rs', source);
      expect(result).toHaveLength(3);

      const thirdParty = result.filter((r) => r.isThirdParty);
      expect(thirdParty).toHaveLength(2);
    });

    it('captures line numbers', async () => {
      const source = `use std::fs;\nuse serde::Deserialize;`;
      const result = await analyzeRustImports('main.rs', source);
      expect(result[0]!.line).toBe(1);
      expect(result[1]!.line).toBe(2);
    });
  });
});
