# ADR 0006: Proveedor de rutas simulado

**Estado:** aceptada

## Contexto

Una red parecida a Lima hace más interesante la demo, pero conectar Google Maps exige una clave y facturación, además de crear una dependencia externa durante la presentación.

## Decisión

Usar datos sintéticos con forma parecida a Google Routes, detrás de la interfaz `RouteDataProvider`. Un adaptador convierte esa respuesta en el grafo que ya recibe la API.

- La pantalla indica que los datos son simulados.
- Solo hay tramos entre distritos vecinos. Con todas las parejas, las rutas ya vendrían resueltas y Dijkstra no aportaría nada.
- El peso puede ser distancia o tiempo, sin cambiar el algoritmo.

## Alternativas descartadas

- **Google Maps real:** requiere clave y facturación, y agrega un punto de fallo a la demo.
- **Pedir la ruta a Google:** el evaluador vería que el problema lo resuelve otro.
- **Un endpoint nuevo en Go:** obligaría a cambiar el contrato que define el reto.

## Consecuencias

- Pasar a Google real solo requiere otro proveedor, y conviene hacerlo desde un backend para proteger la clave.
- Los nombres de los campos deben verificarse con la documentación de Google antes de conectarlo.
- La red no sirve para decisiones reales.
