# ADR 0004: Cloud Run y Neon para la demo

**Estado:** aceptada

## Contexto

El reto pide una nube con capa gratuita, de preferencia GCP o AWS. El sistema descrito en el reto ya usa Cloud Run.

## Decisión

Las tres aplicaciones van en Cloud Run con `min-instances=0`, y los datos en el plan gratuito de Neon.

## Alternativas descartadas

- **Cloud SQL:** no tiene capa gratuita permanente.
- **AWS:** el plan gratuito para cuentas nuevas se basa en créditos y vence, un riesgo para una demo que se revisará después.
- **Postgres en una VM e2-micro:** todo queda en GCP, pero suma mantenimiento y copias de seguridad.
- **Un servidor propio:** funciona, pero no cumple lo que pide el reto.

## Consecuencias

- La primera visita tras un periodo inactivo tarda más, porque los servicios y la base se despiertan.
- La base queda fuera de GCP. En producción se usaría Cloud SQL con red privada.
- Los límites gratuitos pueden cambiar; deben confirmarse antes de desplegar.
