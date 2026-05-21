/**
 * Hook command runner.
 *
 * Executes shell commands configured for developer hooks with proper
 * security validation and timeout handling.
 */

import { execa } from 'execa';
import type { HookEntry } from '@deckgraph/shared';
import type { HookContext } from './types.js';
import { createLogger } from '../logger.js';

const logger = createLogger('hookRunner');

const HOOK_TIMEOUT_MS = 30_000;
const MAX_STDOUT_BYTES = 4096;
const MAX_STDERR_BYTES = 4096;

/** Env var keys safe to pass to hook subprocesses. */
const SAFE_ENV_KEYS = [
  'PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TERM', 'NODE_ENV', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME',
];

/**
 * Build a filtered copy of process.env with only safe keys.
 * Prevents leaking sensitive tokens (NPM_TOKEN, GITHUB_TOKEN, etc.)
 * to hook subprocesses.
 */
function safeProcessEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key]) {
      env[key] = process.env[key]!;
    }
  }
  return env;
}

/**
 * Shell metacharacters that are NOT allowed in hook commands.
 * Prevents command injection via shell operators.
 */
const FORBIDDEN_CHARS = [';', '&', '|', '`', '$(', '\n', '\r', '>', '<'];

/**
 * Result of executing a hook command.
 */
export interface HookResult {
  /** Whether the command succeeded (exit code 0) */
  readonly success: boolean;
  /** Truncated stdout (max 4KB) */
  readonly stdout: string;
  /** Truncated stderr (max 4KB) */
  readonly stderr: string;
  /** Exit code from the process */
  readonly exitCode: number | null;
  /** Duration in milliseconds */
  readonly durationMs: number;
}

/**
 * Validate that a hook command string is safe to execute.
 *
 * Rejects commands containing shell metacharacters that could enable
 * command injection. Commands must be simple executable paths with args.
 *
 * @throws Error if command contains forbidden characters
 */
export function validateHookCommand(cmd: string): void {
  for (const char of FORBIDDEN_CHARS) {
    if (cmd.includes(char)) {
      throw new Error(
        `Hook command contains forbidden character: "${char}". ` +
          `Commands must not include shell operators like ;, &, |, backticks, or $().`,
      );
    }
  }

  // Additional check: command must not be empty
  if (cmd.trim().length === 0) {
    throw new Error('Hook command cannot be empty');
  }

  // Command must start with an alphanumeric character or ./ or /
  const firstChar = cmd.trim()[0];
  if (
    !/[a-zA-Z0-9./]/.test(firstChar)
  ) {
    throw new Error(
      'Hook command must start with a letter, number, dot, or forward slash',
    );
  }
}

/**
 * Split a command string into argv array.
 *
 * Respects quotes (both single and double) to handle arguments with spaces.
 * This is a simple implementation - not a full shell parser.
 *
 * Examples:
 *   "echo hello" → ["echo", "hello"]
 *   "echo 'hello world'" → ["echo", "hello world"]
 */
export function splitCommand(cmd: string): string[] {
  const args: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i]!;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && inDoubleQuote) {
      // In double quotes, backslash escapes the next character
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (inSingleQuote || inDoubleQuote) {
    throw new Error('Hook command has unterminated quotes');
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args.length > 0 ? args : [cmd];
}

/**
 * Run a single hook command.
 *
 * - Uses execa with shell: false to prevent shell injection
 * - 30 second timeout
 * - Captures stdout/stderr (truncated to 4KB each)
 * - Passes DECKGRAPH_* environment variables
 *
 * @throws Error if validation fails or timeout occurs
 */
export async function runHook(
  entry: HookEntry,
  context: HookContext,
): Promise<HookResult> {
  validateHookCommand(entry.cmd);

  const startTime = Date.now();
  const argv = splitCommand(entry.cmd);

  // Build environment variables
  const env: Record<string, string> = {
    DECKGRAPH_EVENT: context.event,
    DECKGRAPH_PROJECT_ROOT: context.projectRoot,
    DECKGRAPH_EVENT_TYPE: context.data.type,
  };

  // Add event-specific env vars
  switch (context.data.type) {
    case 'scan-complete':
      env.DECKGRAPH_MODULE_COUNT = String(context.data.moduleCount);
      env.DECKGRAPH_DEP_COUNT = String(context.data.depCount);
      break;
    case 'outdated':
    case 'unused':
    case 'license-violation':
      env.DECKGRAPH_COUNT = String(context.data.count);
      env.DECKGRAPH_PACKAGES = context.data.packages.join(',');
      break;
  }

  logger.debug(
    { cmd: entry.cmd, argv, deckgraphEnv: env },
    'Executing hook command',
  );

  const result = await execa(argv[0]!, argv.slice(1), {
    shell: false,
    cwd: context.projectRoot,
    timeout: HOOK_TIMEOUT_MS,
    env: { ...safeProcessEnv(), ...env },
    reject: false, // Don't throw on non-zero exit
  });

  const duration = Date.now() - startTime;

  // Check for timeout (execa sets timedOut when reject: false)
  if (result.timedOut) {
    logger.warn({ cmd: entry.cmd, duration }, 'Hook command timed out');
    return {
      success: false,
      stdout: truncateOutput(result.stdout ?? '', MAX_STDOUT_BYTES),
      stderr: `Command timed out after ${HOOK_TIMEOUT_MS}ms`,
      exitCode: null,
      durationMs: duration,
    };
  }

  const stdout = truncateOutput(result.stdout ?? '', MAX_STDOUT_BYTES);
  const stderr = truncateOutput(result.stderr ?? '', MAX_STDERR_BYTES);

  logger.info(
    { cmd: entry.cmd, exitCode: result.exitCode, duration },
    'Hook command completed',
  );
  logger.debug({ stdout, stderr }, 'Hook command output');

  return {
    success: result.exitCode === 0,
    stdout,
    stderr,
    exitCode: result.exitCode ?? null,
    durationMs: duration,
  };
}

/**
 * Truncate output to max characters, appending ellipsis if truncated.
 */
function truncateOutput(output: string, maxChars: number): string {
  if (output.length <= maxChars) {
    return output;
  }

  return output.slice(0, maxChars - 3) + '...';
}
