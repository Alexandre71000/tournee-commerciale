import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './hooks/useToast';
import { AppDataProvider } from './context/AppDataContext';
import AppShell from './components/layout/AppShell';
import PlannerPage from './pages/planner';
import ToursPage from './pages/tours';
import ClientsPage from './pages/clients';
import ImportPage from './pages/import';
import SettingsPage from './pages/settings';

// Authentification désactivée pour le moment : l'app s'ouvre directement, données partagées sans compte.
// Pour la réactiver : restaurer src/pages/AuthScreen.jsx + src/hooks/useAuth.js dans ce fichier et
// dans AppDataContext, et ré-appliquer les policies RLS liées à auth.uid() (voir supabase-schema.sql).
export default function App() {
  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}
