#!/bin/sh
# Writes /usr/share/nginx/html/config.js from environment variables at container
# start, so a single prebuilt image can be configured per-environment at run
# time. The official nginx image runs executable scripts in
# /docker-entrypoint.d/*.sh before starting nginx.
#
# Env vars (all optional):
#   CONNECTLENS_AUTH_ENABLED   "true" | "false"   (default: true)
#   CONNECTLENS_OIDC_AUTHORITY OIDC realm URL      (default: http://localhost:8081/realms/connectlens)
#   CONNECTLENS_OIDC_CLIENT_ID OIDC client id      (default: connectlens-frontend)
#   CONNECTLENS_API_BASE       API base URL        (default: empty = same-origin)
set -eu

TARGET="/usr/share/nginx/html/config.js"

# Normalise auth flag to the unquoted JS boolean token `true`/`false`.
# Anything other than a case-insensitive "false" resolves to true (default on).
if [ "$(printf '%s' "${CONNECTLENS_AUTH_ENABLED:-true}" | tr '[:upper:]' '[:lower:]')" = "false" ]; then
  AUTH_ENABLED="false"
else
  AUTH_ENABLED="true"
fi

OIDC_AUTHORITY="${CONNECTLENS_OIDC_AUTHORITY:-http://localhost:8081/realms/connectlens}"
OIDC_CLIENT_ID="${CONNECTLENS_OIDC_CLIENT_ID:-connectlens-frontend}"
API_BASE="${CONNECTLENS_API_BASE:-}"

cat > "$TARGET" <<EOF
window.__CONNECTLENS_CONFIG__ = { authEnabled: ${AUTH_ENABLED}, oidc: { authority: "${OIDC_AUTHORITY}", client_id: "${OIDC_CLIENT_ID}" }, apiBase: "${API_BASE}" };
EOF

echo "connectlens: wrote ${TARGET} (authEnabled=${AUTH_ENABLED})"
