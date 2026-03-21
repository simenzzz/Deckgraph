/**
 * Tests for the concern tag database.
 */

import { describe, it, expect } from 'vitest';
import { CONCERN_TAG_DB } from '../../concern/tags/index.js';
import { npmTags } from '../../concern/tags/npmTags.js';
import { pypiTags } from '../../concern/tags/pypiTags.js';
import { cargoTags } from '../../concern/tags/cargoTags.js';
import { goTags } from '../../concern/tags/goTags.js';
import { mavenTags } from '../../concern/tags/mavenTags.js';

describe('concern tag database', () => {
  it('contains entries from all 5 ecosystems', () => {
    expect(CONCERN_TAG_DB.has('npm:express')).toBe(true);
    expect(CONCERN_TAG_DB.has('pypi:django')).toBe(true);
    expect(CONCERN_TAG_DB.has('cargo:tokio')).toBe(true);
    expect(CONCERN_TAG_DB.has('go:github.com/gin-gonic/gin')).toBe(true);
    expect(CONCERN_TAG_DB.has('maven:org.springframework.boot:spring-boot-starter-web')).toBe(true);
  });

  it('all entries have non-empty tag arrays', () => {
    for (const [key, tags] of CONCERN_TAG_DB) {
      expect(tags.length, `${key} should have at least one tag`).toBeGreaterThan(0);
    }
  });

  it('no duplicate keys exist across ecosystem maps', () => {
    // The combined map should have the same count as all per-ecosystem maps
    const total = npmTags.size + pypiTags.size + cargoTags.size + goTags.size + mavenTags.size;
    expect(CONCERN_TAG_DB.size).toBe(total);
  });

  it('well-known packages have expected tags', () => {
    expect(CONCERN_TAG_DB.get('npm:express')).toContain('http');
    expect(CONCERN_TAG_DB.get('npm:express')).toContain('server');
    expect(CONCERN_TAG_DB.get('pypi:django')).toContain('http');
    expect(CONCERN_TAG_DB.get('cargo:tokio')).toContain('concurrency');
    expect(CONCERN_TAG_DB.get('go:github.com/gin-gonic/gin')).toContain('http');
    expect(CONCERN_TAG_DB.get('npm:vitest')).toContain('testing');
    expect(CONCERN_TAG_DB.get('pypi:sqlalchemy')).toContain('database');
  });

  it('tag values contain only non-empty strings', () => {
    for (const [key, tags] of CONCERN_TAG_DB) {
      for (const tag of tags) {
        expect(tag.length, `tag in ${key} should be non-empty`).toBeGreaterThan(0);
        expect(typeof tag).toBe('string');
      }
    }
  });

  it('per-ecosystem maps are all non-empty', () => {
    expect(npmTags.size).toBeGreaterThan(50);
    expect(pypiTags.size).toBeGreaterThan(50);
    expect(cargoTags.size).toBeGreaterThan(30);
    expect(goTags.size).toBeGreaterThan(30);
    expect(mavenTags.size).toBeGreaterThan(30);
  });
});
