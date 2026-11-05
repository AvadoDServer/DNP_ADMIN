#!/bin/sh
# Turns on (or refreshes) the Admin's secure address https://admin.my.ava.do.
#
# The DAPPMANAGER fetches the box's *.my.ava.do certificate from iso.ava.do
# every day and serves it at http://dappmanager.my.ava.do (the same place
# AVADO packages with https get it). This script copies it into nginx when it
# is valid and new, writes the https server and reloads nginx. If anything is
# wrong (no DAPPMANAGER yet, a bad or old certificate, nginx -t fails) the
# https server stays as it was, or off, and http://my.ava.do is untouched.
#
# Exit 0: the secure address is on and current. Exit 1: try again later.

SRC=http://dappmanager.my.ava.do
DIR=/etc/nginx/certs
CONF_DIR=/etc/nginx/https.d
CONF=$CONF_DIR/admin-https.conf
TEMPLATE=/etc/nginx/https.conf.template

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

wget -q -T 20 -O "$TMP/crt" "$SRC/my.ava.do.crt" 2>/dev/null || { echo "https: certificate not reachable yet"; exit 1; }
wget -q -T 20 -O "$TMP/key" "$SRC/my.ava.do.key" 2>/dev/null || { echo "https: key not reachable yet"; exit 1; }
node /usr/src/app/check-cert.js "$TMP/crt" "$TMP/key" || exit 1

if [ -f "$CONF" ] && cmp -s "$TMP/crt" "$DIR/my.ava.do.crt" && cmp -s "$TMP/key" "$DIR/my.ava.do.key"; then
  exit 0
fi

mkdir -p "$DIR" "$CONF_DIR"
chmod 700 "$DIR"
# Keep the files in use until the new ones pass nginx -t
[ -f "$DIR/my.ava.do.crt" ] && cp "$DIR/my.ava.do.crt" "$TMP/old.crt"
[ -f "$DIR/my.ava.do.key" ] && cp "$DIR/my.ava.do.key" "$TMP/old.key"
HAD_CONF=0
[ -f "$CONF" ] && HAD_CONF=1

install -m 644 "$TMP/crt" "$DIR/my.ava.do.crt"
install -m 600 "$TMP/key" "$DIR/my.ava.do.key"
cp "$TEMPLATE" "$CONF"

if nginx -t -q 2>"$TMP/nginx-t"; then
  nginx -s reload
  echo "https: secure address https://admin.my.ava.do is on"
  exit 0
fi

echo "https: nginx refused the secure address: $(cat "$TMP/nginx-t")"
if [ -f "$TMP/old.crt" ] && [ "$HAD_CONF" = 1 ]; then
  install -m 644 "$TMP/old.crt" "$DIR/my.ava.do.crt"
  install -m 600 "$TMP/old.key" "$DIR/my.ava.do.key"
else
  rm -f "$CONF" "$DIR/my.ava.do.crt" "$DIR/my.ava.do.key"
fi
exit 1
