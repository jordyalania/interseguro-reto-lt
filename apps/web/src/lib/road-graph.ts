import type { RoadGraph } from '../api';

export const PDF_GRAPH: RoadGraph = {
  Miraflores: { 'San Isidro': 7, Barranco: 3 },
  'San Isidro': { Miraflores: 7, Lince: 4 },
  Barranco: { Miraflores: 3, Surco: 5 },
  Lince: { 'San Isidro': 4, Surco: 6 },
  Surco: { Barranco: 5, Lince: 6, Ate: 10 },
  Ate: { Surco: 10 },
};

export interface PositionedNode {
  name: string;
  x: number;
  y: number;
}

export interface DrawnEdge {
  from: string;
  to: string;
  label: string;
}

/** Recorre el grafo en profundidad: los vecinos quedan contiguos y el esquema cruza menos líneas. */
export function listNodes(graph: RoadGraph): string[] {
  const names = new Set<string>();
  const visit = (name: string): void => {
    if (names.has(name)) return;
    names.add(name);
    Object.keys(graph[name] ?? {}).forEach(visit);
  };
  Object.keys(graph).forEach(visit);
  return [...names];
}

/** Reparte los nodos en un círculo. Es un esquema, no un mapa. */
export function layoutNodes(names: string[], size: number): PositionedNode[] {
  const center = size / 2;
  const radius = size / 2 - 70;
  return names.map((name, index) => {
    const angle = (2 * Math.PI * index) / names.length - Math.PI / 2;
    return {
      name,
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  });
}

/** Ubica los distritos según sus coordenadas. Devuelve null si a alguno le faltan. */
export function layoutByCoordinates(
  names: string[],
  coordinates: Record<string, { latitude: number; longitude: number }>,
  size: number,
): PositionedNode[] | null {
  const points = names.map((name) => coordinates[name]);
  if (points.length === 0 || points.some((point) => !point)) {
    return null;
  }

  // Mezcla la posición real con el orden relativo: conserva quién está al norte o al este,
  // pero separa el centro de Lima, donde los distritos quedarían amontonados.
  const spread = (values: number[]): number[] => {
    const min = Math.min(...values);
    const range = Math.max(...values) - min || 1;
    const sorted = [...values].sort((a, b) => a - b);
    const lastRank = Math.max(values.length - 1, 1);
    return values.map((value) => {
      const linear = (value - min) / range;
      const rank = sorted.indexOf(value) / lastRank;
      return (linear + rank) / 2;
    });
  };

  const xs = spread(points.map((point) => point!.longitude));
  const ys = spread(points.map((point) => point!.latitude));
  const padding = 60;
  const area = size - padding * 2;

  return names.map((name, index) => ({
    name,
    x: padding + xs[index]! * area,
    y: padding + (1 - ys[index]!) * area,
  }));
}

/** Une los dos sentidos de una calle en una sola línea. */
export function listEdges(graph: RoadGraph): DrawnEdge[] {
  const edges = new Map<string, DrawnEdge>();
  for (const [from, neighbors] of Object.entries(graph)) {
    for (const [to, weight] of Object.entries(neighbors)) {
      const key = [from, to].sort().join('\u0000');
      const existing = edges.get(key);
      if (!existing) {
        edges.set(key, { from, to, label: String(weight) });
      } else if (existing.label !== String(weight)) {
        existing.label = `${existing.label} / ${weight}`;
      }
    }
  }
  return [...edges.values()];
}

export function isEdgeOnPath(edge: DrawnEdge, path: string[]): boolean {
  return path.some((node, index) => {
    const next = path[index + 1];
    return (node === edge.from && next === edge.to) || (node === edge.to && next === edge.from);
  });
}

/** Comprueba la forma del grafo antes de enviarlo: distrito -> vecino -> distancia. */
export function parseGraph(text: string): { graph: RoadGraph } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { error: `JSON inválido: ${(error as Error).message}` };
  }
  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  if (!isPlainObject(parsed)) {
    return { error: 'El grafo debe ser un objeto: distrito → vecino → distancia.' };
  }
  for (const [from, neighbors] of Object.entries(parsed)) {
    if (!isPlainObject(neighbors) || Object.values(neighbors).some((w) => typeof w !== 'number')) {
      return { error: `Las conexiones de "${from}" deben ser distancias numéricas.` };
    }
  }
  return { graph: parsed as RoadGraph };
}
