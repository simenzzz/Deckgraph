/**
 * Tests for JS/TS import analyzer.
 */

import { describe, it, expect } from 'vitest';
import { analyzeJsImports } from '../../../adapters/javascript/importAnalyzer.js';

describe('analyzeJsImports', () => {
  // ========== ESM imports ==========

  describe('ESM imports', () => {
    it('detects default import', () => {
      const source = `import React from 'react';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        source: 'react',
        specifiers: ['default'],
        isThirdParty: true,
        line: 1,
      });
    });

    it('detects named imports', () => {
      const source = `import { useState, useEffect } from 'react';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('react');
      expect(result[0]!.specifiers).toEqual(['useState', 'useEffect']);
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('detects mixed default and named imports', () => {
      const source = `import React, { useState } from 'react';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.specifiers).toEqual(['default', 'useState']);
    });

    it('detects namespace import', () => {
      const source = `import * as lodash from 'lodash';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.specifiers).toEqual(['*']);
    });

    it('detects side-effect import', () => {
      const source = `import 'core-js/stable';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('core-js/stable');
      expect(result[0]!.specifiers).toEqual(['side-effect']);
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('captures line numbers', () => {
      const source = `
import React from 'react';
import { z } from 'zod';
`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(2);
      expect(result[0]!.line).toBe(2);
      expect(result[1]!.line).toBe(3);
    });
  });

  // ========== CommonJS require ==========

  describe('CJS require', () => {
    it('detects top-level require', () => {
      const source = `const express = require('express');`;
      const result = analyzeJsImports('file.js', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('express');
      expect(result[0]!.specifiers).toEqual(['default']);
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('detects destructured require', () => {
      const source = `const { Router } = require('express');`;
      const result = analyzeJsImports('file.js', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('express');
    });

    it('detects bare require (expression statement)', () => {
      const source = `require('dotenv/config');`;
      const result = analyzeJsImports('file.js', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('dotenv/config');
    });
  });

  // ========== Dynamic import ==========

  describe('dynamic import', () => {
    it('detects dynamic import in variable declaration', () => {
      const source = `const mod = await import('chalk');`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('chalk');
      expect(result[0]!.isThirdParty).toBe(true);
    });
  });

  // ========== Re-exports ==========

  describe('re-exports', () => {
    it('detects named re-export', () => {
      const source = `export { Schema, z } from 'zod';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('zod');
      expect(result[0]!.specifiers).toEqual(['Schema', 'z']);
    });

    it('detects barrel re-export', () => {
      const source = `export * from 'lodash';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('lodash');
      expect(result[0]!.specifiers).toEqual(['*']);
    });
  });

  // ========== Third-party classification ==========

  describe('third-party classification', () => {
    it('relative imports are NOT third-party', () => {
      const source = `import { foo } from './utils';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('parent relative imports are NOT third-party', () => {
      const source = `import { bar } from '../shared/types';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('Node builtins are NOT third-party', () => {
      const builtins = ['fs', 'path', 'http', 'crypto', 'os', 'stream', 'url'];

      for (const mod of builtins) {
        const source = `import ${mod} from '${mod}';`;
        const result = analyzeJsImports('file.ts', source);
        expect(result[0]!.isThirdParty).toBe(false);
      }
    });

    it('node: prefixed builtins are NOT third-party', () => {
      const source = `import { readFile } from 'node:fs/promises';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('# private imports are NOT third-party', () => {
      const source = `import { config } from '#config';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('scoped packages ARE third-party', () => {
      const source = `import { z } from '@deckgraph/shared';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('deep scoped imports ARE third-party', () => {
      const source = `import parser from '@babel/parser';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.isThirdParty).toBe(true);
    });
  });

  // ========== TypeScript-specific ==========

  describe('TypeScript features', () => {
    it('handles type-only imports', () => {
      const source = `import type { Module } from '@deckgraph/shared';`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('@deckgraph/shared');
    });

    it('handles TSX files', () => {
      const source = `
import React from 'react';
const App = () => <div>Hello</div>;
export default App;
`;
      const result = analyzeJsImports('file.tsx', source);

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('react');
    });
  });

  // ========== Edge cases ==========

  describe('edge cases', () => {
    it('returns empty array for empty source', () => {
      const result = analyzeJsImports('file.ts', '');
      expect(result).toEqual([]);
    });

    it('returns empty array for unparseable source', () => {
      const result = analyzeJsImports('file.ts', 'this is not valid JS at all {{{');
      expect(result).toEqual([]);
    });

    it('handles multiple imports from same package', () => {
      const source = `
import React from 'react';
import { useState } from 'react';
import { useEffect } from 'react';
`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.source === 'react')).toBe(true);
    });

    it('ignores non-string require arguments', () => {
      const source = `const mod = require(dynamicVar);`;
      const result = analyzeJsImports('file.js', source);

      // Should NOT include the dynamic require
      expect(result.filter((r) => r.isThirdParty)).toHaveLength(0);
    });

    it('handles mixed ESM and CJS in same file', () => {
      const source = `
import React from 'react';
const lodash = require('lodash');
`;
      const result = analyzeJsImports('file.ts', source);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.source).sort()).toEqual(['lodash', 'react']);
    });
  });
});
