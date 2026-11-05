# Guía para defender la solución

## Demo de 5 a 8 minutos

1. **Arquitectura (1 min).** Dos servicios, un frontend y Postgres, con un solo `docker compose up`.
2. **Traductor (2 min).** Traduce el ejemplo del PDF. En el formulario, borra `policyNumber` y muestra el aviso. En modo JSON, cambia `fechaCliente` a `12-18-2024` y muestra el 422 de la API.
3. **Extensibilidad (1 min).** Ejecuta `./scripts/demo-add-product.sh`, inicia sesión de nuevo y traduce el producto nuevo. No se tocó código.
4. **Rutas (1 min).** Calcula el ejemplo del PDF. Abre "Lima simulada" y cambia de "Menor distancia" a "Menor tiempo": la base ganadora pasa de Surco a San Isidro con el mismo algoritmo.
5. **Préstamos (2 min).** Abre `as-is.drawio` y `to-be.drawio` en su vista simple. Si piden más, pasa a la página "Detalle" y a la tabla de "La pregunta clave".

## Preguntas probables

### Hapi y Node

**¿Por qué Hapi?** Lo pedía el reto. Además, su configuración deja visibles la autenticación y la validación de cada ruta.

**¿Qué pasa si olvido proteger una ruta?** Queda protegida: `server.auth.default('jwt')` exige token en todas, salvo las marcadas con `auth: false`.

**¿Cómo es el recorrido de una solicitud?** Route (token y validación) → Controller → Service → Repository (BD), y el Mapper construye el JSON del core.

**¿Por qué no hay capas Integration ni Publisher?** El PDF pide usar solo las necesarias, y este servicio devuelve el JSON sin llamar al core ni publicar eventos.

**¿Por qué usaste IA?** Respuesta sugerida: "Tomé las decisiones de arquitectura y usé IA para acelerar la implementación. Revisé el resultado y lo validé con pruebas".

### Traductor

**¿Cómo agregas un producto sin desplegar?** Con filas nuevas en las tablas de plantillas. Hay una prueba de integración que lo demuestra.

**¿Por qué `json` y no `jsonb`?** `jsonb` reordena las claves, y el core necesita un orden determinado.

**¿Qué diferencia hay entre ausente, `null` y vacío?** El default solo se aplica si el campo está ausente. Un `""` se respeta, y un `null` en un campo obligatorio devuelve 422.

**¿Por qué validas en la web y también en la API?** La web da una respuesta inmediata, pero se puede llamar a la API sin pasar por ella. Por eso el control definitivo está en la API, y ambas usan las reglas de la plantilla.

**¿Validas que las fechas tengan sentido entre sí?** No. No conozco la regla de negocio, por ejemplo si la fecha efectiva puede ser anterior a la de solicitud, y no quise inventarla. Se validaría con el negocio y se agregaría a la plantilla.

**¿Cómo evitas romper operaciones al cambiar una plantilla?** Con versiones. Solo puede haber una activa, y la base de datos lo garantiza.

### Rutas

**¿Por qué multiorigen?** Porque una sola pasada resuelve todas las bases: O((V+E) log V).

**¿Qué pasa con un empate?** Gana la base alfabéticamente menor, para que el resultado sea siempre el mismo.

**¿Por qué pesos negativos dan error?** Dijkstra no es correcto con ellos, y una distancia negativa tampoco tiene sentido aquí.

**¿Por qué no usar Google Maps?** El reto pide implementar el algoritmo sobre un grafo. Por eso los datos pasan por un adaptador: hoy son sintéticos y luego podrían venir de Google, sin tocar Dijkstra.

**¿Esos datos son reales?** No, y la pantalla lo indica. Sirven para mostrar la arquitectura, no para asignar grúas de verdad.

**¿Por qué no pedir a Google todas las parejas de distritos?** Porque ya vendrían las rutas resueltas y Dijkstra no tendría nada que hacer. Solo se usan tramos entre vecinos.

### Seguridad

**¿Por qué RS256?** Porque el servicio de rutas solo verifica. Aunque lo comprometan, no puede emitir tokens.

**¿Qué es el ataque de confusión de algoritmo?** Firmar con HS256 usando la clave pública como secreto. Se evita fijando RS256, y hay pruebas para ello en ambos servicios.

### Préstamos

**¿Eliminas el riesgo por completo?** Sí hasta el punto que controlamos, si `admwr-api` se puede modificar. Lo que ocurra en bancos y ULTIMUS se detecta con conciliación.

**¿Y si `admwr-api` no se puede cambiar?** Se reduce el riesgo, pero no se elimina. Hay que decirlo con claridad en vez de prometer "exactamente una vez".

**¿Por qué no Kafka?** Pub/Sub resuelve la necesidad sin operar otra plataforma.

**¿Qué harías primero?** Índices únicos y control en tramas: bajo costo y efecto inmediato.

## Limitaciones que conviene decir antes de que pregunten

- El usuario demo es único y el login no limita los intentos.
- El reto 3 es un diseño; no hay código de préstamos.
- La API recibe el grafo en cada solicitud, como pide el contrato.
- La red de Lima es sintética: no incluye calles, distancias ni tráfico reales.
- No hay flujo de publicación de plantillas: se cargan por SQL.
