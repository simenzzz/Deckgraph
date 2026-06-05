/**
 * Global filter bar: ecosystem toggles and module search.
 *
 * Module-scoped filters (scope, concern, search dependencies) live in
 * DependencyFilters, above the dependency listings for the selected module.
 */

import { useFilterStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { ALL_ECOSYSTEMS, ECOSYSTEM_CONFIG } from '@/lib/ecosystemConfig';

export function FilterBar() {
  const ecosystems = useFilterStore((s) => s.ecosystems);
  const moduleSearch = useFilterStore((s) => s.moduleSearch);
  const toggleEcosystem = useFilterStore((s) => s.toggleEcosystem);
  const setModuleSearch = useFilterStore((s) => s.setModuleSearch);
  const clearModuleFilters = useFilterStore((s) => s.clearModuleFilters);

  const hasModuleFilters = ecosystems.length > 0 || moduleSearch.length > 0;

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

      {/* Module search */}
      <Input
        type="search"
        placeholder="Search modules..."
        value={moduleSearch}
        onChange={(e) => setModuleSearch(e.target.value)}
        className="h-8 w-72"
        aria-label="Search modules"
      />
      {hasModuleFilters && (
        <Button variant="ghost" size="sm" onClick={clearModuleFilters} className="h-7">
          <X className="mr-1 h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}
