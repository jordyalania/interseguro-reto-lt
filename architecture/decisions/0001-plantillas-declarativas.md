# ADR 0001: Plantillas declarativas en PostgreSQL

**Estado:** aceptada

## Contexto

La salida para el core cambia según producto y tipo de endoso. Agregar un producto no debe requerir cambios de código, y el orden de los campos importa.

## Decisión

- Tablas relacionales para lo que el reto pide consultar y ordenar: `template_dynamic_fields` y `template_events`.
- Un esqueleto `output_skeleton` para la forma del documento, con directivas como `{"$input": "moneda"}`.
- La columna es `json`, no `jsonb`, porque `jsonb` reordena las claves.
- La versión activa se protege con un índice único parcial.

## Alternativas descartadas

- **Código por producto:** cada producto obliga a desplegar.
- **Guardar JavaScript en la BD:** ejecutar código almacenado es un riesgo de seguridad y dificulta las pruebas.
- **Solo tablas, una por cada nodo del JSON:** muchas tablas y consultas para una forma que se lee completa.
- **Solo un JSON grande:** se pierden las restricciones de BD sobre orden y duplicados.

## Consecuencias

- Un producto nuevo es un script SQL, como demuestra una prueba de integración.
- Un esqueleto incorrecto se detecta al traducir y responde `TEMPLATE_MISCONFIGURED`. Un flujo de publicación con validación queda como mejora futura.
