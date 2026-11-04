#!/bin/sh

# This script is PID 1, so it must handle the container's stop signal itself.
# The nginx base image declares STOPSIGNAL SIGQUIT, so `docker stop` (and
# every package update) sends QUIT, not TERM: a trap on TERM alone never
# fired, and each Admin update waited the full docker stop timeout (180 s)
# before the old container was killed. A shell also runs a trap only once the
# foreground command it is waiting on has ended, so every helper below runs
# in the background and PID 1 goes straight to `wait`, which the trap
# interrupts at once even while a helper hangs (e.g. no DNS after a reboot).
HELPERS=""
trap 'nginx -s quit 2>/dev/null; [ -n "$HELPERS" ] && kill $HELPERS 2>/dev/null; exit 0' QUIT TERM INT

# start admin UI
nginx -c /etc/nginx/nginx.conf

# Startup helpers (bounded so a hang can never pin this container):
# - update the dappmanager if needed
# - and load the correct version of it if needed (no-op when already done)
# - restart bind if not running
(
  # wait for things to settle
  sleep 10
  DAPPMANAGER_VERSION=`docker ps | grep DAppNodeCore-dappmanager.dnp.dappnode.eth | sed -n 's/^.*:\([^ ]*\).*$/\1/p'` timeout 300 node /launchcmd/index.js
  sleep 10
  # docker-compose 1.x cannot recreate a container on Docker 26 and newer
  # (API 1.45+): image details lack "ContainerConfig" and it stops halfway
  # with the old container renamed and the new one never created, which
  # leaves the DAPPMANAGER down. Pin compose to API 1.41 on such engines only;
  # Docker 20.10 hosts (API 1.41) run the same command as before.
  COMPOSE_ENV=""
  case "$(timeout 30 docker version --format '{{.Server.APIVersion}}' 2>/dev/null)" in
    1.4[5-9]|1.[5-9][0-9]|1.[1-9][0-9][0-9]) COMPOSE_ENV="COMPOSE_API_VERSION=1.41 " ;;
  esac
  timeout 300 docker run --rm --privileged  --net=host --pid=host --ipc=host --volume /:/host  busybox  chroot /host /bin/bash -c "${COMPOSE_ENV}docker-compose -f /usr/src/dappnode/DNCORE/docker-compose-dappmanager.yml up -d"
  timeout 300 docker run --rm --privileged  --net=host --pid=host --ipc=host --volume /:/host  busybox  chroot /host /bin/bash -c "${COMPOSE_ENV}docker-compose -f /usr/src/dappnode/DNCORE/docker-compose-bind.yml up -d"
) &
HELPERS=$!

# Backgrounded so the trap above can run while we wait
sleep infinity &
wait $!
