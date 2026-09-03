export default function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 text-ink-faint">
      {Icon && <Icon size={28} strokeWidth={1.5} className="mb-3 opacity-70" />}
      <div className="text-sm font-medium text-ink-muted">{title}</div>
      {hint && <div className="text-xs mt-1 max-w-xs">{hint}</div>}
    </div>
  );
}
