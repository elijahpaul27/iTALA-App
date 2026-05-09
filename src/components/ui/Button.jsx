import { forwardRef } from 'react';
import { cn } from './utils';

const variants = {
  primary: 'bg-primary text-primary-foreground shadow-raised hover:shadow-glow active:shadow-active',
  secondary: 'bg-background text-foreground shadow-raised hover:text-primary active:shadow-active',
  subtle: 'bg-background text-muted-foreground shadow-inset hover:text-primary',
  danger: 'bg-destructive text-destructive-foreground shadow-raised hover:shadow-glow active:shadow-active',
  ghost: 'bg-transparent text-foreground hover:bg-muted/40 hover:text-primary'
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
  icon: 'h-10 w-10 p-0'
};

export const Button = forwardRef(function Button(
  { className = '', variant = 'primary', size = 'md', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-border font-medium outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant] ?? variants.primary,
        sizes[size] ?? sizes.md,
        className
      )}
      {...props}
    />
  );
});
