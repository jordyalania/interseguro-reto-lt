import { useMemo } from 'react';
import type { RoadGraph } from '../api';
import {
  isEdgeOnPath,
  layoutByCoordinates,
  layoutNodes,
  listEdges,
  listNodes,
} from '../lib/road-graph';
import type { LatLng } from '../lib/route-provider';

interface Props {
  graph: RoadGraph;
  accident: string;
  depots: string[];
  path: string[];
  coordinates?: Record<string, LatLng>;
}

const SIZE = 560;

export function GraphView({ graph, accident, depots, path, coordinates }: Props) {
  const nodes = useMemo(() => {
    const names = listNodes(graph);
    return (coordinates && layoutByCoordinates(names, coordinates, SIZE)) || layoutNodes(names, SIZE);
  }, [graph, coordinates]);
  const edges = useMemo(() => listEdges(graph), [graph]);
  const position = useMemo(() => new Map(nodes.map((node) => [node.name, node])), [nodes]);

  const description =
    path.length > 0
      ? `Ruta óptima: ${path.join(', ')}`
      : `Red con ${nodes.length} distritos y ${edges.length} conexiones`;

  return (
    <div>
      <svg className="graph" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={description}>
        {edges.map((edge) => {
          const from = position.get(edge.from);
          const to = position.get(edge.to);
          if (!from || !to) return null;
          const onPath = isEdgeOnPath(edge, path);
          const labelX = (from.x + to.x) / 2;
          const labelY = (from.y + to.y) / 2;
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={onPath ? 'edge on-path' : 'edge'}
              />
              {(onPath || !coordinates) && (
                <>
                  <rect
                    x={labelX - edge.label.length * 3.4 - 3}
                    y={labelY - 8}
                    width={edge.label.length * 6.8 + 6}
                    height={16}
                    rx={4}
                    className="edge-label-bg"
                  />
                  <text x={labelX} y={labelY} className={onPath ? 'edge-label on-path' : 'edge-label'}>
                    {edge.label}
                  </text>
                </>
              )}
            </g>
          );
        })}
        {nodes.map((node) => {
          const kind =
            node.name === accident ? 'accident' : depots.includes(node.name) ? 'depot' : 'district';
          const onPath = path.includes(node.name);
          return (
            <g key={node.name}>
              <circle
                cx={node.x}
                cy={node.y}
                r={onPath ? 11 : 8}
                className={`node ${kind}${onPath ? ' on-path' : ''}`}
              />
              <text x={node.x} y={node.y - 15} className="node-label">
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="legend" aria-hidden="true">
        <li>
          <span className="dot depot" /> Base
        </li>
        <li>
          <span className="dot accident" /> Siniestro
        </li>
        <li>
          <span className="dot district" /> Distrito
        </li>
        <li>
          <span className="line" /> Ruta elegida
        </li>
      </ul>
    </div>
  );
}
