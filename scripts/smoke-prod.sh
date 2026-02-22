#!/usr/bin/env bash
# Smoke tests for NightDrive production. Run after deploy.
# Usage: BASE=https://nightdrive.store ./scripts/smoke-prod.sh

set -e
BASE="${BASE:-https://nightdrive.store}"

echo "Smoke tests for $BASE"
echo "---"

# 1. Health returns 200 and JSON
echo -n "GET /health ... "
code=$(curl -s -o /tmp/health.json -w "%{http_code}" "$BASE/health")
if [ "$code" != "200" ]; then echo "FAIL ($code)"; exit 1; fi
if ! grep -q '"status"' /tmp/health.json; then echo "FAIL (no status)"; exit 1; fi
echo "OK"

# 2. CORS: evil origin must NOT get ACAO
echo -n "CORS evil origin ... "
acao=$(curl -s -i -H "Origin: https://evil.example" "$BASE/api/readiness" 2>/dev/null | grep -i "access-control-allow-origin" || true)
if echo "$acao" | grep -q "evil.example"; then echo "FAIL (reflected evil origin)"; exit 1; fi
echo "OK"

# 3. HTTP redirects to HTTPS (when testing via proxy)
echo -n "HTTP→HTTPS redirect ... "
if [[ "$BASE" == https* ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -I "http://nightdrive.store/" 2>/dev/null || echo "000")
  if [ "$code" = "301" ] || [ "$code" = "308" ]; then echo "OK"; else echo "SKIP (code=$code, check proxy)"; fi
else
  echo "SKIP (BASE not https)"
fi

# 4. Readiness (if implemented)
echo -n "GET /api/readiness ... "
code=$(curl -s -o /tmp/ready.json -w "%{http_code}" "$BASE/api/readiness")
if [ "$code" != "200" ] && [ "$code" != "503" ]; then echo "FAIL ($code)"; exit 1; fi
if ! grep -q '"checks"' /tmp/ready.json; then echo "FAIL (no checks)"; exit 1; fi
echo "OK ($code)"

# 5. Admin without token → 401
echo -n "GET /api/admin/stats (no auth) ... "
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/stats")
if [ "$code" != "401" ]; then echo "FAIL ($code)"; exit 1; fi
echo "OK"

# 6. API inventory (or home) returns 200
echo -n "GET /api/home-feed ... "
code=$(curl -s -o /tmp/feed.json -w "%{http_code}" "$BASE/api/home-feed")
if [ "$code" != "200" ]; then echo "FAIL ($code)"; exit 1; fi
echo "OK"

echo "---"
echo "Smoke passed."
