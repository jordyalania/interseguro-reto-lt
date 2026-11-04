#!/usr/bin/env bash
# Prueba el sistema levantado de punta a punta, a través del frontend (nginx).
# Uso: ./scripts/smoke-test.sh [URL_BASE]
# DEMO_PASSWORD se toma del entorno o, si no está, de .env.
set -euo pipefail

cd "$(dirname "$0")/.."
BASE_URL="${1:-http://127.0.0.1:8088}"

if [[ -z "${DEMO_PASSWORD:-}" && -f .env ]]; then
  DEMO_PASSWORD="$(grep '^DEMO_PASSWORD=' .env | cut -d= -f2-)"
fi
: "${DEMO_PASSWORD:?Define DEMO_PASSWORD}"
DEMO_USERNAME="${DEMO_USERNAME:-demo}"

failures=0

# check NOMBRE ESTADO_ESPERADO METODO RUTA [CUERPO] [TOKEN]
check() {
  local name="$1" expected="$2" method="$3" path="$4" body="${5:-}" token="${6:-}"
  local args=(-s -o /tmp/smoke-body.$$ -w '%{http_code}' -X "$method" "$BASE_URL$path")
  [[ -n "$body" ]] && args+=(-H 'Content-Type: application/json' -d "$body")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")

  local status
  status="$(curl "${args[@]}")"
  if [[ "$status" == "$expected" ]]; then
    echo "ok    $name ($status)"
  else
    echo "FALLO $name: se esperaba $expected y llegó $status"
    cat /tmp/smoke-body.$$; echo
    failures=$((failures + 1))
  fi
}

ENDORSEMENT='{"policyNumber":"08200000049","idEnvio":5984,"frecuencia":"Semestral","tipoEndoso":"CambioFrecuencia","producto":"Rumbo","plan":"PlanRumbo","moneda":"Nuevo Sol","usuario":"interface.servicios","fechaSolicitud":"2025-08-27","fechaCliente":"2025-08-27","fechaEfectiva":"2025-09-01"}'
ROUTE='{"accidentLocation":"San Isidro","depots":["Miraflores","Ate"],"graph":{"Miraflores":{"San Isidro":7,"Barranco":3},"San Isidro":{"Miraflores":7,"Lince":4},"Barranco":{"Miraflores":3,"Surco":5},"Lince":{"San Isidro":4,"Surco":6},"Surco":{"Barranco":5,"Lince":6,"Ate":10},"Ate":{"Surco":10}}}'
UNREACHABLE='{"accidentLocation":"C","depots":["A"],"graph":{"A":{"B":1},"B":{},"C":{}}}'

check 'frontend' 200 GET /
check 'traducción sin token' 401 POST /api/v1/endorse/translate "$ENDORSEMENT"
check 'rutas sin token' 401 POST /api/v1/routes/optimal "$ROUTE"
check 'login incorrecto' 401 POST /api/v1/auth/login '{"username":"demo","password":"incorrecta"}'

TOKEN="$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$DEMO_USERNAME\",\"password\":\"$DEMO_PASSWORD\"}" \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
[[ -n "$TOKEN" ]] || { echo 'FALLO login: no se obtuvo token'; exit 1; }
echo 'ok    login'

check 'plantillas' 200 GET /api/v1/endorse/templates '' "$TOKEN"
check 'traducción' 200 POST /api/v1/endorse/translate "$ENDORSEMENT" "$TOKEN"
translated="$(cat /tmp/smoke-body.$$)"
check 'sin plantilla' 404 POST /api/v1/endorse/translate '{"producto":"X","tipoEndoso":"Y"}' "$TOKEN"
INVALID_DATE="${ENDORSEMENT/\"fechaCliente\":\"2025-08-27\"/\"fechaCliente\":\"12-18-2024\"}"
check 'fecha inválida' 422 POST /api/v1/endorse/translate "$INVALID_DATE" "$TOKEN"
check 'campos faltantes' 422 POST /api/v1/endorse/translate '{"producto":"Rumbo","tipoEndoso":"CambioFrecuencia"}' "$TOKEN"
check 'ruta óptima' 200 POST /api/v1/routes/optimal "$ROUTE" "$TOKEN"
routed="$(cat /tmp/smoke-body.$$)"
check 'siniestro inalcanzable' 422 POST /api/v1/routes/optimal "$UNREACHABLE" "$TOKEN"

# El token emitido por Node también lo acepta Go: la clave compartida es solo la pública.
if [[ "$routed" == '{"fromDepot":"Miraflores","to":"San Isidro","path":["Miraflores","San Isidro"],"distance":7}' ]]; then
  echo 'ok    la ruta coincide con el PDF'
else
  echo "FALLO la ruta no coincide: $routed"
  failures=$((failures + 1))
fi

if [[ "$translated" == '{"policyNumber":"08200000049","idEnvio":5984,"financialPlansEntity":{"description":"Semestral"},"currency":{"description":"Nuevo Sol"},"productEntity":{"description":"Rumbo"},"eventEntity":{"description":"SolicitarEndoso","dynamicData":[{"etiqueta":"ProductosVida","value":"Rumbo"},'* ]]; then
  echo 'ok    la traducción conserva el orden del PDF'
else
  echo "FALLO la traducción no coincide: $translated"
  failures=$((failures + 1))
fi

rm -f /tmp/smoke-body.$$
if [[ "$failures" -gt 0 ]]; then
  echo "$failures comprobaciones fallaron"
  exit 1
fi
echo 'Todas las comprobaciones pasaron.'
