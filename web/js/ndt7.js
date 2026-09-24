// Speed test against M-Lab's public NDT7 servers (https://www.measurementlab.net).
//
// M-Lab publishes every result as open data, including the client's IP address, so the
// app asks for consent before the first test. NDT7 offers download and upload only:
// there is no packet echo, so the packet-loss test needs one of your own servers.
// Protocol: https://github.com/m-lab/ndt-server/blob/main/spec/ndt7-protocol.md

import { Meter } from './measure.js';

const LOCATE = 'https://locate.measurementlab.net/v2/nearest/ndt/ndt7';
const PROTOCOL = 'net.measurementlab.ndt.v7';
const CLIENT = 'client_name=terminal-speedtest&client_version=0.2.0';
const TEST_MS = 10_000;          // NDT7 tests run ten seconds; the server forces a close at 13
const HARD_STOP_MS = 15_000;
const MAX_MESSAGE = 1 << 20;     // spec allows 1 << 24; 1 MiB keeps phone memory in check

function abortError() {
  return new DOMException('Test aborted', 'AbortError');
}

const withClient = (url) => url + (url.includes('?') ? '&' : '?') + CLIENT;

// Returns the nearest server with freshly signed URLs; the tokens expire quickly, so call
// this right before a test.
export async function locateNearest(signal) {
  let res;
  try {
    res = await fetch(`${LOCATE}?${CLIENT}`, { cache: 'no-store', signal });
  } catch (err) {
    if (signal?.aborted) throw abortError();
    throw new Error('m-lab locate service unreachable');
  }
  if (!res.ok) throw new Error(`m-lab locate answered ${res.status}`);
  const body = await res.json();
  const pick = body.results?.find((r) => r.urls?.['wss:///ndt/v7/download'] && r.urls?.['wss:///ndt/v7/upload']);
  if (!pick) throw new Error('m-lab has no server available right now');
  const site = pick.machine.split('.')[0];
  return {
    name: site,
    location: [pick.location?.city, pick.location?.country].filter(Boolean).join(', ').toUpperCase() || 'M-LAB',
    version: 'NDT7',
    ip: null,
    downloadUrl: withClient(pick.urls['wss:///ndt/v7/download']),
    uploadUrl: withClient(pick.urls['wss:///ndt/v7/upload']),
  };
}

// Shared run loop for both directions: opens the socket, reports the live rate every
// 250 ms, stops after the test time, and returns the same shape as measure.js phases
// plus the server's TCP view (min RTT, retransmissions, client address).
function runSocket(url, { warmupMs, signal, onTick }, direction) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const meter = new Meter(warmupMs);
    const tcp = { minRttMs: null, retransPct: null, clientIp: null };
    let ws, ticker, stopTimer, hardTimer, sampler, finished = false;

    const finish = (err) => {
      if (finished) return;
      finished = true;
      clearInterval(ticker); clearInterval(sampler); clearTimeout(stopTimer); clearTimeout(hardTimer);
      signal?.removeEventListener('abort', onAbort);
      try { ws.close(); } catch { /* already closed */ }
      if (err) return reject(err);
      const end = Math.min(performance.now(), meter.t0 + TEST_MS);
      resolve({ ...meter.result(end), ...tcp });
    };
    const onAbort = () => finish(abortError());
    signal?.addEventListener('abort', onAbort);

    try {
      ws = new WebSocket(url, PROTOCOL);
    } catch {
      return finish(new Error('m-lab socket could not open'));
    }
    ws.binaryType = 'arraybuffer';

    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') {
        if (direction === 'download') meter.add(e.data.byteLength);
        return;
      }
      if (direction === 'download') meter.add(e.data.length);
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      const info = m.TCPInfo;
      if (info?.MinRTT) tcp.minRttMs = info.MinRTT / 1000;
      if (info?.BytesSent) tcp.retransPct = ((info.BytesRetrans || 0) / info.BytesSent) * 100;
      const client = m.ConnectionInfo?.Client;
      if (client) tcp.clientIp = client.replace(/^\[?(.*?)\]?:\d+$/, '$1');
    };
    ws.onerror = () => finish(finished ? null : new Error(`m-lab ${direction} connection failed`));
    ws.onclose = () => finish(meter.totalBytes > 0 ? null : new Error(`m-lab ${direction} closed before any data`));

    ws.onopen = () => {
      meter.t0 = performance.now();
      ticker = setInterval(() => onTick?.({ mbps: meter.liveMbps(), elapsedMs: performance.now() - meter.t0, buckets: meter.buckets }), 250);
      stopTimer = setTimeout(() => finish(null), TEST_MS);
      if (direction === 'upload') startUpload(ws, meter, (id) => { sampler = id; });
    };
    hardTimer = setTimeout(() => finish(new Error(`m-lab ${direction} timed out`)), HARD_STOP_MS);
  });
}

// Keeps the socket's send buffer topped up, doubling the message size while it is below
// 1/16 of what has been queued (spec rule). Progress counts bytes that left the buffer.
function startUpload(ws, meter, setSampler) {
  const payload = new Uint8Array(MAX_MESSAGE);
  for (let i = 0; i < payload.length; i += 65536) crypto.getRandomValues(payload.subarray(i, i + 65536));
  let size = 1 << 13, queued = 0, counted = 0;
  const pump = () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    while (ws.bufferedAmount < 7 * size) {
      if (size < MAX_MESSAGE && size <= queued / 16) size *= 2;
      ws.send(payload.subarray(0, size));
      queued += size;
    }
    setTimeout(pump, 0);
  };
  setSampler(setInterval(() => {
    const sent = queued - ws.bufferedAmount;
    meter.add(sent - counted);
    counted = sent;
  }, 100));
  pump();
}

export function ndt7Download(server, opts) {
  return runSocket(server.downloadUrl, opts, 'download');
}

export function ndt7Upload(server, opts) {
  return runSocket(server.uploadUrl, opts, 'upload');
}

export const NDT7_TEST_S = TEST_MS / 1000;
