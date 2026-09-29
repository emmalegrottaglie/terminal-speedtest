# Deploying a public measurement server

This folder runs one measurement server on a VPS: the Node server in Docker, behind [Caddy](https://caddyserver.com/), which gets and renews a Let's Encrypt certificate automatically.

| File | Purpose |
|---|---|
| `install.sh` | One-command install and update for Debian or Ubuntu |
| `cloud-init.yaml` | The same install, pasted as "user data" when creating a VPS |
| `compose.yaml` | The two containers: the server and Caddy |
| `Caddyfile` | TLS, HTTP/1.1 only, no access log, streaming proxy |
| `.env.example` | Server settings; `install.sh` writes `deploy/.env` from them |

The image is built from the `Dockerfile` at the repository root.

## What the host needs

- Debian 12 or Ubuntu 22.04 or newer. `amd64` and `arm64` both work.
- 1 vCPU and 1 GB of RAM are enough. What matters is bandwidth: a 1 Gbps port with a large or unmetered traffic allowance.
- A public IPv4 address, and IPv6 if the provider offers it.
- These ports open in the provider's firewall:

| Port | Why |
|---|---|
| TCP 22 | SSH. Restrict it to your address or use key-only login |
| TCP 80 | Certificate challenges and the redirect to HTTPS |
| TCP 443 | The app and the measurement API |
| UDP 40000 (`RTC_PORT`) | The packet-loss test |

## Install

1. Pick a name for the server, such as `fra-01`, and create a DNS `A` record `fra-01.<your-domain>` pointing at the VPS (plus an `AAAA` record for IPv6). If the DNS is on Cloudflare, set the record to **DNS only** (grey cloud): through Cloudflare's proxy the test would measure Cloudflare, not the server.
2. SSH in and run:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/emmalegrottaglie/terminal-speedtest/main/deploy/install.sh \
     | sudo DOMAIN=fra-01.example.org SERVER_NAME=fra-01 SERVER_LOCATION="NUREMBERG, DE" bash
   ```

   On Oracle Cloud and AWS, add `STUN_URL=stun:stun.l.google.com:19302`. Their network interface only has a private address, and the server needs STUN to learn the public address that it advertises for WebRTC.
3. Check it: `https://fra-01.example.org/api/info` should return the server's name. Then open `https://fra-01.example.org` and run a full test, including packet loss. If the loss test says UDP looks blocked, UDP 40000 is closed somewhere.

Instead of step 2, you can paste `cloud-init.yaml` as user data when you create the VPS, after editing its values.

## Update

Run `install.sh` again (without the variables). It pulls the latest `main`, rebuilds the image and restarts both containers, keeping `deploy/.env`. To change settings, edit `/opt/terminal-speedtest/deploy/.env` and run it again.

The installer also installs `unattended-upgrades`, which keeps the operating system patched.

## Privacy

- Caddy writes no access log, because the `Caddyfile` has no `log` directive.
- The Node server logs only its startup lines.
- The per-client limits keep addresses in memory only.
- Container logs are rotated at 10 MB.

## Notes

- **Why HTTP/1.1 only:** under HTTP/2 the app's parallel streams would share one TCP connection.
- **Why host networking:** it keeps the WebRTC UDP port free of Docker's NAT. It also means the Node server sees Caddy on loopback, which is the only source it accepts `X-Forwarded-For` from. The Node server listens on `127.0.0.1`, so outside traffic reaches it only through Caddy.
- **One proxy per server:** don't put a proxy on another machine in front of the server. Every client would then appear to come from that proxy and share its limits.
