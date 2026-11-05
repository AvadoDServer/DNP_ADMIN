#!/bin/sh
# Checks the Admin's startup helper for bind: it must leave a running bind
# alone when that bind runs the image its compose file names, and run
# `docker-compose ... bind ... up -d` otherwise (stopped, other image, missing
# container or unreadable compose file). Runs build/entrypoint.sh in the
# image's own base with `docker`, `node` and `sleep` replaced by stubs.
# Usage: sh build/test-entrypoint-bind.sh   (needs Docker)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
IMG=nginx:1.23.1-alpine
FAIL=0

# $1 case name, $2 compose file text ("" = unreadable), $3 docker inspect
# answer ("" = no container), $4 expected: up | skip
run_case() {
  STUBS=$(mktemp -d)
  printf '%s' "$2" > "$STUBS/compose.yml"
  printf '%s' "$3" > "$STUBS/inspect.txt"
  cat > "$STUBS/docker" <<'STUB'
#!/bin/sh
case "$*" in
  *"cat /dncore/docker-compose-bind.yml"*) [ -s /stubs/compose.yml ] && cat /stubs/compose.yml || exit 1 ;;
  "inspect "*) [ -s /stubs/inspect.txt ] && { cat /stubs/inspect.txt; echo; } || exit 1 ;;
  *"docker-compose-bind.yml up -d"*) echo "$*" >> /tmp/bind-up.log ;;
  *) exit 0 ;;
esac
STUB
  printf '#!/bin/sh\nexit 0\n' > "$STUBS/node"
  printf '#!/bin/sh\n[ "$1" = infinity ] && exec /bin/sleep 600\nexit 0\n' > "$STUBS/sleep"
  chmod +x "$STUBS/docker" "$STUBS/node" "$STUBS/sleep"
  NAME=admin-entrypoint-bind-test
  docker rm -f $NAME >/dev/null 2>&1 || true
  docker run -d --name $NAME -v "$HERE/entrypoint.sh:/usr/src/app/entrypoint.sh:ro" -v "$STUBS:/stubs:ro" -e PATH=/stubs:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin --entrypoint /bin/sh $IMG /usr/src/app/entrypoint.sh >/dev/null
  /bin/sleep 3
  GOT=skip
  docker exec $NAME sh -c 'test -s /tmp/bind-up.log' 2>/dev/null && GOT=up
  docker rm -f $NAME >/dev/null 2>&1; rm -rf "$STUBS"
  if [ "$GOT" = "$4" ]; then echo "PASS $1 ($GOT)"; else echo "FAIL $1: expected $4, got $GOT"; FAIL=1; fi
}

YML="version: '3.4'
services:
    bind.dnp.dappnode.eth:
        container_name: DAppNodeCore-bind.dnp.dappnode.eth
        image: 'bind.dnp.dappnode.eth:10.0.20'
        restart: always
"
run_case "running, same image" "$YML" "true bind.dnp.dappnode.eth:10.0.20" skip
run_case "running, other image" "$YML" "true bind.dnp.dappnode.eth:10.0.19" up
run_case "stopped" "$YML" "false bind.dnp.dappnode.eth:10.0.20" up
run_case "no container" "$YML" "" up
run_case "compose file unreadable" "" "true bind.dnp.dappnode.eth:10.0.20" up
exit $FAIL
