# ADR 0005: Préstamos asíncronos con idempotencia en dos niveles

**Estado:** propuesta

## Contexto

El proxy de INARI responde 502 mientras `admwr-api` sigue procesando. El cliente reintenta y se generan desembolsos duplicados.

## Decisión

Responder `202`, procesar mediante outbox, Pub/Sub y un worker, y controlar duplicados tanto en `portal-db` como en TAURO. Un resultado incierto pasa a `UNKNOWN` y se concilia. Detalle en [prestamos-to-be.md](../prestamos-to-be.md).

## Alternativas descartadas

- **Aumentar los timeouts:** reduce los 502, pero no elimina la duplicidad.
- **Bloquear el botón en el frontend:** ayuda, pero no cubre otra pestaña ni fallos de red.
- **Idempotencia solo en la Zona Segura:** no protege si el worker reenvía tras un timeout.
- **Kafka:** agrega operación y costo sin una necesidad real en este volumen.
- **Reescribir INARI:** demasiado costo y riesgo para resolver este problema.

## Consecuencias

- El cliente ve "en proceso" en vez de una confirmación inmediata.
- Se requieren cambios en `admwr-api` y `ultimus-api`.
- Operaciones necesita una bandeja para los casos no resueltos.
