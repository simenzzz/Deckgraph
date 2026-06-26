#!/usr/bin/env node
/**
 * Copy the built UI assets into the backend's dist directory so they ship
 * inside the published `deckgraph` package.
 *
 * The `@deckgraph/ui` package is private and never published; its build output
 * (`packages/ui/dist`) is copied to `packages/backend/dist/ui`, which the CLI
 * serves at runtime (see src/index.ts `uiDistPath`).
 *
 * Source maps are intentionally excluded — they are multi-megabyte dead weight
 * for an end-user CLI.
 */
import { cp, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const uiDist = resolve(__dirname, '../../ui/dist');
const indexHtml = resolve(uiDist, 'index.html');
const target = resolve(__dirname, '../dist/ui');

async function assertUiBuilt() {
  try {
    await stat(indexHtml);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      process.stderr.write(
        `Error: UI build output not found at ${uiDist}.\n` +
          `Run the full build first (pnpm build), which builds the UI before this step.\n`,
      );
      process.exit(1);
    }
    // A non-ENOENT failure (permissions, etc.) is a real error — surface it.
    const detail = error instanceof Error ? error.message : 'unknown error';
    process.stderr.write(`Error: cannot read UI build output at ${uiDist}: ${detail}\n`);
    process.exit(1);
  }
}

async function main() {
  await assertUiBuilt();

  // Start from a clean target so stale hashed assets never linger.
  await rm(target, { recursive: true, force: true });

  await cp(uiDist, target, {
    recursive: true,
    filter: (src) => !src.endsWith('.map'),
  });

  process.stdout.write(`Copied UI assets -> ${target} (source maps excluded)\n`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`Error copying UI assets: ${detail}\n`);
  process.exit(1);
});
