import { type FormEvent, useState } from 'react';
import { api, ApiError } from '../api';

interface Props {
  sessionExpired: boolean;
  onLogin: (token: string) => void;
}

export function LoginPage({ sessionExpired, onLogin }: Props) {
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.login(username, password);
      onLogin(data.accessToken);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se pudo iniciar sesión.');
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <h1>Consola técnica</h1>
        <p className="muted">Traductor de endosos y rutas de grúas</p>
        {sessionExpired && (
          <p className="alert warning" role="status">
            Tu sesión venció. Vuelve a ingresar.
          </p>
        )}
        <label className="field">
          <span>Usuario</span>
          <input
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
