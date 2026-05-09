import { cn } from './utils';

export function Table({ className = '', ...props }) {
  return (
    <div className="w-full overflow-auto rounded-2xl border border-border bg-card shadow-inset">
      <table className={cn('w-full caption-bottom text-left text-sm text-foreground', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className = '', ...props }) {
  return <thead className={cn('bg-muted/60 text-muted-foreground', className)} {...props} />;
}

export function TableBody({ className = '', ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className = '', ...props }) {
  return <tfoot className={cn('border-t border-border bg-muted/60 font-medium', className)} {...props} />;
}

export function TableRow({ className = '', ...props }) {
  return <tr className={cn('border-b border-border transition-colors hover:bg-white/20', className)} {...props} />;
}

export function TableHead({ className = '', ...props }) {
  return <th className={cn('h-11 px-4 text-left align-middle text-xs font-medium uppercase tracking-wide', className)} {...props} />;
}

export function TableCell({ className = '', ...props }) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />;
}

export function TableCaption({ className = '', ...props }) {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />;
}
