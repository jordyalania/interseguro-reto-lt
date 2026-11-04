import { type FormEvent, useMemo, useState } from 'react';
import { api, ApiError, type OptimalRoute, type RoadGraph } from '../api';
import { GraphView } from '../components/GraphView';
import { JsonOutput } from '../components/JsonOutput';
import { listNodes, parseGraph, PDF_GRAPH } from '../lib/road-graph';
import {
  METRIC_UNIT,
  type RouteMatrixResponse,
  type RouteMetric,
  syntheticRouteProvider,
  toCoordinates,
  toRoadGraph,
} from '../lib/route-provider';

interface Props {
  token: string;
  onUnauthorized: () => void;
}

type Source = 'pdf' | 'lima';

const toText = (graph: RoadGraph) => JSON.stringify(graph, null, 2);

const SCENARIOS: Record<Source, { accident: string; depots: string[] }> = {
  pdf: { accident: 'San Isidro', depots: ['Miraflores', 'Ate'] },
  lima: { accident: 'La Molina', depots: ['San Isidro', 'Surco'] },
};

export function RoutesPage({ token, onUnauthorized }: Props) {
  const [source, setSource] = useState<Source>('pdf');
  const [metric, setMetric] = useState<RouteMetric>('distance');
  const [matrix, setMatrix] = useState<RouteMatrixResponse | null>(null);
  const [graphText, setGraphText] = useState(toText(PDF_GRAPH));
  const [accident, setAccident] = useState(SCENARIOS.pdf.accident);
  const [depots, setDepots] = useState<string[]>(SCENARIOS.pdf.depots);
  const [route, setRoute] = useState<OptimalRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsed = useMemo(() => parseGraph(graphText), [graphText]);
  const graph = 'graph' in parsed ? parsed.graph : null;
  const nodes = useMemo(() => (graph ? listNodes(graph) : []), [graph]);
  const coordinates = useMemo(
    () => (source === 'lima' && matrix ? toCoordinates(matrix) : undefined),
    [source, matrix],
  );
  const validDepots = depots.filter((depot) => nodes.includes(depot));
  const unit = source === 'lima' ? ` ${METRIC_UNIT[metric]}` : '';

  const loadSource = async (next: Source) => {
    setRoute(null);
    setError(null);
    setSource(next);
    setAccident(SCENARIOS[next].accident);
    setDepots(SCENARIOS[next].depots);

    if (next === 'pdf') {
      setGraphText(toText(PDF_GRAPH));
      return;
    }
    try {
      const data = await syntheticRouteProvider.getRouteMatrix();
      setMatrix(data);
      setGraphText(toText(toRoadGraph(data, metric)));
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const changeMetric = (next: RouteMetric) => {
    setMetric(next);
    setRoute(null);
    if (matrix) {
      setGraphText(toText(toRoadGraph(matrix, next)));
    }
  };

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
          <button type="button" className="button ghost" onClick={() => void loadSource(source)}>
            Restaurar
          </button>
        </div>

        <div className="field">
          <span id="source-label">Red de distritos</span>
          <div className="segmented wide" role="group" aria-labelledby="source-label">
            <button
              type="button"
              className={source === 'pdf' ? 'active' : ''}
              aria-pressed={source === 'pdf'}
              onClick={() => void loadSource('pdf')}
            >
              Ejemplo del PDF
            </button>
            <button
              type="button"
              className={source === 'lima' ? 'active' : ''}
              aria-pressed={source === 'lima'}
              onClick={() => void loadSource('lima')}
            >
              Lima simulada
            </button>
          </div>
        </div>

        {source === 'lima' && (
          <>
            <p className="alert warning" role="status">
              Datos simulados con forma parecida a Google Routes. No son mediciones reales.
            </p>
            <div className="field">
              <span id="metric-label">Elegir la ruta por</span>
              <div className="segmented wide" role="group" aria-labelledby="metric-label">
                <button
                  type="button"
                  className={metric === 'distance' ? 'active' : ''}
                  aria-pressed={metric === 'distance'}
                  onClick={() => changeMetric('distance')}
                >
                  Menor distancia
                </button>
                <button
                  type="button"
                  className={metric === 'time' ? 'active' : ''}
                  aria-pressed={metric === 'time'}
                  onClick={() => changeMetric('time')}
                >
                  Menor tiempo
                </button>
              </div>
            </div>
          </>
        )}

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
          <span>Grafo que recibe la API (distrito → vecino → peso)</span>
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

        {source === 'lima' && matrix && (
          <details className="details">
            <summary>Ver la respuesta simulada del proveedor</summary>
            <JsonOutput value={matrix} />
          </details>
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
              {route.fromDepot} · {route.distance}
              {unit}
            </span>
          )}
        </div>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        {graph && (
          <GraphView
            graph={graph}
            accident={accident}
            depots={validDepots}
            path={route?.path ?? []}
            coordinates={coordinates}
          />
        )}
        {route && <JsonOutput value={route} />}
        <p className="muted small">
          {source === 'lima'
            ? 'Esquema orientado por coordenadas aproximadas; no es un mapa a escala. Solo se muestran los pesos de la ruta elegida.'
            : 'Esquema de la red, no un mapa geográfico.'}
        </p>
      </section>
    </div>
  );
}
