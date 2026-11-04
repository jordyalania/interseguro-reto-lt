# Cómo funciona Dijkstra

No evalúa todas las combinaciones ni elige simplemente la calle más corta. **Siempre sigue explorando desde el lugar con menor distancia total acumulada desde el origen.**

## Por qué no basta elegir la calle más corta

```text
A → B = 1    B → D = 100
A → C = 5    C → D = 1
```

- La calle más corta en cada paso lleva a A → B → D = 101.
- Dijkstra compara los totales y encuentra A → C → D = 6.

## Ejemplo del PDF

Las bases empiezan juntas con distancia 0: es la versión multiorigen.

| Paso | Lugar más cercano | Qué descubre |
| --- | --- | --- |
| 1 | Ate (0) | Surco = 10 |
| 2 | Miraflores (0) | Barranco = 3, San Isidro = 7 |
| 3 | Barranco (3) | Surco = 8, que mejora al 10 anterior |
| 4 | San Isidro (7) | Es el accidente: termina |

Puede parar porque lo pendiente está a 7 o más y no hay distancias negativas: ningún otro camino podría ser más corto.

## Decisiones de implementación

Están en [dijkstra.go](../services/routing-api/internal/graph/dijkstra.go).

- **Cola de prioridad:** obtiene rápido el lugar más cercano. Complejidad: O((V+E) log V).
- **Parada temprana:** termina al llegar al accidente.
- **Resultado estable:** en un empate gana la base alfabéticamente menor, y los vecinos se ordenan.

## Alternativas descartadas

| Alternativa | Por qué no |
| --- | --- |
| Fuerza bruta | El número de caminos se dispara al crecer la red |
| Un Dijkstra por base | Funciona, pero repite trabajo |
| Dijkstra inverso | Válido, pero exige invertir las calles |
| BFS | Ignora las distancias |
| Bellman-Ford | Es más lento y aquí no hay negativas |
| Floyd-Warshall | Excesivo si el grafo llega en cada solicitud |
| A* | Requiere coordenadas, que el contrato del PDF no trae |
