import { describe, it, expect, vi } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';
import { runCommand } from '../../../actions/executors/runCommand.js';

describe('runCommand', () => {
  it('returns success when command exits cleanly', async () => {
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    const result = await runCommand('echo', ['hello'], '/tmp');

    expect(result).toEqual({ success: true, stderr: '' });
    expect(execa).toHaveBeenCalledWith('echo', ['hello'], {
      cwd: '/tmp',
      timeout: 60_000,
      shell: false,
    });
  });

  it('returns failure with stderr from execa error', async () => {
    vi.mocked(execa).mockRejectedValue({ stderr: 'package not found' });

    const result = await runCommand('npm', ['install', 'bad-pkg'], '/tmp');

    expect(result).toEqual({ success: false, stderr: 'package not found' });
  });

  it('returns failure with stringified error when no stderr field', async () => {
    vi.mocked(execa).mockRejectedValue(new Error('command not found'));

    const result = await runCommand('nonexistent', [], '/tmp');

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('command not found');
  });

  it('passes custom timeout', async () => {
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    await runCommand('mvn', ['install'], '/tmp', 120_000);

    expect(execa).toHaveBeenCalledWith('mvn', ['install'], {
      cwd: '/tmp',
      timeout: 120_000,
      shell: false,
    });
  });

  it('never uses shell: true', async () => {
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    await runCommand('echo', ['$(whoami)'], '/tmp');

    const callArgs = vi.mocked(execa).mock.calls[0]![2];
    expect(callArgs).toHaveProperty('shell', false);
  });
});
