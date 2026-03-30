import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { mapError } from '../../errors/errorMapper.js';
import { ErrorCatalog } from '../../errors/errorCatalog.js';
import { DeckgraphConfigError } from '../../config/configLoader.js';

describe('mapError', () => {
  it('maps ENOENT to FILE_NOT_FOUND', () => {
    const error = Object.assign(new Error('file not found'), { code: 'ENOENT' });
    expect(mapError(error)).toBe(ErrorCatalog.FILE_NOT_FOUND);
  });

  it('maps EACCES to PERMISSION_DENIED', () => {
    const error = Object.assign(new Error('access denied'), { code: 'EACCES' });
    expect(mapError(error)).toBe(ErrorCatalog.PERMISSION_DENIED);
  });

  it('maps EPERM to PERMISSION_DENIED', () => {
    const error = Object.assign(new Error('operation not permitted'), { code: 'EPERM' });
    expect(mapError(error)).toBe(ErrorCatalog.PERMISSION_DENIED);
  });

  it('maps ECONNREFUSED to REGISTRY_UNREACHABLE', () => {
    const error = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    expect(mapError(error)).toBe(ErrorCatalog.REGISTRY_UNREACHABLE);
  });

  it('maps ZodError to INVALID_CONFIG', () => {
    const error = new ZodError([]);
    expect(mapError(error)).toBe(ErrorCatalog.INVALID_CONFIG);
  });

  it('maps DeckgraphConfigError to INVALID_CONFIG', () => {
    const error = new DeckgraphConfigError('Bad config');
    expect(mapError(error)).toBe(ErrorCatalog.INVALID_CONFIG);
  });

  it('maps unknown Error to INTERNAL_ERROR', () => {
    expect(mapError(new Error('something broke'))).toBe(ErrorCatalog.INTERNAL_ERROR);
  });

  it('maps string to INTERNAL_ERROR', () => {
    expect(mapError('string error')).toBe(ErrorCatalog.INTERNAL_ERROR);
  });

  it('maps null to INTERNAL_ERROR', () => {
    expect(mapError(null)).toBe(ErrorCatalog.INTERNAL_ERROR);
  });

  it('maps undefined to INTERNAL_ERROR', () => {
    expect(mapError(undefined)).toBe(ErrorCatalog.INTERNAL_ERROR);
  });
});
