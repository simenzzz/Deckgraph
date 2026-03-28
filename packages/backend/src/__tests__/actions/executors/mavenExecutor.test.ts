import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';
import { createMavenExecutor } from '../../../actions/executors/mavenExecutor.js';
import type { ExecutorContext } from '../../../actions/types.js';

const mockedExeca = vi.mocked(execa);

const SAMPLE_POM = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <dependencies>
    <dependency>
      <groupId>org.example</groupId>
      <artifactId>core</artifactId>
      <version>1.0.0</version>
    </dependency>
    <dependency>
      <groupId>org.example</groupId>
      <artifactId>utils</artifactId>
      <version>2.0.0</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>`;

describe('mavenExecutor', () => {
  let tempDir: string;
  let ctx: ExecutorContext;
  const executor = createMavenExecutor();

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'deckgraph-maven-test-'));
    ctx = {
      projectRoot: tempDir,
      modulePath: '.',
      cwd: tempDir,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('update', () => {
    it('tries mvn versions plugin first', async () => {
      writeFileSync(path.join(tempDir, 'pom.xml'), SAMPLE_POM);
      mockedExeca.mockResolvedValue({} as never);

      const result = await executor.update(ctx, {
        packageName: 'org.example:core',
        targetVersion: '2.0.0',
        scope: 'runtime',
      });

      expect(result.status).toBe('success');
      expect(result.command).toContain('mvn');
      expect(mockedExeca).toHaveBeenCalledWith(
        'mvn',
        expect.arrayContaining(['versions:use-dep-version']),
        expect.objectContaining({ cwd: tempDir }),
      );
    });

    it('falls back to pom.xml edit when mvn fails', async () => {
      writeFileSync(path.join(tempDir, 'pom.xml'), SAMPLE_POM);
      mockedExeca.mockRejectedValue(new Error('mvn not found'));

      const result = await executor.update(ctx, {
        packageName: 'org.example:core',
        targetVersion: '3.0.0',
        scope: 'runtime',
      });

      expect(result.status).toBe('success');
      const updatedPom = readFileSync(path.join(tempDir, 'pom.xml'), 'utf-8');
      expect(updatedPom).toContain('<version>3.0.0</version>');
      expect(updatedPom).not.toContain('<version>1.0.0</version>');
    });

    it('escapes XML special characters in version during update', async () => {
      writeFileSync(path.join(tempDir, 'pom.xml'), SAMPLE_POM);
      mockedExeca.mockRejectedValue(new Error('mvn not found'));

      const result = await executor.update(ctx, {
        packageName: 'org.example:core',
        targetVersion: '1.0.0</version><evil attr="x">',
        scope: 'runtime',
      });

      expect(result.status).toBe('success');
      const updatedPom = readFileSync(path.join(tempDir, 'pom.xml'), 'utf-8');
      // The XML injection attempt should be escaped
      expect(updatedPom).toContain('&lt;/version&gt;');
      expect(updatedPom).toContain('&lt;evil');
      expect(updatedPom).not.toContain('<evil');
    });

    it('returns failure when dependency not found in pom.xml', async () => {
      writeFileSync(path.join(tempDir, 'pom.xml'), SAMPLE_POM);
      mockedExeca.mockRejectedValue(new Error('mvn not found'));

      const result = await executor.update(ctx, {
        packageName: 'org.nonexistent:pkg',
        targetVersion: '1.0.0',
        scope: 'runtime',
      });

      expect(result.status).toBe('failure');
      expect(result.error).toContain('not found in pom.xml');
    });

    it('returns failure when pom.xml missing', async () => {
      mockedExeca.mockRejectedValue(new Error('mvn not found'));

      const result = await executor.update(ctx, {
        packageName: 'org.example:core',
        targetVersion: '2.0.0',
        scope: 'runtime',
      });

      expect(result.status).toBe('failure');
      expect(result.error).toContain('pom.xml not found');
    });
  });

  describe('install', () => {
    it('adds dependency to pom.xml', async () => {
      writeFileSync(path.join(tempDir, 'pom.xml'), SAMPLE_POM);

      const result = await executor.install(ctx, {
        packageName: 'org.new:library',
        version: '1.0.0',
        scope: 'runtime',
      });

      expect(result.status).toBe('success');
      const updatedPom = readFileSync(path.join(tempDir, 'pom.xml'), 'utf-8');
      expect(updatedPom).toContain('<groupId>org.new</groupId>');
      expect(updatedPom).toContain('<artifactId>library</artifactId>');
      expect(updatedPom).toContain('<version>1.0.0</version>');
    });

    it('escapes XML special characters in install', async () => {
      writeFileSync(path.join(tempDir, 'pom.xml'), SAMPLE_POM);

      const result = await executor.install(ctx, {
        packageName: 'org.<script>:alert&1',
        version: '<img onerror="x">',
        scope: 'runtime',
      });

      expect(result.status).toBe('success');
      const updatedPom = readFileSync(path.join(tempDir, 'pom.xml'), 'utf-8');
      // Verify all injected values are escaped
      expect(updatedPom).toContain('&lt;script&gt;');
      expect(updatedPom).toContain('alert&amp;1');
      expect(updatedPom).toContain('&lt;img onerror=&quot;x&quot;&gt;');
      // Verify no raw injection
      expect(updatedPom).not.toContain('<script>');
      expect(updatedPom).not.toContain('<img');
    });

    it('adds test scope for dev dependencies', async () => {
      writeFileSync(path.join(tempDir, 'pom.xml'), SAMPLE_POM);

      const result = await executor.install(ctx, {
        packageName: 'org.test:lib',
        version: '1.0.0',
        scope: 'dev',
      });

      expect(result.status).toBe('success');
      const updatedPom = readFileSync(path.join(tempDir, 'pom.xml'), 'utf-8');
      expect(updatedPom).toContain('<scope>test</scope>');
    });

    it('returns failure when pom.xml missing', async () => {
      const result = await executor.install(ctx, {
        packageName: 'org.new:library',
        version: '1.0.0',
        scope: 'runtime',
      });

      expect(result.status).toBe('failure');
      expect(result.error).toContain('pom.xml not found');
    });
  });

  describe('remove', () => {
    it('removes dependency from pom.xml', async () => {
      writeFileSync(path.join(tempDir, 'pom.xml'), SAMPLE_POM);

      const result = await executor.remove(ctx, {
        packageName: 'org.example:core',
      });

      expect(result.status).toBe('success');
      const updatedPom = readFileSync(path.join(tempDir, 'pom.xml'), 'utf-8');
      expect(updatedPom).not.toContain('<artifactId>core</artifactId>');
      // Other dependency should remain
      expect(updatedPom).toContain('<artifactId>utils</artifactId>');
    });

    it('returns failure for dependency not in pom.xml', async () => {
      writeFileSync(path.join(tempDir, 'pom.xml'), SAMPLE_POM);

      const result = await executor.remove(ctx, {
        packageName: 'org.nonexistent:pkg',
      });

      expect(result.status).toBe('failure');
      expect(result.error).toContain('not found in pom.xml');
    });

    it('handles pom.xml with complex dependency blocks without ReDoS', async () => {
      // Generate a pom with many nested elements to stress-test the regex
      const complexDep = `    <dependency>
      <groupId>org.example</groupId>
      <artifactId>complex</artifactId>
      <version>1.0.0</version>
      <scope>compile</scope>
      <optional>true</optional>
      <exclusions>
        <exclusion>
          <groupId>org.unwanted</groupId>
          <artifactId>lib</artifactId>
        </exclusion>
      </exclusions>
    </dependency>`;

      const bigPom = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <dependencies>
${complexDep}
  </dependencies>
</project>`;

      writeFileSync(path.join(tempDir, 'pom.xml'), bigPom);

      const start = Date.now();
      const result = await executor.remove(ctx, {
        packageName: 'org.example:complex',
      });
      const elapsed = Date.now() - start;

      expect(result.status).toBe('success');
      // Should complete in well under a second — ReDoS would cause multi-second hangs
      expect(elapsed).toBeLessThan(1000);
      const updatedPom = readFileSync(path.join(tempDir, 'pom.xml'), 'utf-8');
      expect(updatedPom).not.toContain('org.example');
    });

    it('returns failure when pom.xml missing', async () => {
      const result = await executor.remove(ctx, {
        packageName: 'org.example:core',
      });

      expect(result.status).toBe('failure');
      expect(result.error).toContain('pom.xml not found');
    });
  });
});
