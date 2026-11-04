import type { RoadGraph } from '../api';
import syntheticMatrix from '../data/lima-route-matrix.synthetic.json';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteMatrixElement {
  originIndex: number;
  destinationIndex: number;
  condition: string;
  distanceMeters: number;
  duration: string;
}

/** Forma parecida a Google Routes, más los orígenes que en Google se envían en la solicitud. */
export interface RouteMatrixResponse {
  synthetic: boolean;
  note: string;
  origins: { name: string; latLng: LatLng }[];
  elements: RouteMatrixElement[];
}

export type RouteMetric = 'distance' | 'time';

export const METRIC_UNIT: Record<RouteMetric, string> = { distance: 'km', time: 'min' };

/** Punto de cambio: usar Google real solo requiere otra implementación de esta interfaz. */
export interface RouteDataProvider {
  getRouteMatrix(): Promise<RouteMatrixResponse>;
}

export const syntheticRouteProvider: RouteDataProvider = {
  getRouteMatrix: async () => syntheticMatrix,
};

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function parseSeconds(duration: string): number {
  if (!/^\d+(\.\d+)?s$/.test(duration)) {
    throw new Error(`Duración inválida: "${duration}"`);
  }
  return Number.parseFloat(duration);
}

function weightOf(element: RouteMatrixElement, metric: RouteMetric): number {
  return metric === 'distance'
    ? roundToTenth(element.distanceMeters / 1000)
    : roundToTenth(parseSeconds(element.duration) / 60);
}

/**
 * Adaptador: convierte la respuesta del proveedor en el grafo que ya recibe la API.
 * Dijkstra no sabe de dónde vienen los datos ni qué significan los pesos.
 */
export function toRoadGraph(matrix: RouteMatrixResponse, metric: RouteMetric): RoadGraph {
  const graph: RoadGraph = Object.fromEntries(matrix.origins.map(({ name }) => [name, {}]));

  for (const element of matrix.elements) {
    if (element.condition !== 'ROUTE_EXISTS') continue;

    const origin = matrix.origins[element.originIndex]?.name;
    const destination = matrix.origins[element.destinationIndex]?.name;
    if (!origin || !destination) {
      throw new Error(`Índice inválido: ${element.originIndex} → ${element.destinationIndex}`);
    }
    graph[origin]![destination] = weightOf(element, metric);
  }
  return graph;
}

export function toCoordinates(matrix: RouteMatrixResponse): Record<string, LatLng> {
  return Object.fromEntries(matrix.origins.map(({ name, latLng }) => [name, latLng]));
}
