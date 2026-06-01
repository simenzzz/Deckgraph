import type { Dependency, Module, ProjectConfig } from '@deckgraph/shared';
import { CONCERN_TAG_DB } from './tags/index.js';

/**
 * Tag all dependencies in the given modules with concern tags.
 * Returns new Module objects (immutable — originals are not modified).
 *
 * Lookup order:
 * 1. Built-in tag database (keyed by `${ecosystem}:${name}`)
 * 2. User overrides from config (keyed by package name, applied globally)
 *
 * User overrides merge with (not replace) built-in tags. Duplicates are removed.
 */
export function tagDependencies(
  modules: readonly Module[],
  config: ProjectConfig | null,
): readonly Module[] {
  const overrides = config?.concernOverrides ?? {};

  return modules.map((mod) => ({
    ...mod,
    dependencies: mod.dependencies.map((dep) => tagDependency(dep, overrides)),
  }));
}

function tagDependency(
  dep: Dependency,
  overrides: Readonly<Record<string, readonly string[]>>,
): Dependency {
  const builtinKey = `${dep.ecosystem}:${dep.name}`;
  const builtinTags = CONCERN_TAG_DB.get(builtinKey) ?? [];
  const userTags = overrides[dep.name] ?? [];

  if (builtinTags.length === 0 && userTags.length === 0) {
    return dep;
  }

  const merged = [...new Set([...builtinTags, ...userTags])];

  return { ...dep, concerns: merged };
}
