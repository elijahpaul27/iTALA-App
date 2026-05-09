import { forwardRef } from 'react';
import { cn } from './utils';

export const Card = forwardRef(function Card({ className = '', interactive = false, inset = false, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-border bg-card text-card-foreground',
        inset ? 'shadow-inset' : 'shadow-raised',
        interactive ? 'transition duration-200 hover:-translate-y-0.5 hover:shadow-glow' : '',
        className
      )}
      {...props}
    />
  );
});

export function CardHeader({ className = '', ...props }) {
  return <div className={cn('space-y-1.5 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className = '', ...props }) {
  return <h3 className={cn('text-lg font-medium tracking-normal text-foreground', className)} {...props} />;
}

export function CardDescription({ className = '', ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className = '', ...props }) {
  return <div className={cn('p-5 pt-3', className)} {...props} />;
}

export function CardFooter({ className = '', ...props }) {
  return <div className={cn('flex items-center gap-2 p-5 pt-3', className)} {...props} />;
}
