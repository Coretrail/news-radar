#!/bin/sh
set -eu
set -f
: "${ALLOWED_NETWORKS:=all}"
: "${API_UPSTREAM:=api:3001}"
: "${STATIC_ROOT:=/usr/share/nginx/html}"
: "${NGINX_LISTEN:=8080}"
: "${NGINX_SERVER_NAME:=_}"
case "$API_UPSTREAM" in *[!a-zA-Z0-9.:-]*|'') echo 'Invalid API_UPSTREAM' >&2; exit 1;; esac
# No shell evaluation of values: permit only IP/CIDR characters or explicit 'all'.
ALLOW_RULES=''
for network in $ALLOWED_NETWORKS; do
  if [ "$network" != all ]; then
    case "$network" in *[!0-9a-fA-F.:/]*|'') echo 'Invalid ALLOWED_NETWORKS' >&2; exit 1;; esac
  fi
  ALLOW_RULES="$ALLOW_RULES allow $network;"
done
[ -n "$ALLOW_RULES" ] || { echo 'ALLOWED_NETWORKS must not be empty' >&2; exit 1; }
export API_UPSTREAM STATIC_ROOT NGINX_LISTEN NGINX_SERVER_NAME ALLOW_RULES
envsubst '$API_UPSTREAM $STATIC_ROOT $NGINX_LISTEN $NGINX_SERVER_NAME $ALLOW_RULES' < /opt/news-radar/default.conf.template > /etc/nginx/conf.d/default.conf
