import clsx from 'clsx';
import { motion } from 'framer-motion';

const VARIANTS = {
  primary: 'bg-accent text-surface font-semibold hover:bg-accent-strong shadow-[0_0_0_1px_rgb(var(--accent)/0.4),0_8px_24px_-8px_rgb(var(--accent)/0.6)]',
  secondary: 'bg-surface-3/80 text-ink border border-border/10 hover:bg-surface-3 hover:border-border/20',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-3/60',
  danger: 'bg-danger/15 text-danger border border-danger/25 hover:bg-danger/25',
};

const SIZES = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg',
  md: 'text-sm px-4 py-2.5 gap-2 rounded-xl',
  lg: 'text-sm px-5 py-3 gap-2 rounded-2xl',
};

export default function Button({ variant = 'secondary', size = 'md', className, children, disabled, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      className={clsx(
        'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
}
