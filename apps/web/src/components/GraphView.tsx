import { useMemo } from 'react';
import type { RoadGraph } from '../api';
import { isEdgeOnPath, layoutNodes, listEdges, listNodes } from '../lib/road-graph';

interface Props {
  graph: RoadGraph;
  accident: string;
  depots: string[];
  path: string[];
}

const SIZE = 460;

export function GraphView({ graph, accident, depots, path }: Props) {
  const nodes = useMemo(() => layoutNodes(listNodes(graph), SIZE), [graph]);
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
              <circle cx={labelX} cy={labelY} r={12} className="edge-label-bg" />
              <text x={labelX} y={labelY} className="edge-label">
                {edge.label}
              </text>
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
                r={onPath ? 13 : 10}
                className={`node ${kind}${onPath ? ' on-path' : ''}`}
              />
              <text
                x={node.x}
                y={node.y + (node.y < SIZE / 2 ? -20 : 28)}
                className="node-label"
              >
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
