# Terminal Speedtest

A terminal-inspired speed and packet-loss test for the web and Android, built with plain HTML5. It measures against **your own server**, so every number comes from a real test, and you can tune every parameter.

- **Speed test:** latency, jitter, download and upload over parallel HTTP streams, with per-second charts, a stability score and a quality grade.
- **Packet-loss test:** UDP-like packets over a WebRTC data channel (unordered, no retransmits), in the style of packetlosstest.com. It reports upload loss, download loss and total loss, late packets, latency (average, min, p95, max) and jitter, and draws a map with one glyph per packet.
- **Tunable:** packet size, packet rate, duration, late threshold and pre-wait, plus traffic presets (FPS 64/128 Hz, VoIP, video call, stress). The speed test's phase duration, warm-up, streams, request sizes and ping samples are adjustable too.
- **Looks like a console:** four palettes, three accent sets, three typefaces, CRT scanlines and text scaling. The rules are in [`terminal-design-guide/`](terminal-design-guide/DESIGN_GUIDE.md).
- **Private by default:** no analytics and no accounts. History and settings stay on the device (history saving can be switched off).

Inspired by [laggy.uk](https://laggy.uk/) and [packetlosstest.com](https://packetlosstest.com/).

## Quick start

Requires Node.js 18.20 or newer.

```bash
npm install
npm start
```

Open http://localhost:8080. The server hosts the web app and the measurement API, and the app uses that server by default. To test from another device on your network, open `http://<this-machine's-LAN-IP>:8080`.

## Server configuration

Set these as environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `SERVER_NAME` | `local-01` | Short id shown in the app |
| `SERVER_LOCATION` | `SELF-HOSTED` | Location label shown in the app |
| `RTC_PORT` | random | Run all WebRTC traffic over one UDP port (muxed). Easiest to forward through a firewall |
| `RTC_PORT_MIN` / `RTC_PORT_MAX` | random | Alternative: a UDP port range |
| `RTC_BIND_ADDRESS` | all | Bind WebRTC to one local address |
| `STUN_URL` | none | For example `stun:stun.l.google.com:19302`, so a server behind NAT can advertise its public address |
| `RTC_MAX_SESSIONS` | `32` | Maximum number of concurrent packet-loss sessions |
| `WEB_ROOT` | `./web` | Directory served as the web app |
| `CLIENT_HOURLY_GB` | `8` | Data budget per client (download + upload), refilled continuously over an hour |
| `CLIENT_MAX_STREAMS` | `8` | Parallel download/upload requests per client |
| `MAX_ACTIVE_CLIENTS` | `3` | Clients that can run a throughput test at the same time; others get `503 server busy`. About 3 per Gbps of port speed |
| `CLIENT_MAX_LOSS_SESSIONS` | `2` | Concurrent packet-loss sessions per client |

Setting any of the `CLIENT_*` or `MAX_ACTIVE_CLIENTS` limits to `0` switches it off.

Example for a public VPS:

```bash
SERVER_NAME=fra-01 SERVER_LOCATION="FRANKFURT, DE" RTC_PORT=40000 npm start
```

Open TCP `PORT` and UDP `RTC_PORT` in the firewall. If the packet-loss test says *"UDP to the server looks blocked"*, the UDP port is the problem.

### HTTPS

A page served over HTTPS cannot call an `http://` server. For a public deployment, put the server behind a TLS reverse proxy on the same host and add it in the app as `https://…`. The WebRTC traffic is already encrypted (DTLS) and does not go through the proxy.

[`deploy/`](deploy/README.md) does all of this with one command on a Debian or Ubuntu VPS: Docker, Caddy with automatic certificates, HTTP/1.1 only (under HTTP/2 the parallel streams would share one connection), no access logs, and the firewall ports.

### Exposure

The API is intentionally open (CORS `*`) so that the Android app and other origins can use it. To keep a public server from being used as an unmetered bandwidth sink, the server limits each client:

- A client is an IPv4 address or an IPv6 `/64`, since one subscriber usually owns a whole `/64`. Behind a reverse proxy on the same host, the address comes from the proxy's `X-Forwarded-For` header; that header is only trusted on connections from loopback. A proxy on another machine is not supported, because every client would look like the proxy.
- Clients on the server's own network (loopback, private and link-local addresses) are not limited, so LAN tests at multi-gigabit speeds work.
- Each client has an hourly data budget (`CLIENT_HOURLY_GB`). Once it is spent, download and upload requests get `429` with a `Retry-After` header until it refills. A 1 Gbps test at the default settings uses about 2.5 GB.
- Only `MAX_ACTIVE_CLIENTS` clients can run a throughput test at once, so that concurrent tests don't share the port and under-report. A client keeps its slot for 5 s between the download and upload phases. Others get `503`, and `/api/info` reports `busy: true`.
- Requests are capped at 100 MB (download) and 64 MB (upload); the app repeats requests for as long as a phase runs.
- Packet-loss sessions are capped per client (`CLIENT_MAX_LOSS_SESSIONS`) and in total (`RTC_MAX_SESSIONS`). Each session echoes at most 300 packets per second of at most 1500 bytes.

Several people behind one NAT (a household, a carrier-grade NAT) share one budget. The limits are in memory only; client addresses are never logged or written to disk.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/info` | Server name, location, version, the client IP as the server sees it, and `busy` (a new test would get `503`) |
| `GET /api/ping` | Empty `204` response, used for round-trip timing |
| `GET /api/down?bytes=N` | Returns N bytes of incompressible data (max 100 MB) |
| `POST /api/up` | Discards the request body (max 64 MB) and returns `{ bytes, ms }` |
| `POST /api/rtc/offer` | WebRTC signalling: send an SDP offer, receive an answer |

## How the numbers are measured

- **Ping:** the median of N sequential HTTP requests (default 20), timed with Resource Timing from request start to the first response byte. A warm-up request opens the connection first and is not counted.
- **Jitter:** the mean absolute difference between consecutive samples.
- **Download and upload:** parallel streams (default 4) for up to the phase duration (default 10 s). The first warm-up seconds (default 1) are excluded from the average, to discount TCP slow start. The charts show every second, including warm-up. Upload uses `XMLHttpRequest` progress events, because `fetch` has no portable upload progress.
- **Stop when stable** (on by default): after at least 4 s, and at least 3 s past the warm-up, a phase ends once every one-second rate sampled over the last 2 s is within 10% of the others, or once it has moved 400 MB. This roughly halves the data a test uses, for the user and for the server. The result says when and why a phase stopped early. Switch it off in **Settings → Speed test** to always run the full phase duration.
- **Packet loss:** each packet carries a sequence number and a send timestamp. The server echoes every packet and counts the ones it received. From that:
  - upload loss = sent − reached server
  - download loss = reached server − came back
  - late = came back after the threshold
  Pre-wait packets are sent to warm up the path but are not recorded. After the last packet, the client waits a grace period (3 × the late threshold, between 1 and 5 s); packets that arrive after it count as lost.
- **Stability and grade:** fixed formulas. The **WHY?>** button on the result screen shows each formula with the measured values.

## Android

The Android app wraps the same `web/` folder with [Capacitor](https://capacitorjs.com/). It needs Android Studio, or the Android SDK plus JDK 21.

```bash
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. You can also run `npx cap open android` and build or run the app from Android Studio.

The app has no built-in server. On first start, open **Settings → Servers** and add your server's address (for example `http://192.168.1.10:8080`). Plain `http://` addresses are allowed so that LAN servers work; prefer `https://` for public servers.

After changing anything in `web/`, run `npx cap sync android` again.

## Project layout

```
server/                 Node measurement server (HTTP API + WebRTC echo)
web/                    The app: index.html, css/, js/ (no build step)
  js/app.js             Screens, test runs, rendering
  js/measure.js         Latency, download, upload
  js/loss.js            WebRTC packet-loss test
  js/settings.js        Defaults, ranges, presets, persistence
  js/grade.js           Grade, stability and verdict rules
  js/history.js         Local result history
  css/terminal.css      Design-system stylesheet (copy of terminal-design-guide/terminal.css)
  css/app.css           App-specific components
android/                Capacitor Android project
deploy/                 Public server: install script, Docker Compose, Caddy
terminal-design-guide/  The design system: rules, tokens, specimen
```

## License

[MIT](LICENSE)
