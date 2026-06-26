import { defineConfig } from 'tsup';

/**
 * Build config for the published `deckgraph` CLI.
 *
 * The backend ships as a single, self-contained npm package. `@deckgraph/shared`
 * is a pnpm workspace package that is never published, so it must be bundled
 * inline (`noExternal`). All real npm dependencies stay external — they are
 * installed from the registry via the package's `dependencies`.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  // Keep the CLI lean: no type declarations, source maps for debuggability.
  dts: false,
  sourcemap: true,
  // Inline the unpublished workspace package; everything else resolves from
  // node_modules at runtime.
  noExternal: [/^@deckgraph\/shared/],
  // tsup preserves the entry's `#!/usr/bin/env node` shebang and marks the
  // output executable automatically.
});
