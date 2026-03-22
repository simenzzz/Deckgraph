/**
 * Tests for Java adapter.
 */

import { describe, it, expect } from 'vitest';
import { createJavaAdapter } from '../../../adapters/java/index.js';

describe('createJavaAdapter', () => {
  it('returns adapter for maven ecosystem', () => {
    const adapter = createJavaAdapter();
    expect(adapter.ecosystem).toBe('maven');
  });

  it('declares pom.xml and build.gradle as manifest files', () => {
    const adapter = createJavaAdapter();
    expect(adapter.manifestFiles).toContain('pom.xml');
    expect(adapter.manifestFiles).toContain('build.gradle');
    expect(adapter.manifestFiles).toContain('build.gradle.kts');
  });

  it('declares Java and Kotlin source extensions', () => {
    const adapter = createJavaAdapter();
    expect(adapter.sourceExtensions).toContain('.java');
    expect(adapter.sourceExtensions).toContain('.kt');
    expect(adapter.sourceExtensions).toContain('.kts');
  });

  it('analyzes imports from Java source code', async () => {
    const adapter = createJavaAdapter();
    const result = await adapter.analyzeImports('Main.java', 'import com.google.gson.Gson;');
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('com.google.gson');
    expect(result[0]!.isThirdParty).toBe(true);
  });

  it('returns null for queryRegistry', async () => {
    const adapter = createJavaAdapter();
    const result = await adapter.queryRegistry('org.springframework:spring-core');
    expect(result).toBeNull();
  });

  it('creates a new adapter instance each call', () => {
    const a = createJavaAdapter();
    const b = createJavaAdapter();
    expect(a).not.toBe(b);
  });
});
