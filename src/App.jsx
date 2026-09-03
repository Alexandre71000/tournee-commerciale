import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './hooks/useToast';
import { useAuth } from './hooks/useAuth';
import { AppDataProvider } from './context/AppDataContext';
import AppShell from './components/layout/AppShell';
import AuthScreen from './pages/AuthScreen';
import PlannerPage from './pages/planner';
import ToursPage from './pages/tours';
import ClientsPage from './pages/clients';
import ImportPage from './pages/import';
import SettingsPage from './pages/settings';
import { Loader2, Waypoints } from 'lucide-react';

export default function App() {
  return (
    <ToastProvider>
      <Gate />
    </ToastProvider>
  );
}

function Gate() {
  const { user, loading } = useAuth();

  if (loading) return <Splash />;
  if (!user) return <AuthScreen />;

  return (
    <AppDataProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/planifier" replace />} />
            <Route path="/planifier" element={<PlannerPage />} />
            <Route path="/tournees" element={<ToursPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/reglages" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/planifier" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppDataProvider>
  );
}

function Splash() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-3 bg-surface text-ink-faint">
      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
        <Waypoints size={20} strokeWidth={2.25} />
      </div>
      <Loader2 size={18} className="animate-spin text-accent" />
    </div>
  );
}
