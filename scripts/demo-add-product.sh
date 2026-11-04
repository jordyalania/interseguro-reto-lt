#!/usr/bin/env bash
# Agrega VidaAhorro / CambioMoneda a la base en ejecución, solo con SQL.
# Recarga el frontend después: la plantilla nueva aparece sin desplegar nada.
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < services/endorsement-api/database/examples/add_product_vida_cambio_moneda.sql
echo 'Plantilla VidaAhorro / CambioMoneda disponible.'
