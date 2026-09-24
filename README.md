# Terminal Speedtest

A terminal-inspired speed and packet-loss test for the web and Android, built with plain HTML5. It measures against **your own server**, or against [M-Lab](https://www.measurementlab.net/)'s public servers worldwide for speed only. Every number comes from a real test, and you can tune every parameter.

- **Speed test:** latency, jitter, download and upload over parallel HTTP streams, with per-second charts, a stability score and a quality grade.
- **Packet-loss test:** UDP-like packets over a WebRTC data channel (unordered, no retransmits), in the style of packetlosstest.com. It reports upload loss, download loss and total loss, late packets, latency (average, min, p95, max) and jitter, and draws a map with one glyph per packet.
- **Tunable:** packet size, packet rate, duration, late threshold and pre-wait, plus traffic presets (FPS 64/128 Hz, VoIP, video call, stress). The speed test's phase duration, warm-up, streams, request sizes and ping samples are adjustable too.
- **Looks like a console:** four palettes, three accent sets, three typefaces, CRT scanlines and text scaling. The rules are in [`terminal-design-guide/`](terminal-design-guide/DESIGN_GUIDE.md).
- **Private by default:** no analytics and no accounts. History and settings stay on the device (history saving can be switched off).

Inspired by [laggy.uk](https://laggy.uk/) and [packetlosstest.com](https://packetlosstest.com/).

## Public servers (M-Lab)

The server list always includes **M-Lab · nearest**. It uses M-Lab's free, open [NDT7](https://github.com/m-lab/ndt-server/blob/main/spec/ndt7-protocol.md) platform: about 500 servers worldwide, with the nearest one picked automatically. No account or API key is needed.

- **Measures:** download and upload, one TCP stream each way for 10 seconds. Latency is the server's TCP minimum round-trip time.
- **Does not measure:** packet loss, jitter or stability, because M-Lab has no packet echo. Those need your own server.
- **Privacy:** M-Lab [publishes every result as open data](https://www.measurementlab.net/privacy/), including your IP address. The app asks once before the first M-Lab test.

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

Example for a public VPS:

```bash
SERVER_NAME=fra-01 SERVER_LOCATION="FRANKFURT, DE" RTC_PORT=40000 npm start
```

Open TCP `PORT` and UDP `RTC_PORT` in the firewall. If the packet-loss test says *"UDP to the server looks blocked"*, the UDP port is the problem.

### HTTPS

A page served over HTTPS cannot call an `http://` server. For a public deployment, put the server behind a TLS reverse proxy (Caddy, nginx) and add it in the app as `https://…`. The WebRTC traffic is already encrypted (DTLS) and does not go through the proxy.

### Exposure

The API is intentionally open (CORS `*`) so that the Android app and other origins can use it. A public server can therefore be used by anyone as a bandwidth sink. Each request is capped at 1 GB and packet-loss sessions are capped by `RTC_MAX_SESSIONS`, but there is no per-client rate limit. If the server is public, add one at the reverse proxy.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/info` | Server name, location, version, and the client IP as the server sees it |
| `GET /api/ping` | Empty `204` response, used for round-trip timing |
| `GET /api/down?bytes=N` | Returns N bytes of incompressible data (max 1 GB) |
| `POST /api/up` | Discards the request body and returns `{ bytes, ms }` |
| `POST /api/rtc/offer` | WebRTC signalling: send an SDP offer, receive an answer |

## How the numbers are measured

- **Ping:** the median of N sequential HTTP requests (default 20), timed with Resource Timing from request start to the first response byte. A warm-up request opens the connection first and is not counted.
- **Jitter:** the mean absolute difference between consecutive samples.
- **Download and upload:** parallel streams (default 4) for a fixed time (default 10 s). The first warm-up seconds (default 1) are excluded from the average, to discount TCP slow start. The charts show every second, including warm-up. Upload uses `XMLHttpRequest` progress events, because `fetch` has no portable upload progress.
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

Out of the box the app can test against M-Lab (speed only). For packet loss, open **Settings → Servers** and add your own server's address (for example `http://192.168.1.10:8080`). Plain `http://` addresses are allowed so that LAN servers work; prefer `https://` for public servers.

After changing anything in `web/`, run `npx cap sync android` again.

## Project layout

```
server/                 Node measurement server (HTTP API + WebRTC echo)
web/                    The app: index.html, css/, js/ (no build step)
  js/app.js             Screens, test runs, rendering
  js/measure.js         Latency, download, upload
  js/loss.js            WebRTC packet-loss test
  js/ndt7.js            M-Lab NDT7 speed test (public servers)
  js/settings.js        Defaults, ranges, presets, persistence
  js/grade.js           Grade, stability and verdict rules
  js/history.js         Local result history
  css/terminal.css      Design-system stylesheet (copy of terminal-design-guide/terminal.css)
  css/app.css           App-specific components
android/                Capacitor Android project
terminal-design-guide/  The design system: rules, tokens, specimen
```

## License

[MIT](LICENSE)
