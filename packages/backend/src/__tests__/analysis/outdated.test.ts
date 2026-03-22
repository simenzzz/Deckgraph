/**
 * Tests for outdated dependency classification.
 */

import { describe, it, expect } from 'vitest';
import { classifyOutdated } from '../../analysis/outdated.js';

describe('classifyOutdated', () => {
  describe('up-to-date', () => {
    it('same version', () => {
      expect(classifyOutdated('1.0.0', '1.0.0')).toBe('up-to-date');
    });

    it('installed newer than latest', () => {
      expect(classifyOutdated('2.0.0', '1.0.0')).toBe('up-to-date');
    });

    it('prerelease of same version', () => {
      expect(classifyOutdated('1.0.0', '1.0.0')).toBe('up-to-date');
    });
  });

  describe('patch-behind', () => {
    it('one patch behind', () => {
      expect(classifyOutdated('1.0.0', '1.0.1')).toBe('patch-behind');
    });

    it('multiple patches behind', () => {
      expect(classifyOutdated('1.0.0', '1.0.5')).toBe('patch-behind');
    });
  });

  describe('minor-behind', () => {
    it('one minor behind', () => {
      expect(classifyOutdated('1.0.0', '1.1.0')).toBe('minor-behind');
    });

    it('minor behind with patch difference', () => {
      expect(classifyOutdated('1.0.3', '1.2.0')).toBe('minor-behind');
    });
  });

  describe('major-behind', () => {
    it('one major behind', () => {
      expect(classifyOutdated('1.0.0', '2.0.0')).toBe('major-behind');
    });

    it('multiple majors behind', () => {
      expect(classifyOutdated('1.0.0', '5.0.0')).toBe('major-behind');
    });

    it('major behind regardless of minor/patch', () => {
      expect(classifyOutdated('1.9.9', '2.0.0')).toBe('major-behind');
    });
  });

  describe('non-semver versions', () => {
    it('Go v-prefix versions', () => {
      expect(classifyOutdated('v1.0.0', 'v1.1.0')).toBe('minor-behind');
    });

    it('coerces PEP 440 versions', () => {
      expect(classifyOutdated('3.9', '3.12')).toBe('minor-behind');
    });

    it('unparseable returns up-to-date', () => {
      expect(classifyOutdated('not-a-version', 'also-not')).toBe('up-to-date');
    });

    it('one side unparseable returns up-to-date', () => {
      expect(classifyOutdated('1.0.0', 'not-a-version')).toBe('up-to-date');
    });
  });
});
