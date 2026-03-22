/**
 * Tests for Java import analyzer.
 */

import { describe, it, expect } from 'vitest';
import { analyzeJavaImports } from '../../../adapters/java/importAnalyzer.js';

describe('analyzeJavaImports', () => {
  describe('import declarations', () => {
    it('detects simple import', async () => {
      const result = await analyzeJavaImports(
        'Main.java',
        'import com.google.gson.Gson;',
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe('com.google.gson');
      expect(result[0]!.specifiers).toEqual(['Gson']);
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('detects wildcard import', async () => {
      const result = await analyzeJavaImports(
        'Main.java',
        'import com.google.common.collect.*;',
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.specifiers).toEqual(['*']);
    });

    it('detects static import', async () => {
      const result = await analyzeJavaImports(
        'Main.java',
        'import static org.junit.Assert.assertEquals;',
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.isThirdParty).toBe(true);
    });
  });

  describe('stdlib classification', () => {
    it('java.util is NOT third-party', async () => {
      const result = await analyzeJavaImports('Main.java', 'import java.util.List;');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('javax.servlet is NOT third-party', async () => {
      const result = await analyzeJavaImports(
        'Main.java',
        'import javax.servlet.http.HttpServlet;',
      );
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('java.io is NOT third-party', async () => {
      const result = await analyzeJavaImports('Main.java', 'import java.io.*;');
      expect(result[0]!.isThirdParty).toBe(false);
    });

    it('com.google.gson IS third-party', async () => {
      const result = await analyzeJavaImports(
        'Main.java',
        'import com.google.gson.Gson;',
      );
      expect(result[0]!.isThirdParty).toBe(true);
    });

    it('org.springframework IS third-party', async () => {
      const result = await analyzeJavaImports(
        'Main.java',
        'import org.springframework.boot.SpringApplication;',
      );
      expect(result[0]!.isThirdParty).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty source', async () => {
      const result = await analyzeJavaImports('Main.java', '');
      expect(result).toEqual([]);
    });

    it('handles multiple imports', async () => {
      const source = `
import java.util.List;
import com.google.gson.Gson;
import org.slf4j.Logger;
`;
      const result = await analyzeJavaImports('Main.java', source);
      expect(result).toHaveLength(3);

      const thirdParty = result.filter((r) => r.isThirdParty);
      expect(thirdParty).toHaveLength(2);
    });

    it('captures line numbers', async () => {
      const source = `import java.util.List;\nimport com.google.gson.Gson;`;
      const result = await analyzeJavaImports('Main.java', source);
      expect(result[0]!.line).toBe(1);
      expect(result[1]!.line).toBe(2);
    });
  });
});
