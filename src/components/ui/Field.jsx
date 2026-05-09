import { cn } from './utils';

export function Field({ label, className = '', children }) {
  return (
    <label className={cn('grid gap-1.5', className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
