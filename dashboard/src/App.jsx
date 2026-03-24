import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { AppLayout } from './components/layout/AppLayout.jsx';

import Login        from './pages/Login.jsx';
import Overview     from './pages/Overview.jsx';
import Clients      from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Pipeline       from './pages/Pipeline.jsx';
import CreateCarousel from './pages/CreateCarousel.jsx';
import Scheduler    from './pages/Scheduler.jsx';
import Analytics    from './pages/Analytics.jsx';
import Connections  from './pages/Connections.jsx';
import Templates    from './pages/Templates.jsx';
import SettingsPage from './pages/Settings.jsx';

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login />
        } />

        <Route path="/" element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }>
          <Route index              element={<Overview />} />
          <Route path="clients"     element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="pipeline"    element={<Pipeline />} />
          <Route path="carousel/new" element={<CreateCarousel />} />
          <Route path="scheduler"   element={<Scheduler />} />
          <Route path="analytics"   element={<Analytics />} />
          <Route path="connections" element={<Connections />} />
          <Route path="templates"   element={<Templates />} />
          <Route path="settings"    element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
