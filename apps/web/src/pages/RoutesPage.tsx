import { type FormEvent, useMemo, useState } from 'react';
import { api, ApiError, type OptimalRoute } from '../api';
import { GraphView } from '../components/GraphView';
import { JsonOutput } from '../components/JsonOutput';
import { listNodes, parseGraph, PDF_GRAPH } from '../lib/road-graph';

interface Props {
  token: string;
  onUnauthorized: () => void;
}

const INITIAL_GRAPH = JSON.stringify(PDF_GRAPH, null, 2);

export function RoutesPage({ token, onUnauthorized }: Props) {
  const [graphText, setGraphText] = useState(INITIAL_GRAPH);
  const [accident, setAccident] = useState('San Isidro');
  const [depots, setDepots] = useState<string[]>(['Miraflores', 'Ate']);
  const [route, setRoute] = useState<OptimalRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsed = useMemo(() => parseGraph(graphText), [graphText]);
  const graph = 'graph' in parsed ? parsed.graph : null;
  const nodes = useMemo(() => (graph ? listNodes(graph) : []), [graph]);
  const validDepots = depots.filter((depot) => nodes.includes(depot));

  const toggleDepot = (name: string) => {
    setRoute(null);
    setDepots((current) =>
      current.includes(name) ? current.filter((depot) => depot !== name) : [...current, name],
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!graph) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.optimalRoute(token, {
        accidentLocation: accident,
        depots: validDepots,
        graph,
      });
      setRoute(data);
    } catch (caught) {
      setRoute(null);
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
      } else {
        setError((caught as ApiError).message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="split">
      <form className="card" onSubmit={submit}>
        <div className="card-header">
          <div>
            <h2>Datos del siniestro</h2>
            <p className="muted">Puedes cambiar la red sin tocar el algoritmo.</p>
          </div>
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              setGraphText(INITIAL_GRAPH);
              setAccident('San Isidro');
              setDepots(['Miraflores', 'Ate']);
              setRoute(null);
              setError(null);
            }}
          >
            Restaurar ejemplo
          </button>
        </div>

        <label className="field">
          <span>Ubicación del accidente</span>
          <select
            value={nodes.includes(accident) ? accident : ''}
            onChange={(event) => {
              setAccident(event.target.value);
              setRoute(null);
            }}
            required
          >
            <option value="" disabled>
              Selecciona un distrito
            </option>
            {nodes.map((node) => (
              <option key={node} value={node}>
                {node}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="field">
          <legend>Bases de grúas</legend>
          <div className="chips">
            {nodes.map((node) => (
              <label className={validDepots.includes(node) ? 'chip active' : 'chip'} key={node}>
                <input
                  type="checkbox"
                  checked={validDepots.includes(node)}
                  onChange={() => toggleDepot(node)}
                />
                {node}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Red de distritos (distrito → vecino → distancia)</span>
          <textarea
            className="code"
            rows={9}
            spellCheck={false}
            value={graphText}
            onChange={(event) => {
              setGraphText(event.target.value);
              setRoute(null);
            }}
          />
        </label>
        {'error' in parsed && (
          <p className="alert error" role="alert">
            {parsed.error}
          </p>
        )}

        <button
          className="button primary"
          disabled={submitting || !graph || validDepots.length === 0 || !nodes.includes(accident)}
        >
          {submitting ? 'Calculando…' : 'Calcular ruta óptima'}
        </button>
      </form>

      <section className="card output-card" aria-live="polite">
        <div className="card-header">
          <h2>Resultado</h2>
          {route && (
            <span className="badge success">
              {route.fromDepot} · distancia {route.distance}
            </span>
          )}
        </div>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        {graph && (
          <GraphView graph={graph} accident={accident} depots={validDepots} path={route?.path ?? []} />
        )}
        {route && <JsonOutput value={route} />}
        <p className="muted small">Esquema de la red, no un mapa geográfico.</p>
      </section>
    </div>
  );
}
