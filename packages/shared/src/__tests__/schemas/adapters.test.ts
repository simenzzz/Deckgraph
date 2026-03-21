/**
 * Tests for adapter schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  parsedImportSchema,
  minimalDependencySchema,
  manifestResultSchema,
  registryMetaSchema,
} from '../../schemas/adapters.js';

describe('adapter schemas', () => {
  describe('parsedImportSchema', () => {
    const validImport = {
      source: 'react',
      specifiers: ['useState', 'useEffect'],
      isThirdParty: true,
      line: 1,
    };

    it('accepts valid parsed imports', () => {
      expect(parsedImportSchema.parse(validImport)).toEqual(validImport);
    });

    it('rejects invalid line numbers', () => {
      expect(() => parsedImportSchema.parse({ ...validImport, line: 0 })).toThrow();
      expect(() => parsedImportSchema.parse({ ...validImport, line: -1 })).toThrow();
      expect(() => parsedImportSchema.parse({ ...validImport, line: 1.5 })).toThrow();
    });

    it('rejects empty object', () => {
      expect(() => parsedImportSchema.parse({})).toThrow();
    });

    it('rejects wrong types', () => {
      expect(() => parsedImportSchema.parse({ ...validImport, source: 123 })).toThrow();
      expect(() => parsedImportSchema.parse({ ...validImport, isThirdParty: 'yes' })).toThrow();
      expect(() => parsedImportSchema.parse({ ...validImport, specifiers: 'react' })).toThrow();
    });
  });

  describe('minimalDependencySchema', () => {
    const validMinDep = {
      name: 'react',
      version: '18.2.0',
      constraint: '^18.0.0',
      scope: 'runtime',
    };

    it('accepts valid minimal dependencies', () => {
      expect(minimalDependencySchema.parse(validMinDep)).toEqual(validMinDep);
    });

    it('rejects empty object', () => {
      expect(() => minimalDependencySchema.parse({})).toThrow();
    });

    it('rejects invalid scope', () => {
      expect(() =>
        minimalDependencySchema.parse({ ...validMinDep, scope: 'production' }),
      ).toThrow();
    });
  });

  describe('manifestResultSchema', () => {
    const validResult = {
      moduleName: 'my-package',
      dependencies: [
        { name: 'react', version: '18.2.0', constraint: '^18.0.0', scope: 'runtime' },
        { name: 'typescript', version: '5.0.0', constraint: '^5.0.0', scope: 'dev' },
      ],
      hasLockFile: true,
      metadata: {
        scripts: { build: 'tsc' },
      },
    };

    it('accepts valid manifest results', () => {
      expect(manifestResultSchema.parse(validResult)).toEqual(validResult);
    });

    it('accepts empty dependencies', () => {
      expect(manifestResultSchema.parse({ ...validResult, dependencies: [] })).toBeTruthy();
    });

    it('accepts empty metadata', () => {
      expect(manifestResultSchema.parse({ ...validResult, metadata: {} })).toBeTruthy();
    });

    it('rejects empty object', () => {
      expect(() => manifestResultSchema.parse({})).toThrow();
    });

    it('rejects missing required fields', () => {
      expect(() =>
        manifestResultSchema.parse({ moduleName: 'test', dependencies: [] }),
      ).toThrow();
    });

    it('rejects wrong types', () => {
      expect(() =>
        manifestResultSchema.parse({ ...validResult, hasLockFile: 'true' }),
      ).toThrow();
    });
  });

  describe('registryMetaSchema', () => {
    const validMeta = {
      latestVersion: '1.0.0',
      description: 'Test package',
      license: 'MIT',
      homepage: 'https://example.com',
      downloads: 1000,
      deprecated: false,
      publishedAt: '2024-01-01T00:00:00Z',
    };

    it('accepts valid registry metadata', () => {
      expect(registryMetaSchema.parse(validMeta)).toEqual(validMeta);
    });

    it('accepts nullable fields', () => {
      expect(
        registryMetaSchema.parse({
          ...validMeta,
          license: null,
          homepage: null,
          downloads: null,
          publishedAt: null,
        }),
      ).toBeTruthy();
    });
  });
});
