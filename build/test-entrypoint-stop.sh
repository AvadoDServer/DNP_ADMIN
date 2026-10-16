#!/bin/sh
# Checks that the Admin container stops promptly on SIGTERM even while its
# startup helpers (node launchcmd, docker-compose helpers) are still running
# or hanging. Runs build/entrypoint.sh in the image's own base with `node`
# and `docker` replaced by stubs that block for 100 s.
# Usage: sh build/test-entrypoint-stop.sh   (needs Docker)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
IMG=nginx:1.23.1-alpine
NAME=admin-entrypoint-stop-test
STUBS=$(mktemp -d)
printf '#!/bin/sh\nsleep 100\n' > "$STUBS/node"; cp "$STUBS/node" "$STUBS/docker"; chmod +x "$STUBS/node" "$STUBS/docker"
docker rm -f $NAME >/dev/null 2>&1 || true
docker run -d --name $NAME -v "$HERE/entrypoint.sh:/usr/src/app/entrypoint.sh:ro" -v "$STUBS:/stubs:ro" -e PATH=/stubs:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin --entrypoint /bin/sh $IMG /usr/src/app/entrypoint.sh >/dev/null
sleep 3
START=$(date +%s)
docker stop -t 8 $NAME >/dev/null
END=$(date +%s)
EXIT=$(docker inspect -f '{{.State.ExitCode}}' $NAME)
TOOK=$((END-START))
docker rm -f $NAME >/dev/null 2>&1; rm -rf "$STUBS"
echo "stop took ${TOOK}s, exit code ${EXIT}"
if [ "$EXIT" = "0" ] && [ "$TOOK" -le 3 ]; then echo PASS; else echo "FAIL: expected exit 0 within 3 s (SIGTERM must stop the container while startup helpers run)"; exit 1; fi
