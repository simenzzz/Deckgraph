/**
 * Navigation sidebar with view switching.
 */

import { useViewStore, type CurrentView } from '@/stores';
import { cn } from '@/lib/utils';
import { LayoutDashboard, List, HeartPulse } from 'lucide-react';

interface NavItem {
  readonly id: CurrentView;
  readonly label: string;
  readonly icon: typeof LayoutDashboard;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'explorer', label: 'Module Explorer', icon: List },
  { id: 'health', label: 'Health Report', icon: HeartPulse },
];

export function Sidebar() {
  const currentView = useViewStore((s) => s.currentView);
  const setView = useViewStore((s) => s.setView);

  return (
    <aside className="flex w-52 flex-col border-r bg-muted/30">
      <nav className="flex flex-col gap-1 p-2" role="tablist" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            role="tab"
            aria-selected={currentView === item.id}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              currentView === item.id
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
            )}
            data-testid={`nav-${item.id}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
