import { describe, expect, it } from 'vitest';
import { isEdgeOnPath, listEdges, listNodes, parseGraph, PDF_GRAPH } from './road-graph';

describe('road-graph', () => {
  it('lista también los nodos que solo aparecen como vecinos', () => {
    expect(listNodes({ A: { B: 1 } })).toEqual(['A', 'B']);
  });

  it('une los dos sentidos de una calle con la misma distancia', () => {
    expect(listEdges(PDF_GRAPH)).toHaveLength(6);
  });

  it('muestra ambas distancias cuando los sentidos difieren', () => {
    expect(listEdges({ A: { B: 1 }, B: { A: 2 } })[0]?.label).toBe('1 / 2');
  });

  it('reconoce una arista de la ruta en cualquier sentido', () => {
    const edge = { from: 'B', to: 'A', label: '1' };

    expect(isEdgeOnPath(edge, ['A', 'B', 'C'])).toBe(true);
    expect(isEdgeOnPath(edge, ['B', 'C'])).toBe(false);
  });

  it.each(['[]', '{"A": 1}', '{"A": {"B": "x"}}', '{'])('rechaza %s', (text) => {
    expect(parseGraph(text)).toHaveProperty('error');
  });
});
