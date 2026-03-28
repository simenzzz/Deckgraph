import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { backupManifests, restoreManifests } from '../../actions/manifestBackup.js';

describe('manifestBackup', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'deckgraph-backup-test-'));
  });

  afterEach(() => {
    // Cleanup handled by OS
  });

  it('backs up manifest files', () => {
    writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
    const backup = backupManifests(tempDir, ['package.json'], tempDir);
    expect(backup.files.size).toBe(1);
    expect(backup.files.get(path.join(tempDir, 'package.json'))).toBe('{"name": "test"}');
  });

  it('backs up lock files automatically', () => {
    writeFileSync(path.join(tempDir, 'package.json'), '{}');
    writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
    const backup = backupManifests(tempDir, ['package.json'], tempDir);
    expect(backup.files.size).toBe(2);
    expect(backup.files.has(path.join(tempDir, 'pnpm-lock.yaml'))).toBe(true);
  });

  it('backs up root-level lock files when module is in a subdirectory', () => {
    const modulePath = path.join(tempDir, 'packages', 'app');
    mkdirSync(modulePath, { recursive: true });
    writeFileSync(path.join(modulePath, 'package.json'), '{}');
    writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    const backup = backupManifests(modulePath, ['package.json'], tempDir);
    expect(backup.files.has(path.join(tempDir, 'pnpm-lock.yaml'))).toBe(true);
  });

  it('restores all backed-up files', () => {
    const pkgPath = path.join(tempDir, 'package.json');
    writeFileSync(pkgPath, '{"version": "1.0.0"}');

    const backup = backupManifests(tempDir, ['package.json'], tempDir);

    // Simulate a change
    writeFileSync(pkgPath, '{"version": "2.0.0"}');
    expect(readFileSync(pkgPath, 'utf-8')).toBe('{"version": "2.0.0"}');

    restoreManifests(backup);
    expect(readFileSync(pkgPath, 'utf-8')).toBe('{"version": "1.0.0"}');
  });

  it('handles missing manifest files gracefully', () => {
    const backup = backupManifests(tempDir, ['nonexistent.json'], tempDir);
    expect(backup.files.size).toBe(0);
  });
});
