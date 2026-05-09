import { Search, Settings } from 'lucide-react';
import { Button, Input, Select } from '../ui';

export function TopBar({ meta, onOpenSettings }) {
  const schoolYear = meta?.schoolYear ?? 'S.Y. 2025-2026';

  return (
    <header className="flex h-16 w-full flex-shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.65),0_6px_16px_rgba(163,177,198,0.22)] sm:px-6 lg:px-8">
      <div className="relative min-w-0 flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input className="h-10 pl-10" type="search" placeholder="Search students, classes..." />
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <Select className="hidden h-10 w-44 sm:block" value={schoolYear} onChange={() => {}}>
          <option>{schoolYear}</option>
        </Select>
        <div className="hidden min-w-0 rounded-xl px-4 py-2 text-right shadow-inset md:block">
          <p className="truncate text-sm font-medium">{meta?.title ?? 'iTALA'}</p>
          <p className="truncate text-xs text-muted-foreground">{meta?.detail ?? 'Offline grading workspace'}</p>
        </div>
        {onOpenSettings ? (
          <Button size="icon" variant="secondary" aria-label="Settings" title="Settings" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </header>
  );
}
