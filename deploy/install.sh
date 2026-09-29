#!/usr/bin/env bash
# Installs or updates a public measurement server on a Debian or Ubuntu VPS.
#
# First install (as root, with DNS for DOMAIN already pointing at this machine):
#
#   curl -fsSL https://raw.githubusercontent.com/emmalegrottaglie/terminal-speedtest/main/deploy/install.sh \
#     | sudo DOMAIN=fra-01.example.org SERVER_NAME=fra-01 SERVER_LOCATION="NUREMBERG, DE" bash
#
# Optional: RTC_PORT (default 40000), STUN_URL (needed on Oracle Cloud and AWS), BRANCH, REPO.
# Running it again updates the code and restarts the server, keeping deploy/.env.
set -euo pipefail

REPO=${REPO:-https://github.com/emmalegrottaglie/terminal-speedtest.git}
BRANCH=${BRANCH:-main}
DIR=/opt/terminal-speedtest
ENV_FILE=$DIR/deploy/.env

if [ "$(id -u)" -ne 0 ]; then
  echo "install.sh: run as root (sudo)" >&2
  exit 1
fi

echo "==> packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl git unattended-upgrades
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> code ($BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q --depth 1 origin "$BRANCH"
  git -C "$DIR" reset -q --hard FETCH_HEAD
else
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
fi

if [ ! -f "$ENV_FILE" ]; then
  if [ -z "${DOMAIN:-}" ]; then
    echo "install.sh: set DOMAIN for the first install, e.g. DOMAIN=fra-01.example.org" >&2
    exit 1
  fi
  echo "==> writing $ENV_FILE"
  {
    echo "DOMAIN=$DOMAIN"
    echo "SERVER_NAME=${SERVER_NAME:-${DOMAIN%%.*}}"
    echo "SERVER_LOCATION=${SERVER_LOCATION:-SELF-HOSTED}"
    echo "RTC_PORT=${RTC_PORT:-40000}"
    if [ -n "${STUN_URL:-}" ]; then echo "STUN_URL=$STUN_URL"; fi
  } > "$ENV_FILE"
fi
RTC_PORT=$(sed -n 's/^RTC_PORT=//p' "$ENV_FILE")

echo "==> firewall"
# Only adds rules to a firewall that is already on; it never turns one on, which could
# lock out SSH. Cloud firewalls (security lists, security groups) must be opened too.
if command -v ufw >/dev/null && [[ $(ufw status) == *"Status: active"* ]]; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow "$RTC_PORT/udp"
fi
# Oracle Cloud's Ubuntu images ship iptables rules that reject everything except SSH.
if command -v netfilter-persistent >/dev/null; then
  for tool in iptables ip6tables; do
    command -v "$tool" >/dev/null || continue
    for rule in "-p tcp --dport 80" "-p tcp --dport 443" "-p udp --dport $RTC_PORT"; do
      # shellcheck disable=SC2086
      "$tool" -C INPUT $rule -j ACCEPT 2>/dev/null || "$tool" -I INPUT $rule -j ACCEPT
    done
  done
  netfilter-persistent save
fi

echo "==> starting"
docker compose -f "$DIR/deploy/compose.yaml" up -d --build
docker image prune -f >/dev/null

DOMAIN_NOW=$(sed -n 's/^DOMAIN=//p' "$ENV_FILE")
echo
echo "Done. In a minute or two, https://$DOMAIN_NOW/api/info should answer."
echo "Open TCP 80, TCP 443 and UDP $RTC_PORT in the provider's firewall if it has one."
