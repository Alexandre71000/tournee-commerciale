import clsx from 'clsx';

export default function Field({ label, hint, className, children }) {
  return (
    <label className={clsx('flex flex-col gap-1.5', className)}>
      {label && <span className="text-xs font-medium text-ink-muted">{label}</span>}
      {children}
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return <input className="input-field" {...props} />;
}

export function Select(props) {
  return <select className="input-field appearance-none" {...props} />;
}

export function Textarea(props) {
  return <textarea className="input-field resize-none" {...props} />;
}
