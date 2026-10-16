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
  timeout 300 docker run --rm --privileged  --net=host --pid=host --ipc=host --volume /:/host  busybox  chroot /host /bin/bash -c "docker-compose -f /usr/src/dappnode/DNCORE/docker-compose-dappmanager.yml up -d"
  timeout 300 docker run --rm --privileged  --net=host --pid=host --ipc=host --volume /:/host  busybox  chroot /host /bin/bash -c "docker-compose -f /usr/src/dappnode/DNCORE/docker-compose-bind.yml up -d"
) &
HELPERS=$!

# Backgrounded so the trap above can run while we wait
sleep infinity &
wait $!
