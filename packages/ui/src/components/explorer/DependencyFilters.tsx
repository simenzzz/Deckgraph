/**
 * Dependency-scoped filters: scope toggles, concern chips, and dependency search.
 * Rendered above the dependency table for a selected module, or standalone (above
 * the "select a module" prompt) while a dependency filter is active, so the filter
 * stays reachable even when it has emptied the results.
 */

import { useEffect, useMemo, useState } from 'react';
import type { DependencyScope } from '@deckgraph/shared';
import { useFilterStore, useViewStore } from '@/stores';
import { useHasDependencyFilters } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const SCOPES: readonly DependencyScope[] = ['runtime', 'dev', 'build', 'optional', 'peer'];
const CONCERN_TAGS_PER_PAGE = 8;

export function DependencyFilters() {
  const [concernPage, setConcernPage] = useState(0);
  const scopes = useFilterStore((s) => s.scopes);
  const search = useFilterStore((s) => s.search);
  const concern = useFilterStore((s) => s.concern);
  const toggleScope = useFilterStore((s) => s.toggleScope);
  const setSearch = useFilterStore((s) => s.setSearch);
  const setConcern = useFilterStore((s) => s.setConcern);
  const clearDependencyFilters = useFilterStore((s) => s.clearDependencyFilters);

  const hasDependencyFilters = useHasDependencyFilters();

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

  const concernPageCount = Math.max(1, Math.ceil(availableConcerns.length / CONCERN_TAGS_PER_PAGE));
  const visibleConcerns = availableConcerns.slice(
    concernPage * CONCERN_TAGS_PER_PAGE,
    (concernPage + 1) * CONCERN_TAGS_PER_PAGE,
  );
  const showConcernPagination = availableConcerns.length > CONCERN_TAGS_PER_PAGE;

  useEffect(() => {
    setConcernPage((page) => Math.min(page, concernPageCount - 1));
  }, [concernPageCount]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-2">
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

      {/* Search dependencies */}
      <div className="flex flex-1 items-center">
        <Input
          type="search"
          placeholder="Search dependencies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 min-w-[180px]"
          aria-label="Search dependencies"
        />
      </div>

      {/* Clear dependency filters */}
      {hasDependencyFilters && (
        <Button variant="ghost" size="sm" onClick={clearDependencyFilters} className="h-7">
          <X className="mr-1 h-3 w-3" /> Clear
        </Button>
      )}

      {/* Concern tag chips */}
      {availableConcerns.length > 0 && (
        <div className="flex min-w-0 basis-full flex-wrap items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground mr-1">Concern:</span>
          {visibleConcerns.map((tag) => (
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
          {showConcernPagination && (
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConcernPage((page) => Math.max(0, page - 1))}
                disabled={concernPage === 0}
                className="h-7 px-2"
                aria-label="Previous concern tags"
              >
                <ChevronLeft className="h-3 w-3" aria-hidden="true" />
              </Button>
              <span className="min-w-10 text-center text-xs text-muted-foreground">
                {concernPage + 1}/{concernPageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConcernPage((page) => Math.min(concernPageCount - 1, page + 1))}
                disabled={concernPage >= concernPageCount - 1}
                className="h-7 px-2"
                aria-label="Next concern tags"
              >
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
