#!/usr/bin/env node
// Genera una respuesta SINTÉTICA con forma parecida a Google Routes (computeRouteMatrix).
// No consulta a Google: coordenadas aproximadas, y distancias y tiempos estimados.
// Es determinista: siempre produce el mismo archivo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../apps/web/src/data/lima-route-matrix.synthetic.json',
);

const DISTRICTS = {
  Ate: [-12.0266, -76.9176],
  Barranco: [-12.1445, -77.0206],
  Callao: [-12.0566, -77.1181],
  Chorrillos: [-12.1758, -77.0156],
  'Jesús María': [-12.0775, -77.0486],
  'La Molina': [-12.0794, -76.94],
  'La Victoria': [-12.0658, -77.0175],
  'Lima Cercado': [-12.0464, -77.0428],
  Lince: [-12.0836, -77.0347],
  'Los Olivos': [-11.9925, -77.07],
  Miraflores: [-12.1211, -77.0297],
  'San Borja': [-12.1006, -77.0006],
  'San Isidro': [-12.0976, -77.0365],
  'San Miguel': [-12.0776, -77.0839],
  Surco: [-12.1459, -76.9911],
  Surquillo: [-12.1128, -77.0158],
};

// Velocidad estimada por tipo de vía, en km/h.
const SPEED_KMH = { expressway: 50, avenue: 26, local: 16, congested: 11 };

// Solo tramos entre distritos vecinos. Una matriz con todas las parejas daría rutas directas
// y dejaría sin trabajo a Dijkstra, que debe combinar tramos.
const SEGMENTS = [
  ['Miraflores', 'Barranco', 'local'],
  ['Miraflores', 'Surquillo', 'avenue'],
  ['Miraflores', 'San Isidro', 'avenue'],
  ['Surquillo', 'San Borja', 'avenue'],
  ['Surquillo', 'San Isidro', 'expressway'],
  ['San Isidro', 'Lince', 'avenue'],
  ['San Isidro', 'Jesús María', 'local'],
  ['San Isidro', 'San Borja', 'expressway'],
  ['Lince', 'Jesús María', 'local'],
  ['Lince', 'La Victoria', 'congested'],
  ['Lince', 'Lima Cercado', 'expressway'],
  ['Jesús María', 'Lima Cercado', 'avenue'],
  ['Jesús María', 'San Miguel', 'avenue'],
  ['San Miguel', 'Callao', 'avenue'],
  ['San Miguel', 'Lima Cercado', 'avenue'],
  ['Callao', 'Los Olivos', 'expressway'],
  ['Lima Cercado', 'Los Olivos', 'expressway'],
  ['Lima Cercado', 'La Victoria', 'congested'],
  ['La Victoria', 'San Borja', 'congested'],
  ['La Victoria', 'Ate', 'expressway'],
  ['San Borja', 'La Molina', 'expressway'],
  ['San Borja', 'Surco', 'avenue'],
  ['Surco', 'Barranco', 'local'],
  ['Surco', 'La Molina', 'avenue'],
  ['Surco', 'Chorrillos', 'avenue'],
  ['Chorrillos', 'Barranco', 'local'],
  ['La Molina', 'Ate', 'avenue'],
];

const ROAD_FACTOR = 1.3; // Las calles no van en línea recta.

function straightLineMeters([lat1, lng1], [lat2, lng2]) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

const names = Object.keys(DISTRICTS);
const elements = SEGMENTS.flatMap(([a, b, road]) => {
  const meters = Math.round(straightLineMeters(DISTRICTS[a], DISTRICTS[b]) * ROAD_FACTOR);
  const seconds = Math.round((meters / 1000 / SPEED_KMH[road]) * 3600);
  return [
    [a, b],
    [b, a],
  ].map(([from, to]) => ({
    originIndex: names.indexOf(from),
    destinationIndex: names.indexOf(to),
    condition: 'ROUTE_EXISTS',
    distanceMeters: meters,
    duration: `${seconds}s`,
  }));
});

const matrix = {
  synthetic: true,
  note: 'Datos simulados con forma parecida a Google Routes. No son mediciones reales.',
  origins: names.map((name) => ({
    name,
    latLng: { latitude: DISTRICTS[name][0], longitude: DISTRICTS[name][1] },
  })),
  elements,
};

// Comprueba el escenario de la demo: la base ganadora debe cambiar según el criterio.
function shortest(weightOf, sources, target) {
  const best = new Map(sources.map((source) => [source, { cost: 0, source }]));
  const pending = new Set(sources);
  while (pending.size > 0) {
    const current = [...pending].sort((a, b) => best.get(a).cost - best.get(b).cost)[0];
    pending.delete(current);
    if (current === target) return best.get(current);
    for (const element of elements) {
      if (names[element.originIndex] !== current) continue;
      const next = names[element.destinationIndex];
      const cost = best.get(current).cost + weightOf(element);
      if (!best.has(next) || cost < best.get(next).cost) {
        best.set(next, { cost, source: best.get(current).source });
        pending.add(next);
      }
    }
  }
  return null;
}

const byDistance = (element) => element.distanceMeters;
const byTime = (element) => Number.parseInt(element.duration, 10);

const demoDepots = ['San Isidro', 'Surco'];
const nearest = shortest(byDistance, demoDepots, 'La Molina');
const fastest = shortest(byTime, demoDepots, 'La Molina');
if (nearest.source !== 'Surco' || fastest.source !== 'San Isidro') {
  throw new Error('El escenario de la demo ya no cambia de base según el criterio');
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(matrix, null, 2)}\n`);
console.log(`Generado con ${names.length} distritos y ${elements.length} tramos dirigidos.`);
