// HTTP measurements against the server: identity, latency, download and upload throughput.

function abortError() {
  return new DOMException('Test aborted', 'AbortError');
}

// The server explains refusals (hourly limit, busy) in a JSON body; surface that text.
function refusal(what, status, body) {
  try {
    const msg = JSON.parse(body)?.error;
    if (msg) return new Error(msg);
  } catch { /* not JSON */ }
  return new Error(`${what} refused (${status})`);
}

export async function fetchInfo(base, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(`${base}/api/info`, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(`server answered ${res.status}`);
    return await res.json();
  } catch (err) {
    if (signal?.aborted) throw abortError();
    throw new Error(err.name === 'AbortError' ? 'server did not answer within 5 s' : 'server unreachable');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Mean absolute difference between consecutive samples (the RFC 3550 idea, unsmoothed).
export function jitterOf(values) {
  if (values.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < values.length; i++) sum += Math.abs(values[i] - values[i - 1]);
  return sum / (values.length - 1);
}

// One timed request. Uses Resource Timing (request start to first response byte) when the
// browser exposes it, otherwise wall-clock time around fetch().
async function pingOnce(base, n, signal) {
  const url = `${base}/api/ping?n=${n}-${Math.random().toString(36).slice(2)}`;
  const t0 = performance.now();
  await fetch(url, { cache: 'no-store', signal });
  const wall = performance.now() - t0;
  // The timing entry is queued a task or two after fetch() resolves.
  const name = new URL(url, location.href).href;
  let entry;
  for (let i = 0; i < 5 && !entry; i++) {
    await new Promise((r) => setTimeout(r, 0));
    entry = performance.getEntriesByName(name).pop();
  }
  const precise = entry && entry.requestStart > 0 && entry.responseStart > entry.requestStart
    ? entry.responseStart - entry.requestStart : null;
  return precise ?? wall;
}

// Lowest round trip over a few pings after a warm-up, for choosing the nearest server.
export async function probeLatency(base, samples, signal) {
  await pingOnce(base, 'probe', signal);
  let best = Infinity;
  for (let i = 0; i < samples; i++) best = Math.min(best, await pingOnce(base, `probe${i}`, signal));
  return best;
}

export async function measureLatency(base, samples, { signal, onSample } = {}) {
  // The timing buffer holds 250 entries by default; earlier tests may have filled it.
  try { performance.clearResourceTimings(); } catch { /* ignore */ }
  await pingOnce(base, 'warm', signal); // opens the connection; not counted
  const rtts = [];
  for (let i = 0; i < samples; i++) {
    if (signal?.aborted) throw abortError();
    const rtt = await pingOnce(base, i, signal);
    rtts.push(rtt);
    onSample?.(rtt, i + 1, samples);
  }
  try { performance.clearResourceTimings(); } catch { /* ignore */ }
  return { samples: rtts, ping: median(rtts), min: Math.min(...rtts), jitter: jitterOf(rtts) };
}

// Counts bytes over a timed phase. Per-second buckets feed the bar chart, a one-second
// sliding window feeds the live readout, and the result excludes the warm-up seconds
// (TCP slow start) from the average.
class Meter {
  constructor(warmupMs) {
    this.warmupMs = warmupMs;
    this.t0 = performance.now();
    this.buckets = [];
    this.recent = [];
    this.measuredBytes = 0;
    this.totalBytes = 0;
  }
  add(bytes) {
    if (bytes <= 0 || this.endAt !== undefined) return;
    const now = performance.now();
    const elapsed = now - this.t0;
    const sec = Math.floor(elapsed / 1000);
    while (this.buckets.length <= sec) this.buckets.push(0);
    this.buckets[sec] += bytes;
    this.totalBytes += bytes;
    if (elapsed >= this.warmupMs) this.measuredBytes += bytes;
    this.recent.push([now, bytes]);
  }
  liveMbps() {
    const now = performance.now();
    while (this.recent.length && now - this.recent[0][0] > 1000) this.recent.shift();
    const bytes = this.recent.reduce((s, [, b]) => s + b, 0);
    const span = Math.min(1000, now - this.t0);
    return span > 0 ? (bytes * 8) / (span / 1000) / 1e6 : 0;
  }
  result(endAt) {
    const measuredMs = endAt - this.t0 - this.warmupMs;
    const mbps = measuredMs > 0 ? (this.measuredBytes * 8) / (measuredMs / 1000) / 1e6 : null;
    const seconds = Math.floor((endAt - this.t0) / 1000);
    const perSecond = this.buckets.slice(0, seconds).map((b) => (b * 8) / 1e6);
    while (perSecond.length < seconds) perSecond.push(0);
    return { mbps, perSecond, bytes: this.totalBytes, seconds: (endAt - this.t0) / 1000 };
  }
}

// Adaptive phases stop early, to save the server's bandwidth and the user's data: once the
// minimum time has passed, a phase ends when the one-second rate has held steady (every
// sample in the window within `spread` of each other) or when it has moved `capBytes`.
// The phase duration setting stays the upper limit.
export const ADAPTIVE = { minMs: 4000, afterWarmupMs: 3000, windowMs: 2000, spread: 0.1, capBytes: 400e6 };

// Runs `worker(meter, stopSignal)` on `streams` parallel loops for `durationMs`,
// reporting the live rate every 250 ms.
async function timedPhase({ streams, durationMs, warmupMs, adaptive, signal, onTick }, worker) {
  if (signal?.aborted) throw abortError();
  const meter = new Meter(warmupMs);
  const stop = new AbortController();
  let stopped = null;  // why an adaptive phase ended early: 'stable' | 'cap'
  const end = (reason = null) => {
    if (meter.endAt !== undefined) return;
    meter.endAt = Math.min(performance.now(), meter.t0 + durationMs);
    stopped = reason;
    stop.abort();
  };
  const onAbort = () => stop.abort();
  signal?.addEventListener('abort', onAbort);
  const minMs = Math.min(durationMs, Math.max(ADAPTIVE.minMs, warmupMs + ADAPTIVE.afterWarmupMs));
  const samples = [];  // [elapsedMs, mbps]
  const ticker = setInterval(() => {
    const elapsedMs = performance.now() - meter.t0;
    const mbps = meter.liveMbps();
    onTick?.({ mbps, elapsedMs, buckets: meter.buckets });
    if (!adaptive) return;
    samples.push([elapsedMs, mbps]);
    if (elapsedMs < minMs) return;
    if (meter.totalBytes >= ADAPTIVE.capBytes) return end('cap');
    const recent = samples.filter(([t]) => t >= elapsedMs - ADAPTIVE.windowMs).map(([, v]) => v);
    const low = Math.min(...recent);
    if (recent.length >= ADAPTIVE.windowMs / 250 && low > 0 && Math.max(...recent) <= low * (1 + ADAPTIVE.spread)) end('stable');
  }, 250);
  const timer = setTimeout(() => end(), durationMs);
  const errors = [];
  try {
    await Promise.all(Array.from({ length: streams }, () =>
      worker(meter, stop.signal).catch((err) => { if (!stop.signal.aborted) { errors.push(err); stop.abort(); } })));
  } finally {
    clearTimeout(timer);
    clearInterval(ticker);
    signal?.removeEventListener('abort', onAbort);
  }
  if (signal?.aborted) throw abortError();
  if (errors.length) throw errors[0];
  end();
  return { ...meter.result(meter.endAt), stopped };
}

export function measureDownload(base, opts) {
  const chunk = Math.round(opts.chunkMB * 1024 * 1024);
  return timedPhase(opts, async (meter, stop) => {
    while (!stop.aborted) {
      let res;
      try {
        res = await fetch(`${base}/api/down?bytes=${chunk}&r=${Math.random().toString(36).slice(2)}`,
          { cache: 'no-store', signal: stop });
      } catch (err) {
        if (stop.aborted) return;
        throw new Error('download stream failed');
      }
      if (!res.ok || !res.body) throw refusal('download', res.status, await res.text().catch(() => ''));
      const reader = res.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          meter.add(value.byteLength);
        }
      } catch (err) {
        if (stop.aborted) return;
        throw new Error('download stream interrupted');
      }
    }
  });
}

function randomBlob(bytes) {
  const buf = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i += 65536) crypto.getRandomValues(buf.subarray(i, Math.min(bytes, i + 65536)));
  return new Blob([buf], { type: 'application/octet-stream' });
}

// Upload uses XMLHttpRequest because fetch() has no portable upload progress.
export function measureUpload(base, opts) {
  const blob = randomBlob(Math.round(opts.uploadChunkMB * 1024 * 1024));
  return timedPhase(opts, (meter, stop) => new Promise((resolve, reject) => {
    let xhr = null;
    stop.addEventListener('abort', () => xhr?.abort(), { once: true });
    const next = () => {
      if (stop.aborted) return resolve();
      let sent = 0;
      xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => { meter.add(e.loaded - sent); sent = e.loaded; };
      xhr.onload = () => {
        if (xhr.status !== 200) return reject(refusal('upload', xhr.status, xhr.responseText));
        meter.add(blob.size - sent);
        next();
      };
      xhr.onerror = () => (stop.aborted ? resolve() : reject(new Error('upload stream failed')));
      xhr.onabort = () => resolve();
      xhr.open('POST', `${base}/api/up`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.send(blob);
    };
    next();
  }));
}
