#!/usr/bin/env bash
# Genera un .env local con secretos aleatorios y un par de claves RS256.
# No sobrescribe un .env existente.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  echo ".env ya existe; no se modifica."
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$tmp/private.pem" 2>/dev/null
openssl pkey -in "$tmp/private.pem" -pubout -out "$tmp/public.pem" 2>/dev/null

demo_password="$(openssl rand -hex 12)"

umask 077
cat > .env <<EOF
POSTGRES_DB=endorsements
POSTGRES_USER=endorsements
POSTGRES_PASSWORD=$(openssl rand -hex 16)
DEMO_USERNAME=demo
DEMO_PASSWORD=${demo_password}
JWT_PRIVATE_KEY_B64=$(base64 < "$tmp/private.pem" | tr -d '\n')
JWT_PUBLIC_KEY_B64=$(base64 < "$tmp/public.pem" | tr -d '\n')
EOF

echo ".env creado."
echo "Usuario demo: demo"
echo "Contraseña demo: ${demo_password}"
