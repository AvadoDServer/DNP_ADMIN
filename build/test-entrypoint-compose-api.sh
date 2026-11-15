#!/bin/sh
# Checks that the Admin's startup helper pins docker-compose to API 1.41 on
# Docker 26 and newer (API 1.45+, AVADO OS 2), where docker-compose 1.x cannot
# recreate a container, and runs the same command as before on Docker 20.10
# (API 1.41) or when the engine does not answer. Runs build/entrypoint.sh in
# the image's own base with `docker`, `node` and `sleep` replaced by stubs.
# Usage: sh build/test-entrypoint-compose-api.sh   (needs Docker)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
IMG=nginx:1.23.1-alpine
FAIL=0

# $1 case name, $2 engine API version ("" = no answer), $3 expected: pinned | plain
run_case() {
  STUBS=$(mktemp -d)
  printf '%s' "$2" > "$STUBS/api.txt"
  cat > "$STUBS/docker" <<'STUB'
#!/bin/sh
case "$*" in
  "version --format"*) [ -s /stubs/api.txt ] && { cat /stubs/api.txt; echo; } || exit 1 ;;
  *"up -d"*) echo "$*" >> /tmp/compose-up.log ;;
  *) exit 1 ;;
esac
STUB
  printf '#!/bin/sh\nexit 0\n' > "$STUBS/node"
  printf '#!/bin/sh\n[ "$1" = infinity ] && exec /bin/sleep 600\nexit 0\n' > "$STUBS/sleep"
  chmod +x "$STUBS/docker" "$STUBS/node" "$STUBS/sleep"
  NAME=admin-entrypoint-compose-api-test
  docker rm -f $NAME >/dev/null 2>&1 || true
  docker run -d --name $NAME -v "$HERE/entrypoint.sh:/usr/src/app/entrypoint.sh:ro" -v "$STUBS:/stubs:ro" -e PATH=/stubs:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin --entrypoint /bin/sh $IMG /usr/src/app/entrypoint.sh >/dev/null
  /bin/sleep 3
  LOG=$(docker exec $NAME cat /tmp/compose-up.log 2>/dev/null || true)
  docker rm -f $NAME >/dev/null 2>&1; rm -rf "$STUBS"
  # Both the DAPPMANAGER and the bind line must run, both pinned or both plain.
  UPS=$(printf '%s\n' "$LOG" | grep -c "docker-compose -f" || true)
  PINNED=$(printf '%s\n' "$LOG" | grep -c "COMPOSE_API_VERSION=1.41 docker-compose -f" || true)
  if [ "$UPS" != 2 ]; then GOT="$UPS compose runs"
  elif [ "$PINNED" = 2 ]; then GOT=pinned
  elif [ "$PINNED" = 0 ]; then GOT=plain
  else GOT="mixed"; fi
  if [ "$GOT" = "$3" ]; then echo "PASS $1 ($GOT)"; else echo "FAIL $1: expected $3, got $GOT"; printf '%s\n' "$LOG"; FAIL=1; fi
}

run_case "Docker 20.10 (API 1.41)" "1.41" plain
run_case "Docker 25 (API 1.44)" "1.44" plain
run_case "Docker 26 (API 1.45)" "1.45" pinned
run_case "Docker 29 (API 1.52)" "1.52" pinned
run_case "engine does not answer" "" plain
exit $FAIL
