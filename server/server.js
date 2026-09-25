// Terminal Speedtest measurement server.
//
// One process serves the web client and the measurement API:
//   GET  /api/info          server identity + the client's IP as seen here
//   GET  /api/ping          empty response for HTTP round-trip timing
//   GET  /api/down?bytes=N  N bytes of incompressible data
//   POST /api/up            discards the request body, reports bytes received
//   POST /api/rtc/offer     WebRTC signalling (non-trickle) for the packet-loss test
//
// Configuration is by environment variable; see README.md.

import http from 'node:http';
import { randomFillSync } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLossSession, sessionCount } from './rtc.js';

const env = process.env;
const PORT = Number(env.PORT) || 8080;
const HOST = env.HOST || '0.0.0.0';
const SERVER_NAME = env.SERVER_NAME || 'local-01';
const SERVER_LOCATION = env.SERVER_LOCATION || 'SELF-HOSTED';
const WEB_ROOT = path.resolve(env.WEB_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web'));
const MAX_DOWN_BYTES = 1024 * 1024 * 1024; // per request
const MAX_UP_BYTES = 1024 * 1024 * 1024;   // per request
const MAX_OFFER_BYTES = 64 * 1024;
const VERSION = '0.2.1';

// One random buffer, streamed repeatedly: incompressible, and costs no CPU per request.
const NOISE = randomFillSync(Buffer.alloc(1024 * 1024));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// The Android app runs on its own origin (https://localhost), so the API is open to any
// origin. No cookies or credentials are ever involved.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  // Exposes detailed Resource Timing to the client, so ping excludes JavaScript overhead.
  'Timing-Allow-Origin': '*',
};
const NO_STORE = { 'Cache-Control': 'no-store, no-transform' };

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...CORS, ...NO_STORE,
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    ...headers,
  });
  res.end(data);
}

function clientIp(req) {
  const ip = req.socket.remoteAddress || '';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function handleDown(req, res, url) {
  const requested = Number(url.searchParams.get('bytes'));
  if (!Number.isFinite(requested) || requested <= 0) return send(res, 400, { error: 'bytes must be a positive number' });
  const total = Math.min(Math.floor(requested), MAX_DOWN_BYTES);
  res.writeHead(200, { ...CORS, ...NO_STORE, 'Content-Type': 'application/octet-stream', 'Content-Length': total });
  let left = total;
  const pump = () => {
    while (left > 0) {
      const n = Math.min(left, NOISE.length);
      left -= n;
      if (!res.write(n === NOISE.length ? NOISE : NOISE.subarray(0, n))) return res.once('drain', pump);
    }
    res.end();
  };
  req.on('close', () => { left = 0; });
  pump();
}

function handleUp(req, res) {
  let received = 0;
  const started = process.hrtime.bigint();
  req.on('data', (chunk) => {
    received += chunk.length;
    if (received > MAX_UP_BYTES) {
      send(res, 413, { error: 'upload too large' });
      req.destroy();
    }
  });
  req.on('end', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    send(res, 200, { bytes: received, ms });
  });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      parts.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleOffer(req, res) {
  let offer;
  try {
    offer = JSON.parse(await readBody(req, MAX_OFFER_BYTES));
  } catch {
    return send(res, 400, { error: 'invalid offer' });
  }
  if (offer?.type !== 'offer' || typeof offer.sdp !== 'string') return send(res, 400, { error: 'invalid offer' });
  try {
    send(res, 200, await createLossSession(offer.sdp));
  } catch (err) {
    send(res, 503, { error: err.message });
  }
}

function serveStatic(req, res, url) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'bad path'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(WEB_ROOT, '.' + rel);
  if (file !== WEB_ROOT && !file.startsWith(WEB_ROOT + path.sep)) return send(res, 403, 'forbidden');
  let stat;
  try { stat = statSync(file); } catch { return send(res, 404, 'not found'); }
  if (!stat.isFile()) return send(res, 404, 'not found');
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = `${req.method} ${url.pathname}`;

  if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
    res.writeHead(204, CORS);
    return res.end();
  }

  switch (route) {
    case 'GET /api/info':
      return send(res, 200, {
        name: SERVER_NAME, location: SERVER_LOCATION, version: VERSION,
        ip: clientIp(req), lossSessions: sessionCount(),
      });
    case 'GET /api/ping':
      res.writeHead(204, { ...CORS, ...NO_STORE });
      return res.end();
    case 'GET /api/down':
      return handleDown(req, res, url);
    case 'POST /api/up':
      return handleUp(req, res);
    case 'POST /api/rtc/offer':
      return handleOffer(req, res);
  }

  if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url);
  send(res, 405, 'method not allowed');
});

server.keepAliveTimeout = 30_000;
server.listen(PORT, HOST, () => {
  console.log(`terminal-speedtest ${VERSION} · ${SERVER_NAME} (${SERVER_LOCATION})`);
  console.log(`listening on http://${HOST}:${PORT} · web root ${WEB_ROOT}`);
});
