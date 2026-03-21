/**
 * Tests for Java manifest parser.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseJavaManifests } from '../../../adapters/java/manifestParser.js';

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, readFile: vi.fn() };
});

import { readFile } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFiles(files: Record<string, string | null>): void {
  mockReadFile.mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
    const pathStr = typeof path === 'string' ? path : path.toString();
    for (const [filePath, content] of Object.entries(files)) {
      if (pathStr.endsWith(filePath) || pathStr === filePath) {
        if (content === null) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return content;
      }
    }
    throw Object.assign(new Error(`ENOENT: ${pathStr}`), { code: 'ENOENT' });
  });
}

const MINIMAL_POM = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <artifactId>my-app</artifactId>
  <groupId>com.example</groupId>
</project>`;

function pomWithDeps(deps: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <artifactId>my-app</artifactId>
  <groupId>com.example</groupId>
  <dependencies>
${deps}
  </dependencies>
</project>`;
}

describe('parseJavaManifests', () => {
  describe('pom.xml parsing', () => {
    it('parses a minimal pom.xml', async () => {
      mockFiles({ 'pom.xml': MINIMAL_POM });

      const result = await parseJavaManifests('/project', '.');

      expect(result.moduleName).toBe('my-app');
      expect(result.dependencies).toHaveLength(0);
      expect(result.hasLockFile).toBe(false);
    });

    it('extracts basic dependencies', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>6.1.0</version>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
      const dep = result.dependencies[0]!;
      expect(dep.name).toBe('org.springframework:spring-core');
      expect(dep.constraint).toBe('6.1.0');
      expect(dep.scope).toBe('runtime');
    });

    it('maps compile scope to runtime', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>com.google.guava</groupId>
      <artifactId>guava</artifactId>
      <version>33.0</version>
      <scope>compile</scope>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.scope).toBe('runtime');
    });

    it('maps test scope to dev', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.scope).toBe('dev');
    });

    it('maps provided scope to build', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>javax.servlet</groupId>
      <artifactId>servlet-api</artifactId>
      <version>3.1.0</version>
      <scope>provided</scope>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.scope).toBe('build');
    });

    it('maps runtime scope to runtime', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>mysql</groupId>
      <artifactId>mysql-connector-java</artifactId>
      <version>8.0.33</version>
      <scope>runtime</scope>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.scope).toBe('runtime');
    });

    it('maps absent scope to runtime', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>lib</artifactId>
      <version>1.0</version>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.scope).toBe('runtime');
    });

    it('maps optional to optional scope', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>opt-lib</artifactId>
      <version>1.0</version>
      <optional>true</optional>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.scope).toBe('optional');
    });

    it('uses "managed" for missing version', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>managed-lib</artifactId>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.constraint).toBe('managed');
    });

    it('interpolates properties in version', async () => {
      mockFiles({
        'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <artifactId>my-app</artifactId>
  <properties>
    <spring.version>6.1.0</spring.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>\${spring.version}</version>
    </dependency>
  </dependencies>
</project>`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.constraint).toBe('6.1.0');
    });

    it('handles single dependency (not array)', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>single</artifactId>
      <version>1.0</version>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies).toHaveLength(1);
    });
  });

  describe('build.gradle parsing', () => {
    it('extracts implementation dependencies', async () => {
      mockFiles({
        'build.gradle': [
          "rootProject.name = 'my-gradle-app'",
          "implementation 'org.springframework:spring-core:6.1.0'",
        ].join('\n'),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.moduleName).toBe('my-gradle-app');
      expect(result.dependencies).toHaveLength(1);
      const dep = result.dependencies[0]!;
      expect(dep.name).toBe('org.springframework:spring-core');
      expect(dep.constraint).toBe('6.1.0');
      expect(dep.scope).toBe('runtime');
    });

    it('extracts testImplementation as dev scope', async () => {
      mockFiles({
        'build.gradle': `testImplementation 'junit:junit:4.13.2'`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.scope).toBe('dev');
    });

    it('extracts compileOnly as build scope', async () => {
      mockFiles({
        'build.gradle': `compileOnly 'javax.servlet:servlet-api:3.1.0'`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.scope).toBe('build');
    });

    it('extracts runtimeOnly as runtime scope', async () => {
      mockFiles({
        'build.gradle': `runtimeOnly 'mysql:mysql-connector-java:8.0.33'`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.scope).toBe('runtime');
    });

    it('handles double quotes', async () => {
      mockFiles({
        'build.gradle': `implementation "com.google.guava:guava:33.0-jre"`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('com.google.guava:guava');
      expect(result.dependencies[0]!.constraint).toBe('33.0-jre');
    });

    it('handles group:artifact without version', async () => {
      mockFiles({
        'build.gradle': `implementation 'com.example:lib'`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('com.example:lib');
      expect(result.dependencies[0]!.constraint).toBe('*');
    });

    it('handles build.gradle.kts variant', async () => {
      mockFiles({
        'build.gradle.kts': `implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.0")`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('org.jetbrains.kotlin:kotlin-stdlib');
      expect(result.dependencies[0]!.constraint).toBe('1.9.0');
    });

    it('returns empty deps when no patterns match', async () => {
      mockFiles({
        'build.gradle': '// empty build file\nplugins { }',
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies).toHaveLength(0);
    });
  });

  describe('manifest priority', () => {
    it('prefers pom.xml over build.gradle', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>from</groupId>
      <artifactId>maven</artifactId>
      <version>1.0</version>
    </dependency>`),
        'build.gradle': `implementation 'from:gradle:2.0'`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.dependencies[0]!.name).toBe('from:maven');
      expect(result.metadata['buildTool']).toBe('maven');
    });
  });

  describe('gradle.lockfile resolution', () => {
    it('resolves versions from gradle.lockfile', async () => {
      mockFiles({
        'build.gradle': `implementation 'com.google.guava:guava'`,
        'gradle.lockfile': [
          '# This is a Gradle generated file for dependency locking.',
          'com.google.guava:guava:33.0.0-jre=compileClasspath,runtimeClasspath',
        ].join('\n'),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      expect(result.dependencies[0]!.version).toBe('33.0.0-jre');
    });

    it('skips comments and empty marker', async () => {
      mockFiles({
        'build.gradle': `implementation 'com.example:lib:1.0'`,
        'gradle.lockfile': [
          '# Comment line',
          'empty=',
          'com.example:lib:2.0.0=compileClasspath',
        ].join('\n'),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.hasLockFile).toBe(true);
      expect(result.dependencies[0]!.version).toBe('2.0.0');
    });

    it('continues without lock file if not found', async () => {
      mockFiles({
        'build.gradle': `implementation 'com.example:lib:1.0'`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.hasLockFile).toBe(false);
      expect(result.dependencies[0]!.version).toBe('1.0');
    });
  });

  describe('metadata', () => {
    it('includes groupId, packaging, and buildTool for Maven', async () => {
      mockFiles({
        'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <artifactId>my-app</artifactId>
  <groupId>com.example</groupId>
  <packaging>jar</packaging>
</project>`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.metadata['groupId']).toBe('com.example');
      expect(result.metadata['packaging']).toBe('jar');
      expect(result.metadata['buildTool']).toBe('maven');
    });

    it('includes buildTool for Gradle', async () => {
      mockFiles({
        'build.gradle': `implementation 'com.example:lib:1.0'`,
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.metadata['buildTool']).toBe('gradle');
    });
  });

  describe('error handling', () => {
    it('throws when no manifest found', async () => {
      mockFiles({});

      await expect(parseJavaManifests('/project', '.')).rejects.toThrow('No Java manifest found');
    });

    it('throws when pom.xml has invalid XML', async () => {
      mockFiles({
        'pom.xml': 'not valid xml<<<',
      });

      await expect(parseJavaManifests('/project', '.')).rejects.toThrow();
    });
  });

  describe('output validation', () => {
    it('output passes shared schema validation', async () => {
      mockFiles({
        'pom.xml': pomWithDeps(`
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>6.1.0</version>
    </dependency>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>`),
      });

      const result = await parseJavaManifests('/project', '.');

      expect(result.moduleName).toBe('my-app');
      expect(result.dependencies).toHaveLength(2);
    });
  });
});
