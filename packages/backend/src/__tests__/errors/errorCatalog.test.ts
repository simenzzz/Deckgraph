import { describe, it, expect } from 'vitest';
import { ErrorCatalog, createCatalogError, type ErrorEntry } from '../../errors/errorCatalog.js';

describe('ErrorCatalog', () => {
  it('has entries for all expected error codes', () => {
    const expectedCodes = [
      'INVALID_JSON',
      'VALIDATION_FAILED',
      'SCAN_ALREADY_RUNNING',
      'NO_SCAN_DATA',
      'MODULE_NOT_FOUND',
      'MODULE_ALREADY_ANALYZED',
      'INVALID_PACKAGE_NAME',
      'NO_ADAPTER',
      'PACKAGE_NOT_FOUND',
      'DEPENDENCY_NOT_IN_PROJECT',
      'NO_WORKSPACE_CONFIG',
      'OPERATION_IN_PROGRESS',
      'INTERNAL_ERROR',
      'REGISTRY_UNREACHABLE',
      'FILE_NOT_FOUND',
      'PERMISSION_DENIED',
      'INVALID_CONFIG',
      'PACKAGE_MANAGER_FAIL',
    ];

    for (const code of expectedCodes) {
      expect(ErrorCatalog).toHaveProperty(code);
      const entry = (ErrorCatalog as Record<string, ErrorEntry>)[code];
      expect(entry).toBeDefined();
      expect(entry.code).toBe(code);
    }
  });

  it('all entries have non-empty code, message, and suggestion', () => {
    for (const [key, entry] of Object.entries(ErrorCatalog)) {
      expect(entry.code, `Entry "${key}" code`).toBeTruthy();
      expect(entry.message, `Entry "${key}" message`).toBeTruthy();
      expect(entry.suggestion, `Entry "${key}" suggestion`).toBeTruthy();
    }
  });

  it('all codes are unique', () => {
    const codes = Object.values(ErrorCatalog).map((e) => e.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});

describe('createCatalogError', () => {
  it('creates error without context', () => {
    const error = createCatalogError(ErrorCatalog.INVALID_JSON, 'req-1');
    expect(error.type).toBe('error');
    expect(error.requestId).toBe('req-1');
    expect(error.message).toBe('Invalid JSON received');
    expect(error.suggestion).toBe('Ensure the message is valid JSON');
  });

  it('appends context to message when provided', () => {
    const error = createCatalogError(ErrorCatalog.MODULE_NOT_FOUND, 'req-2', '/src/foo');
    expect(error.message).toBe('Module not found: /src/foo');
    expect(error.suggestion).toBe(ErrorCatalog.MODULE_NOT_FOUND.suggestion);
  });
});
