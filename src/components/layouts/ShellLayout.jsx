import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, cn } from '../ui';
import { TopBar } from './TopBar';

export function ShellLayout({
  roleLabel,
  identity,
  subtitle,
  activeTab,
  navigation,
  onSelectTab,
  onSwitchRole,
  isCollapsed,
  onToggleCollapse,
  topbarMeta,
  children
}) {
  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside
        className={cn(
          'relative flex h-screen flex-shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground shadow-raised transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-20 px-3 py-5' : 'w-64 px-5 py-6'
        )}
      >
        <div className={cn('rounded-2xl shadow-inset transition-all duration-300', isCollapsed ? 'p-2' : 'p-4')}>
          <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-raised">
              {identity.initials}
            </div>
            <div className={cn('min-w-0 transition-opacity duration-200', isCollapsed ? 'hidden' : 'block')}>
              <p className="truncate text-sm font-medium">{identity.name}</p>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 min-h-0 flex-1">
          <p className={cn('px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground', isCollapsed ? 'sr-only' : '')}>{roleLabel}</p>
          <nav className="mt-3 grid gap-3">
            {navigation.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  className={cn(
                    'flex h-12 items-center rounded-xl text-sm font-medium transition',
                    isCollapsed ? 'justify-center px-0' : 'gap-3 px-4 text-left',
                    isActive ? 'itala-nav-active' : 'itala-nav-inactive'
                  )}
                  key={item.id}
                  type="button"
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  onClick={() => onSelectTab(item.id)}
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className={cn('truncate transition-opacity duration-200', isCollapsed ? 'hidden' : 'block')}>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="grid gap-3">
          <Button
            className={cn('w-full', isCollapsed ? 'px-0' : '')}
            variant="secondary"
            size={isCollapsed ? 'icon' : 'md'}
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            <span className={isCollapsed ? 'sr-only' : ''}>{isCollapsed ? 'Expand' : 'Collapse'}</span>
          </Button>
          <Button
            className={cn('w-full', isCollapsed ? 'px-0' : '')}
            variant="secondary"
            size={isCollapsed ? 'icon' : 'md'}
            onClick={onSwitchRole}
            title="Switch Role"
            aria-label="Switch Role"
          >
            <span>{isCollapsed ? 'SR' : 'Switch Role'}</span>
          </Button>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
        <TopBar
          meta={topbarMeta}
          onOpenSettings={navigation.some((item) => item.id === 'settings') ? () => onSelectTab('settings') : undefined}
        />

        <div className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </div>
      </section>
    </main>
  );
}
