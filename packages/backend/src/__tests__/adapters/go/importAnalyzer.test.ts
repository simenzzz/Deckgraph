/**
 * Tests for Go import analyzer.
 */

import { describe, it, expect } from 'vitest';
import { analyzeGoImports } from '../../../adapters/go/importAnalyzer.js';

describe('analyzeGoImports', () => {
  describe('single import', () => {
    it('detects single import', async () => {
      const result = await analyzeGoImports(
        'main.go',
        'package main\nimport "fmt"',
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('fmt');
      expect(result[0]!.isThirdParty).toBe(false);
    });
  });

  describe('grouped imports', () => {
    it('detects grouped imports', async () => {
      const source = `package main
import (
  "fmt"
  "github.com/gin-gonic/gin"
)`;
      const result = await analyzeGoImports('main.go', source);
      expect(result).toHaveLength(2);

      const fmtImport = result.find((r) => r.source === 'fmt');
      expect(fmtImport!.isThirdParty).toBe(false);

      const ginImport = result.find((r) => r.source === 'github.com/gin-gonic/gin');
      expect(ginImport!.isThirdParty).toBe(true);
    });
  });

  describe('third-party classification', () => {
    it('stdlib paths (no dot) are NOT third-party', async () => {
      const source = `package main
import (
  "fmt"
  "net/http"
  "encoding/json"
  "os"
)`;
      const result = await analyzeGoImports('main.go', source);
      expect(result.every((r) => !r.isThirdParty)).toBe(true);
    });

    it('domain paths are third-party', async () => {
      const source = `package main
import (
  "github.com/gin-gonic/gin"
  "golang.org/x/sync/errgroup"
)`;
      const result = await analyzeGoImports('main.go', source);
      expect(result.every((r) => r.isThirdParty)).toBe(true);
    });
  });

  describe('aliased imports', () => {
    it('detects aliased import', async () => {
      const source = `package main
import mygin "github.com/gin-gonic/gin"`;
      const result = await analyzeGoImports('main.go', source);
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('github.com/gin-gonic/gin');
      expect(result[0]!.specifiers).toEqual(['mygin']);
    });
  });

  describe('edge cases', () => {
    it('handles empty source', async () => {
      const result = await analyzeGoImports('main.go', 'package main');
      expect(result).toEqual([]);
    });

    it('captures line numbers', async () => {
      const source = `package main
import "fmt"
import "os"`;
      const result = await analyzeGoImports('main.go', source);
      expect(result[0]!.line).toBe(2);
      expect(result[1]!.line).toBe(3);
    });
  });
});
