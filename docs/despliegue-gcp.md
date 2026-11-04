# Despliegue en GCP

Publica las imágenes en Artifact Registry y despliega las tres aplicaciones en Cloud Run. La base de datos vive en Neon.

> Este procedimiento todavía no se ha ejecutado contra una cuenta real. Confirma también los límites vigentes en [la capa gratuita de Google Cloud](https://cloud.google.com/free) y [los planes de Neon](https://neon.com/pricing).

## Antes de empezar

1. Crea un proyecto de GCP con facturación activa. Google pide una tarjeta aunque te mantengas dentro de la capa gratuita.
2. Crea una [alerta de presupuesto](https://cloud.google.com/billing/docs/how-to/budgets) baja.
3. Crea un proyecto en [Neon](https://neon.com) y copia su cadena de conexión con `sslmode=require`.
4. Instala la CLI de `gcloud` e inicia sesión:

```bash
gcloud auth login
```

```bash
gcloud config set project TU_PROYECTO
```

## Desplegar

Genera antes el archivo `.env` con `./scripts/dev-setup.sh`. El script toma de ahí las claves JWT y la contraseña demo, y solo pide la URL de Neon:

```bash
DATABASE_URL='postgres://...neon.tech/...?sslmode=require' ./scripts/deploy-gcp.sh
```

El script es idempotente y hace lo siguiente:

1. Activa las APIs y crea el repositorio de imágenes.
2. Crea una cuenta de servicio sin permisos de más.
3. Guarda los secretos en Secret Manager.
4. Compila las imágenes para `linux/amd64`, porque tu Mac es ARM.
5. Aplica migraciones y seeds con un Cloud Run Job.
6. Despliega las APIs y luego el frontend, con `min-instances=0`.

Al terminar, imprime la URL pública.

## Comprobar

```bash
DEMO_PASSWORD='tu-contraseña' ./scripts/smoke-test.sh https://TU-URL-DEL-FRONTEND
```

## Tener en cuenta

- La primera visita tras un periodo inactivo puede tardar varios segundos. Abre la demo unos minutos antes de presentarla.
- Conserva pocas imágenes en Artifact Registry, porque su almacenamiento gratuito es limitado.
- Para eliminar todo lo creado, borra el proyecto de GCP y el proyecto de Neon.
