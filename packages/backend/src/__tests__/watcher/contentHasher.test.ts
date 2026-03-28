import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  initHasher,
  computeHash,
  hashFile,
  diffHashes,
} from '../../watcher/contentHasher.js';

describe('contentHasher', () => {
  beforeAll(async () => {
    await initHasher();
  });

  describe('initHasher', () => {
    it('should be safe to call multiple times', async () => {
      await initHasher();
      await initHasher();
      // No error thrown
    });
  });

  describe('computeHash', () => {
    it('should return a string hash for buffer content', () => {
      const content = Buffer.from('hello world');
      const hash = computeHash(content);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should return identical hashes for identical content', () => {
      const content1 = Buffer.from('test content');
      const content2 = Buffer.from('test content');
      expect(computeHash(content1)).toBe(computeHash(content2));
    });

    it('should return different hashes for different content', () => {
      const content1 = Buffer.from('content A');
      const content2 = Buffer.from('content B');
      expect(computeHash(content1)).not.toBe(computeHash(content2));
    });

    it('should handle empty buffer', () => {
      const hash = computeHash(Buffer.alloc(0));
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('hashFile', () => {
    const testDir = join(tmpdir(), 'deckgraph-hasher-test');

    beforeAll(async () => {
      await mkdir(testDir, { recursive: true });
    });

    it('should hash a file and return a string', async () => {
      const filePath = join(testDir, 'test.txt');
      await writeFile(filePath, 'file content for hashing');
      const hash = await hashFile(filePath);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should return identical hashes for files with same content', async () => {
      const file1 = join(testDir, 'same1.txt');
      const file2 = join(testDir, 'same2.txt');
      await writeFile(file1, 'same content');
      await writeFile(file2, 'same content');
      expect(await hashFile(file1)).toBe(await hashFile(file2));
    });

    it('should return different hashes for files with different content', async () => {
      const file1 = join(testDir, 'diff1.txt');
      const file2 = join(testDir, 'diff2.txt');
      await writeFile(file1, 'content alpha');
      await writeFile(file2, 'content beta');
      expect(await hashFile(file1)).not.toBe(await hashFile(file2));
    });

    it('should throw for non-existent file', async () => {
      await expect(hashFile(join(testDir, 'nonexistent.txt'))).rejects.toThrow();
    });
  });

  describe('diffHashes', () => {
    it('should detect added files', () => {
      const previous = new Map<string, string>();
      const current = new Map([
        ['file1.ts', 'hash1'],
        ['file2.ts', 'hash2'],
      ]);
      const diff = diffHashes(previous, current);
      expect(diff.added).toEqual(['file1.ts', 'file2.ts']);
      expect(diff.updated).toEqual([]);
      expect(diff.removed).toEqual([]);
    });

    it('should detect removed files', () => {
      const previous = new Map([
        ['file1.ts', 'hash1'],
        ['file2.ts', 'hash2'],
      ]);
      const current = new Map<string, string>();
      const diff = diffHashes(previous, current);
      expect(diff.removed).toEqual(['file1.ts', 'file2.ts']);
      expect(diff.added).toEqual([]);
      expect(diff.updated).toEqual([]);
    });

    it('should detect updated files', () => {
      const previous = new Map([
        ['file1.ts', 'hash1'],
        ['file2.ts', 'hash2'],
      ]);
      const current = new Map([
        ['file1.ts', 'hash1-changed'],
        ['file2.ts', 'hash2'],
      ]);
      const diff = diffHashes(previous, current);
      expect(diff.updated).toEqual(['file1.ts']);
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
    });

    it('should detect mixed changes', () => {
      const previous = new Map([
        ['existing.ts', 'hash1'],
        ['changed.ts', 'hash2'],
        ['removed.ts', 'hash3'],
      ]);
      const current = new Map([
        ['existing.ts', 'hash1'],
        ['changed.ts', 'hash2-new'],
        ['added.ts', 'hash4'],
      ]);
      const diff = diffHashes(previous, current);
      expect(diff.updated).toEqual(['changed.ts']);
      expect(diff.added).toEqual(['added.ts']);
      expect(diff.removed).toEqual(['removed.ts']);
    });

    it('should handle identical maps', () => {
      const previous = new Map([['file.ts', 'hash1']]);
      const current = new Map([['file.ts', 'hash1']]);
      const diff = diffHashes(previous, current);
      expect(diff.updated).toEqual([]);
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
    });

    it('should handle empty maps', () => {
      const diff = diffHashes(new Map(), new Map());
      expect(diff.updated).toEqual([]);
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
    });

    it('should not mutate input maps', () => {
      const previous = new Map([['file.ts', 'hash1']]);
      const current = new Map([['file.ts', 'hash2']]);
      const prevSize = previous.size;
      const currSize = current.size;
      diffHashes(previous, current);
      expect(previous.size).toBe(prevSize);
      expect(current.size).toBe(currSize);
    });
  });
});
