import { NavLink } from 'react-router-dom';
import { Route, ListChecks, Users, FileSpreadsheet, Settings, Sun, Moon, Waypoints } from 'lucide-react';
import clsx from 'clsx';

const ITEMS = [
  { to: '/planifier', label: 'Planifier', icon: Route },
  { to: '/tournees', label: 'Mes tournées', icon: ListChecks },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/import', label: 'Importer', icon: FileSpreadsheet },
  { to: '/reglages', label: 'Réglages', icon: Settings },
];

export default function NavRail({ theme, onToggleTheme }) {
  return (
    <nav className="fixed left-0 top-0 bottom-0 z-40 w-[76px] flex flex-col items-center py-5 gap-6 glass border-y-0 border-l-0 rounded-none">
      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
        <Waypoints size={20} strokeWidth={2.25} />
      </div>

      <div className="flex-1 flex flex-col gap-1.5">
        {ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          onClick={onToggleTheme}
          className="group relative w-11 h-11 rounded-xl flex items-center justify-center text-ink-faint hover:text-ink hover:bg-surface-3/70 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <Tooltip>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</Tooltip>
        </button>
      </div>
    </nav>
  );
}

function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'group relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
          isActive ? 'bg-accent/15 text-accent' : 'text-ink-faint hover:text-ink hover:bg-surface-3/70'
        )
      }
    >
      <Icon size={19} strokeWidth={2} />
      <Tooltip>{label}</Tooltip>
    </NavLink>
  );
}

function Tooltip({ children }) {
  return (
    <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-surface-3 border border-border/10 px-2.5 py-1.5 text-xs font-medium text-ink opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shadow-floating">
      {children}
    </span>
  );
}
