import clsx from 'clsx';

export default function GlassPanel({ className, children, strong, as: Tag = 'div', ...props }) {
  return (
    <Tag className={clsx(strong ? 'glass-strong' : 'glass', 'rounded-2xl', className)} {...props}>
      {children}
    </Tag>
  );
}

export function PanelLabel({ icon: Icon, children, className }) {
  return (
    <div className={clsx('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-3', className)}>
      {Icon && <Icon size={13} strokeWidth={2.25} />}
      {children}
    </div>
  );
}
