# ADR 0002: Dijkstra multiorigen

**Estado:** aceptada

## Contexto

Hay que hallar la base más cercana a un siniestro. Las conexiones pueden no ser iguales en ambos sentidos.

## Decisión

Todas las bases entran a la cola con distancia 0 y el recorrido termina al llegar al siniestro. Se usa `container/heap` de la biblioteca estándar.

- Complejidad: O((V+E) log V), sin importar la cantidad de bases.
- Empates: gana la base alfabéticamente menor. Los vecinos se ordenan porque el orden de los mapas de Go es aleatorio.
- El grafo llega en cada solicitud, como define el contrato del reto.

## Alternativas descartadas

- **Un Dijkstra por base:** multiplica el trabajo por la cantidad de bases.
- **Dijkstra inverso desde el siniestro:** también es eficiente, pero exige invertir las aristas.
- **Una biblioteca de grafos:** el reto pide implementar el algoritmo.
- **Una API de mapas:** resuelve otro problema y agrega costo y una dependencia externa.

## Consecuencias

El algoritmo no depende de HTTP y se prueba por separado. Guardar la red en una BD sería una evolución futura.
