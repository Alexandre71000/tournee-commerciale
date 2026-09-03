import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import NavRail from './NavRail';

function getInitialTheme() {
  return localStorage.getItem('themePreference') === 'light' ? 'light' : 'dark';
}

export default function AppShell() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('themePreference', theme);
  }, [theme]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-surface">
      <NavRail theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
      <main className="h-full pl-[76px]">
        <Outlet />
      </main>
    </div>
  );
}
