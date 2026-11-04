import { describe, expect, it } from 'vitest';
import { listEdges, layoutByCoordinates } from './road-graph';
import {
  type RouteMatrixResponse,
  syntheticRouteProvider,
  toCoordinates,
  toRoadGraph,
} from './route-provider';

const origin = (name: string) => ({ name, latLng: { latitude: 0, longitude: 0 } });

const matrix: RouteMatrixResponse = {
  synthetic: true,
  note: '',
  origins: [origin('A'), origin('B'), origin('C')],
  elements: [
    {
      originIndex: 0,
      destinationIndex: 1,
      condition: 'ROUTE_EXISTS',
      distanceMeters: 2500,
      duration: '90s',
    },
    {
      originIndex: 1,
      destinationIndex: 2,
      condition: 'ROUTE_NOT_FOUND',
      distanceMeters: 0,
      duration: '0s',
    },
  ],
};

describe('toRoadGraph', () => {
  it('convierte metros a kilómetros', () => {
    expect(toRoadGraph(matrix, 'distance').A).toEqual({ B: 2.5 });
  });

  it('convierte segundos a minutos', () => {
    expect(toRoadGraph(matrix, 'time').A).toEqual({ B: 1.5 });
  });

  it('ignora los tramos sin ruta, pero conserva los distritos', () => {
    const graph = toRoadGraph(matrix, 'distance');

    expect(graph.B).toEqual({});
    expect(graph.C).toEqual({});
  });

  it('rechaza un índice inexistente', () => {
    const broken = { ...matrix, elements: [{ ...matrix.elements[0]!, destinationIndex: 9 }] };

    expect(() => toRoadGraph(broken, 'distance')).toThrow(/Índice inválido/);
  });

  it('rechaza una duración mal formada', () => {
    const broken = { ...matrix, elements: [{ ...matrix.elements[0]!, duration: '5 min' }] };

    expect(() => toRoadGraph(broken, 'time')).toThrow(/Duración inválida/);
  });
});

describe('proveedor sintético', () => {
  it('se identifica como datos simulados', async () => {
    const data = await syntheticRouteProvider.getRouteMatrix();

    expect(data.synthetic).toBe(true);
    expect(data.note).toMatch(/simulados/i);
  });

  it('solo trae tramos entre vecinos, para que Dijkstra deba combinarlos', async () => {
    const data = await syntheticRouteProvider.getRouteMatrix();
    const allPairs = data.origins.length * (data.origins.length - 1);

    expect(data.elements.length).toBeLessThan(allPairs / 2);
  });

  it('produce pesos distintos según el criterio', async () => {
    const data = await syntheticRouteProvider.getRouteMatrix();

    expect(toRoadGraph(data, 'distance')).not.toEqual(toRoadGraph(data, 'time'));
    expect(listEdges(toRoadGraph(data, 'time')).length).toBeGreaterThan(0);
  });

  it('tiene coordenadas para todos los distritos', async () => {
    const data = await syntheticRouteProvider.getRouteMatrix();
    const names = Object.keys(toRoadGraph(data, 'time'));

    expect(layoutByCoordinates(names, toCoordinates(data), 560)).toHaveLength(names.length);
  });
});

describe('layoutByCoordinates', () => {
  const coordinates = {
    Norte: { latitude: -12, longitude: -77 },
    Sur: { latitude: -12.2, longitude: -77 },
    Este: { latitude: -12.1, longitude: -76.9 },
  };

  it('dibuja el norte arriba y el este a la derecha', () => {
    const nodes = layoutByCoordinates(['Norte', 'Sur', 'Este'], coordinates, 500)!;
    const find = (name: string) => nodes.find((node) => node.name === name)!;

    expect(find('Norte').y).toBeLessThan(find('Sur').y);
    expect(find('Este').x).toBeGreaterThan(find('Norte').x);
  });

  it('devuelve null si un distrito no tiene coordenadas', () => {
    expect(layoutByCoordinates(['Norte', 'Nuevo'], coordinates, 500)).toBeNull();
  });
});
