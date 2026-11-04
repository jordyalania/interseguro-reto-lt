import { useState } from 'react';
import { EndorsementsPage } from './pages/EndorsementsPage';
import { LoginPage } from './pages/LoginPage';
import { RoutesPage } from './pages/RoutesPage';

type Tab = 'endorsements' | 'routes';

export function App() {
  // El token vive solo en memoria: recargar la página obliga a iniciar sesión.
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('endorsements');
  const [sessionExpired, setSessionExpired] = useState(false);

  const expireSession = () => {
    setToken(null);
    setSessionExpired(true);
  };

  if (!token) {
    return (
      <LoginPage
        sessionExpired={sessionExpired}
        onLogin={(accessToken) => {
          setSessionExpired(false);
          setToken(accessToken);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Consola técnica</strong>
        <nav className="tabs" aria-label="Secciones">
          <button
            className={tab === 'endorsements' ? 'tab active' : 'tab'}
            aria-current={tab === 'endorsements' ? 'page' : undefined}
            onClick={() => setTab('endorsements')}
          >
            Traductor de endosos
          </button>
          <button
            className={tab === 'routes' ? 'tab active' : 'tab'}
            aria-current={tab === 'routes' ? 'page' : undefined}
            onClick={() => setTab('routes')}
          >
            Rutas de grúas
          </button>
        </nav>
        <button className="button ghost" onClick={() => setToken(null)}>
          Cerrar sesión
        </button>
      </header>
      <main className="content">
        {tab === 'endorsements' ? (
          <EndorsementsPage token={token} onUnauthorized={expireSession} />
        ) : (
          <RoutesPage token={token} onUnauthorized={expireSession} />
        )}
      </main>
    </div>
  );
}
