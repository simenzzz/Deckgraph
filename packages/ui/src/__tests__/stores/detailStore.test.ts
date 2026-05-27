import { describe, it, expect, beforeEach } from 'vitest';
import { useDetailStore } from '@/stores/detailStore';

describe('detailStore', () => {
  beforeEach(() => {
    useDetailStore.setState({
      selectedDep: null,
      isEnriching: false,
      enrichmentRequestId: null,
    });
  });

  it('starts with no selected dep', () => {
    const state = useDetailStore.getState();
    expect(state.selectedDep).toBeNull();
    expect(state.isEnriching).toBe(false);
    expect(state.enrichmentRequestId).toBeNull();
  });

  it('selectDep sets selected dep and resets enriching', () => {
    useDetailStore.getState().setEnriching(true);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    const state = useDetailStore.getState();
    expect(state.selectedDep).toEqual({ name: 'react', ecosystem: 'npm' });
    expect(state.isEnriching).toBe(false);
    expect(state.enrichmentRequestId).toBeNull();
  });

  it('closeDep clears selection and enriching', () => {
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });
    useDetailStore.getState().setEnriching(true);
    useDetailStore.getState().closeDep();

    const state = useDetailStore.getState();
    expect(state.selectedDep).toBeNull();
    expect(state.isEnriching).toBe(false);
    expect(state.enrichmentRequestId).toBeNull();
  });

  it('setEnriching updates enriching state', () => {
    useDetailStore.getState().setEnriching(true);
    expect(useDetailStore.getState().isEnriching).toBe(true);

    useDetailStore.getState().setEnriching(false);
    expect(useDetailStore.getState().isEnriching).toBe(false);
    expect(useDetailStore.getState().enrichmentRequestId).toBeNull();
  });

  it('completes only the matching enrichment request', () => {
    useDetailStore.getState().startEnriching('req-1');
    useDetailStore.getState().completeEnriching('req-2');
    expect(useDetailStore.getState().isEnriching).toBe(true);

    useDetailStore.getState().completeEnriching('req-1');
    expect(useDetailStore.getState().isEnriching).toBe(false);
    expect(useDetailStore.getState().enrichmentRequestId).toBeNull();
  });
});
