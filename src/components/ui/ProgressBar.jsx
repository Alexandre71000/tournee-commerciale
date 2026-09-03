export default function ProgressBar({ percent = 0 }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}
