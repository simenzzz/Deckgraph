/**
 * Tests for import-to-package name resolution.
 */

import { describe, it, expect } from 'vitest';
import {
  createImportPackageMap,
  extractNpmPackageName,
  extractGoModulePath,
} from '../../adapters/importPackageMap.js';

describe('createImportPackageMap', () => {
  const packageMap = createImportPackageMap();

  // ========== npm resolution ==========

  describe('npm ecosystem', () => {
    it('returns null for simple 1:1 package name', () => {
      expect(packageMap.resolvePackageName('react', 'npm')).toBeNull();
    });

    it('resolves deep imports to package name', () => {
      expect(packageMap.resolvePackageName('lodash/get', 'npm')).toBe('lodash');
    });

    it('resolves scoped deep imports', () => {
      expect(packageMap.resolvePackageName('@babel/core/lib/parser', 'npm')).toBe('@babel/core');
    });

    it('returns null for top-level scoped packages', () => {
      expect(packageMap.resolvePackageName('@babel/core', 'npm')).toBeNull();
    });
  });

  // ========== Python (pypi) mismatches ==========

  describe('pypi ecosystem', () => {
    it('resolves PIL → Pillow', () => {
      expect(packageMap.resolvePackageName('PIL', 'pypi')).toBe('Pillow');
    });

    it('resolves cv2 → opencv-python', () => {
      expect(packageMap.resolvePackageName('cv2', 'pypi')).toBe('opencv-python');
    });

    it('resolves yaml → PyYAML', () => {
      expect(packageMap.resolvePackageName('yaml', 'pypi')).toBe('PyYAML');
    });

    it('resolves bs4 → beautifulsoup4', () => {
      expect(packageMap.resolvePackageName('bs4', 'pypi')).toBe('beautifulsoup4');
    });

    it('resolves sklearn → scikit-learn', () => {
      expect(packageMap.resolvePackageName('sklearn', 'pypi')).toBe('scikit-learn');
    });

    it('resolves dotted python import via top-level module', () => {
      expect(packageMap.resolvePackageName('PIL.Image', 'pypi')).toBe('Pillow');
    });

    it('returns null for unknown pypi import', () => {
      expect(packageMap.resolvePackageName('flask', 'pypi')).toBeNull();
    });
  });

  // ========== Rust (cargo) mismatches ==========

  describe('cargo ecosystem', () => {
    it('resolves known underscore→hyphen mismatches', () => {
      expect(packageMap.resolvePackageName('serde_json', 'cargo')).toBe('serde-json');
    });

    it('resolves async_trait → async-trait', () => {
      expect(packageMap.resolvePackageName('async_trait', 'cargo')).toBe('async-trait');
    });

    it('converts underscore to hyphen for unknown crates', () => {
      expect(packageMap.resolvePackageName('my_crate', 'cargo')).toBe('my-crate');
    });

    it('returns null for crate without underscores', () => {
      expect(packageMap.resolvePackageName('serde', 'cargo')).toBeNull();
    });
  });

  // ========== Go resolution ==========

  describe('go ecosystem', () => {
    it('extracts module path from deep import', () => {
      expect(
        packageMap.resolvePackageName('github.com/gin-gonic/gin/context', 'go'),
      ).toBe('github.com/gin-gonic/gin');
    });

    it('returns null for top-level module path', () => {
      expect(
        packageMap.resolvePackageName('github.com/gin-gonic/gin', 'go'),
      ).toBeNull();
    });
  });

  // ========== Maven resolution ==========

  describe('maven ecosystem', () => {
    it('returns null (no mismatches registered yet)', () => {
      expect(
        packageMap.resolvePackageName('com.google.gson', 'maven'),
      ).toBeNull();
    });
  });
});

// ========== extractNpmPackageName ==========

describe('extractNpmPackageName', () => {
  it('handles simple package', () => {
    expect(extractNpmPackageName('react')).toBe('react');
  });

  it('handles deep import', () => {
    expect(extractNpmPackageName('lodash/get')).toBe('lodash');
  });

  it('handles scoped package', () => {
    expect(extractNpmPackageName('@babel/core')).toBe('@babel/core');
  });

  it('handles scoped deep import', () => {
    expect(extractNpmPackageName('@babel/core/lib/parser')).toBe('@babel/core');
  });

  it('handles @ with no slash', () => {
    expect(extractNpmPackageName('@scope')).toBe('@scope');
  });
});

// ========== extractGoModulePath ==========

describe('extractGoModulePath', () => {
  it('extracts 3-segment github path', () => {
    expect(extractGoModulePath('github.com/gin-gonic/gin')).toBe(
      'github.com/gin-gonic/gin',
    );
  });

  it('extracts from deep import', () => {
    expect(extractGoModulePath('github.com/gin-gonic/gin/context')).toBe(
      'github.com/gin-gonic/gin',
    );
  });

  it('returns stdlib path unchanged', () => {
    expect(extractGoModulePath('fmt')).toBe('fmt');
  });

  it('returns 2-segment path unchanged when no dot', () => {
    expect(extractGoModulePath('internal/util')).toBe('internal/util');
  });
});
