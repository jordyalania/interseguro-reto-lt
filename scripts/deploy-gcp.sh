#!/usr/bin/env bash
# Despliega el sistema en Cloud Run. Ver docs/despliegue-gcp.md.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${DATABASE_URL:?Define DATABASE_URL con la cadena de conexión de Neon}"
[[ -f .env ]] || { echo 'Ejecuta primero ./scripts/dev-setup.sh'; exit 1; }

env_value() { grep "^$1=" .env | cut -d= -f2-; }

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-interseguro-reto}"
TAG="${TAG:-$(date +%Y%m%d%H%M%S)}"
RUNTIME_SA="reto-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}"

[[ -n "$PROJECT_ID" ]] || { echo 'Define PROJECT_ID o configura gcloud'; exit 1; }

echo "Proyecto: $PROJECT_ID | Región: $REGION | Versión: $TAG"

echo '==> Activando APIs'
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

echo '==> Preparando el repositorio de imágenes'
gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$REPOSITORY" --location "$REGION" --repository-format docker
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo '==> Preparando la cuenta de servicio'
gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create reto-runtime --display-name 'Servicios del reto'

# Crea el secreto si falta, agrega una versión y da acceso solo a la cuenta de servicio.
put_secret() {
  local name="$1" value="$2"
  gcloud secrets describe "$name" >/dev/null 2>&1 ||
    gcloud secrets create "$name" --replication-policy automatic
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  gcloud secrets add-iam-policy-binding "$name" \
    --member "serviceAccount:${RUNTIME_SA}" \
    --role roles/secretmanager.secretAccessor >/dev/null
}

echo '==> Guardando secretos'
put_secret reto-database-url "$DATABASE_URL"
put_secret reto-jwt-private-key "$(env_value JWT_PRIVATE_KEY_B64)"
put_secret reto-demo-password "$(env_value DEMO_PASSWORD)"

echo '==> Publicando imágenes'
build() {
  docker buildx build --platform linux/amd64 --push -t "${REGISTRY}/$1:${TAG}" "$2"
}
build endorsement-api services/endorsement-api
build routing-api services/routing-api
build web apps/web

PUBLIC_KEY="$(env_value JWT_PUBLIC_KEY_B64)"
COMMON_FLAGS=(
  --region "$REGION"
  --service-account "$RUNTIME_SA"
  --allow-unauthenticated
  --min-instances 0
  --max-instances 2
  --memory 512Mi
  --cpu 1
  --quiet
)

echo '==> Aplicando migraciones'
gcloud run jobs deploy endorsement-migrate \
  --image "${REGISTRY}/endorsement-api:${TAG}" \
  --region "$REGION" \
  --service-account "$RUNTIME_SA" \
  --command node \
  --args dist/database/migrate.js \
  --set-secrets DATABASE_URL=reto-database-url:latest \
  --max-retries 0 \
  --quiet
gcloud run jobs execute endorsement-migrate --region "$REGION" --wait

echo '==> Desplegando las APIs'
gcloud run deploy endorsement-api \
  --image "${REGISTRY}/endorsement-api:${TAG}" \
  "${COMMON_FLAGS[@]}" \
  --set-env-vars "NODE_ENV=production,JWT_PUBLIC_KEY_B64=${PUBLIC_KEY},DEMO_USERNAME=$(env_value DEMO_USERNAME)" \
  --set-secrets "DATABASE_URL=reto-database-url:latest,JWT_PRIVATE_KEY_B64=reto-jwt-private-key:latest,DEMO_PASSWORD=reto-demo-password:latest"

gcloud run deploy routing-api \
  --image "${REGISTRY}/routing-api:${TAG}" \
  "${COMMON_FLAGS[@]}" \
  --memory 256Mi \
  --set-env-vars "JWT_PUBLIC_KEY_B64=${PUBLIC_KEY}"

service_url() { gcloud run services describe "$1" --region "$REGION" --format 'value(status.url)'; }

echo '==> Desplegando el frontend'
gcloud run deploy web \
  --image "${REGISTRY}/web:${TAG}" \
  "${COMMON_FLAGS[@]}" \
  --memory 256Mi \
  --set-env-vars "ENDORSEMENT_API_URL=$(service_url endorsement-api),ROUTING_API_URL=$(service_url routing-api),NGINX_RESOLVER=169.254.169.254"

echo "Listo: $(service_url web)"
