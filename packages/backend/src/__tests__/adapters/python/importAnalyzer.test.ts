/**
 * Tests for Python import analyzer.
 */

import { describe, it, expect } from 'vitest';
import { analyzePythonImports } from '../../../adapters/python/importAnalyzer.js';

describe('analyzePythonImports', () => {
  describe('import statements', () => {
    it('detects simple import', async () => {
      const result = await analyzePythonImports('main.py', 'import flask');
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('flask');
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('detects dotted import', async () => {
      const result = await analyzePythonImports('main.py', 'import os.path');
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('os.path');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('detects aliased import', async () => {
      const result = await analyzePythonImports('main.py', 'import numpy as np');
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('numpy');
      expect(result[0]!.isThirdParty).toBe(true);
    });
  });

  describe('from...import statements', () => {
    it('detects from...import', async () => {
      const result = await analyzePythonImports('main.py', 'from flask import Flask');
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('flask');
      expect(result[0]!.specifiers).toContain('Flask');
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('detects multiple specifiers', async () => {
      const result = await analyzePythonImports(
        'main.py',
        'from flask import Flask, jsonify, request',
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.specifiers).toContain('Flask');
      expect(result[0]!.specifiers).toContain('jsonify');
      expect(result[0]!.specifiers).toContain('request');
    });

    it('detects wildcard import', async () => {
      const result = await analyzePythonImports('main.py', 'from os import *');
      expect(result).toHaveLength(1);
      expect(result[0]!.specifiers).toContain('*');
    });
  });

  describe('stdlib classification', () => {
    it('os is NOT third-party', async () => {
      const result = await analyzePythonImports('main.py', 'import os');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('sys is NOT third-party', async () => {
      const result = await analyzePythonImports('main.py', 'import sys');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('json is NOT third-party', async () => {
      const result = await analyzePythonImports('main.py', 'import json');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('collections.abc is NOT third-party', async () => {
      const result = await analyzePythonImports('main.py', 'from collections import OrderedDict');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('flask IS third-party', async () => {
      const result = await analyzePythonImports('main.py', 'import flask');
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('numpy IS third-party', async () => {
      const result = await analyzePythonImports('main.py', 'import numpy');
      expect(result[0]!.isThirdParty).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty source', async () => {
      const result = await analyzePythonImports('main.py', '');
      expect(result).toEqual([]);
    });

    it('handles multiple imports', async () => {
      const source = `
import os
import flask
from datetime import datetime
from requests import get
`;
      const result = await analyzePythonImports('main.py', source);
      expect(result).toHaveLength(4);

      const thirdParty = result.filter((r) => r.isThirdParty);
      expect(thirdParty).toHaveLength(2);
      expect(thirdParty.map((r) => r.source).sort()).toEqual(['flask', 'requests']);
    });

    it('captures line numbers', async () => {
      const source = `import os\nimport flask`;
      const result = await analyzePythonImports('main.py', source);
      expect(result[0]!.line).toBe(1);
      expect(result[1]!.line).toBe(2);
    });
  });
});
