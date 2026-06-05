import { beforeEach, describe, expect, it } from 'vitest';
import { useHealthPrereqStore } from '@/stores/healthPrereqStore';
import type { HealthPrereqTarget } from '@/lib/healthPrerequisites';

const targets: HealthPrereqTarget[] = [
  {
    kind: 'registry',
    targetId: 'npm:react',
    label: 'react',
    ecosystem: 'npm',
    packageName: 'react',
    modulePath: 'pkg/a',
  },
  {
    kind: 'registry',
    targetId: 'npm:lodash',
    label: 'lodash',
    ecosystem: 'npm',
    packageName: 'lodash',
    modulePath: 'pkg/a',
  },
];

describe('healthPrereqStore', () => {
  beforeEach(() => {
    useHealthPrereqStore.getState().reset();
  });

  it('tracks a batch through sent and complete states', () => {
    useHealthPrereqStore.getState().startBatch('registry', targets);
    expect(useHealthPrereqStore.getState().isRunning).toBe(true);
    expect(useHealthPrereqStore.getState().total).toBe(2);

    useHealthPrereqStore.getState().markSent('r1', targets[0]!);
    expect(useHealthPrereqStore.getState().active?.requestId).toBe('r1');
    expect(useHealthPrereqStore.getState().queue).toHaveLength(1);

    useHealthPrereqStore.getState().completeRequest('r1');
    expect(useHealthPrereqStore.getState().completed).toBe(1);
    expect(useHealthPrereqStore.getState().isRunning).toBe(true);

    useHealthPrereqStore.getState().markSent('r2', targets[1]!);
    useHealthPrereqStore.getState().completeRequest('r2');
    expect(useHealthPrereqStore.getState().completed).toBe(2);
    expect(useHealthPrereqStore.getState().isRunning).toBe(false);
  });

  it('records matching request failures and ignores unrelated completions', () => {
    useHealthPrereqStore.getState().startBatch('registry', [targets[0]!]);
    useHealthPrereqStore.getState().markSent('r1', targets[0]!);
    useHealthPrereqStore.getState().completeRequest('other');
    expect(useHealthPrereqStore.getState().active?.requestId).toBe('r1');

    useHealthPrereqStore.getState().failRequest('r1', 'Package not found');
    expect(useHealthPrereqStore.getState().failures).toEqual([
      { targetId: 'npm:react', label: 'react', message: 'Package not found' },
    ]);
    expect(useHealthPrereqStore.getState().isRunning).toBe(false);
  });
});
