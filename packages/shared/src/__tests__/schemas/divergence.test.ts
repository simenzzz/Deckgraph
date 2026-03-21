/**
 * Tests that validate schema fields stay in sync with enum values.
 *
 * These tests catch divergence when a new value is added to an enum
 * (e.g., a new Ecosystem) but not reflected in dependent schemas.
 */

import { describe, it, expect } from 'vitest';
import { ecosystemSchema, dependencyScopeSchema } from '../../schemas/project.js';
import { viewSummarySchema } from '../../schemas/views.js';

describe('byEcosystem divergence protection', () => {
  it('viewSummarySchema.byEcosystem has a key for every Ecosystem value', () => {
    const ecosystemValues = ecosystemSchema.options;
    const byEcosystemShape = viewSummarySchema.shape.byEcosystem.shape;
    const byEcosystemKeys = Object.keys(byEcosystemShape);

    expect(byEcosystemKeys.sort()).toEqual([...ecosystemValues].sort());
  });
});

describe('byScope divergence protection', () => {
  it('viewSummarySchema.byScope has a key for every DependencyScope value', () => {
    const scopeValues = dependencyScopeSchema.options;
    const byScopeShape = viewSummarySchema.shape.byScope.shape;
    const byScopeKeys = Object.keys(byScopeShape);

    expect(byScopeKeys.sort()).toEqual([...scopeValues].sort());
  });
});
