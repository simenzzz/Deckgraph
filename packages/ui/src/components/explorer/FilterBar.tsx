/**
 * Filter bar with ecosystem toggles, scope toggles, concern chips,
 * cross-edge toggle, and search input.
 */

import { useMemo } from 'react';
import type { DependencyScope } from '@deckgraph/shared';
import { useFilterStore, useViewStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { X, Link2 } from 'lucide-react';
import { ALL_ECOSYSTEMS, ECOSYSTEM_CONFIG } from '@/lib/ecosystemConfig';

const SCOPES: readonly DependencyScope[] = ['runtime', 'dev', 'build', 'optional', 'peer'];

export function FilterBar() {
  const ecosystems = useFilterStore((s) => s.ecosystems);
  const scopes = useFilterStore((s) => s.scopes);
  const search = useFilterStore((s) => s.search);
  const showCrossEdges = useFilterStore((s) => s.showCrossEdges);
  const concern = useFilterStore((s) => s.concern);
  const toggleEcosystem = useFilterStore((s) => s.toggleEcosystem);
  const toggleScope = useFilterStore((s) => s.toggleScope);
  const setSearch = useFilterStore((s) => s.setSearch);
  const setShowCrossEdges = useFilterStore((s) => s.setShowCrossEdges);
  const setConcern = useFilterStore((s) => s.setConcern);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  const result = useViewStore((s) => s.result);

  // Derive available concern tags from current view result
  const availableConcerns = useMemo(() => {
    if (!result) return [];
    const tags = new Set<string>();
    for (const mod of result.modules) {
      for (const dep of mod.dependencies) {
        for (const c of dep.concerns) {
          tags.add(c);
        }
      }
    }
    return [...tags].sort();
  }, [result]);

  const hasActiveFilters =
    ecosystems.length > 0 ||
    scopes.length > 0 ||
    search.length > 0 ||
    concern !== null ||
    showCrossEdges;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      {/* Ecosystem toggles */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground mr-1">Ecosystem:</span>
        {ALL_ECOSYSTEMS.map((eco) => (
          <Button
            key={eco}
            variant={ecosystems.includes(eco) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleEcosystem(eco)}
            className="h-7 text-xs"
          >
            {ECOSYSTEM_CONFIG[eco].label}
          </Button>
        ))}
      </div>

      {/* Scope toggles */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground mr-1">Scope:</span>
        {SCOPES.map((scope) => (
          <Button
            key={scope}
            variant={scopes.includes(scope) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleScope(scope)}
            className={cn('h-7 text-xs capitalize')}
          >
            {scope}
          </Button>
        ))}
      </div>

      {/* Concern tag chips */}
      {availableConcerns.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground mr-1">Concern:</span>
          {availableConcerns.map((tag) => (
            <Button
              key={tag}
              variant={concern === tag ? 'default' : 'outline'}
              size="sm"
              onClick={() => setConcern(concern === tag ? null : tag)}
              className="h-7 text-xs"
            >
              {tag}
            </Button>
          ))}
        </div>
      )}

      {/* Cross-edge toggle */}
      <Button
        variant={showCrossEdges ? 'default' : 'outline'}
        size="sm"
        onClick={() => setShowCrossEdges(!showCrossEdges)}
        className="h-7 text-xs"
        aria-label="Toggle cross-language edges"
      >
        <Link2 className="mr-1 h-3 w-3" /> Cross-Edges
      </Button>

      {/* Search */}
      <div className="flex flex-1 items-center gap-2">
        <Input
          type="search"
          placeholder="Search dependencies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 min-w-[180px]"
          aria-label="Search dependencies"
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7">
            <X className="mr-1 h-3 w-3" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
