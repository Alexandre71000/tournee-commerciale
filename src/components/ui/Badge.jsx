import clsx from 'clsx';

const TONES = {
  accent: 'bg-accent/15 text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-surface-3 text-ink-faint',
};

export default function Badge({ tone = 'muted', icon: Icon, children, className }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', TONES[tone], className)}>
      {Icon && <Icon size={11} strokeWidth={2.5} />}
      {children}
    </span>
  );
}
