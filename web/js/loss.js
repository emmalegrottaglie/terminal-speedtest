// Packet-loss test over a WebRTC data channel configured like UDP
// (unordered, no retransmits). The server echoes every packet and counts the ones
// it received, which splits loss into upload (to server) and download (back to us).

const FLAG_WARMUP = 1;
const HEADER = 13; // u8 flags + u32 seq + f64 send time

function abortError() {
  return new DOMException('Test aborted', 'AbortError');
}

function waitFor(executor, ms, message, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    const onAbort = () => { clearTimeout(timer); reject(abortError()); };
    signal?.addEventListener('abort', onAbort, { once: true });
    executor((v) => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); resolve(v); });
  });
}

function sleep(ms, signal) {
  return waitFor((done) => setTimeout(done, ms), ms + 1000, 'timer failed', signal);
}

function packet(size, flags, seq) {
  const buf = new ArrayBuffer(Math.max(HEADER, size));
  const view = new DataView(buf);
  view.setUint8(0, flags);
  view.setUint32(1, seq, true);
  view.setFloat64(5, performance.now(), true);
  return buf;
}

async function connect(base, signal) {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const loss = pc.createDataChannel('loss', { ordered: false, maxRetransmits: 0 });
  const ctrl = pc.createDataChannel('ctrl');
  loss.binaryType = 'arraybuffer';
  try {
    await pc.setLocalDescription(await pc.createOffer());
    // Non-trickle: wait for our candidates (short deadline, host candidates arrive at once).
    await waitFor((done) => {
      if (pc.iceGatheringState === 'complete') return done();
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') done(); });
      setTimeout(done, 2000);
    }, 3000, 'ICE gathering failed', signal);

    let res;
    try {
      res = await fetch(`${base}/api/rtc/offer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pc.localDescription), signal,
      });
    } catch (err) {
      if (signal?.aborted) throw abortError();
      throw new Error('signalling failed: server unreachable');
    }
    const answer = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(answer.error || `signalling failed (${res.status})`);
    await pc.setRemoteDescription(answer);

    await waitFor((done) => {
      const check = () => { if (loss.readyState === 'open' && ctrl.readyState === 'open') done(); };
      loss.addEventListener('open', check);
      ctrl.addEventListener('open', check);
      check();
    }, 10000, 'packet channel did not open: UDP to the server looks blocked', signal);
    return { pc, loss, ctrl };
  } catch (err) {
    pc.close();
    throw err;
  }
}

function summarize(cfg, rtt, serverReceived) {
  const sent = rtt.length;
  const got = [];
  let late = 0;
  for (let i = 0; i < sent; i++) {
    if (Number.isNaN(rtt[i])) continue;
    got.push(rtt[i]);
    if (rtt[i] > cfg.lateMs) late++;
  }
  const received = got.length;
  const reached = serverReceived == null ? null : Math.max(received, Math.min(sent, serverReceived));
  let jitterSum = 0;
  for (let i = 1; i < got.length; i++) jitterSum += Math.abs(got[i] - got[i - 1]);

  const perSecond = [];
  for (let s = 0; s * cfg.rate < sent; s++) {
    const from = s * cfg.rate, to = Math.min(sent, from + cfg.rate);
    let lost = 0, sum = 0, n = 0;
    for (let i = from; i < to; i++) {
      if (Number.isNaN(rtt[i])) lost++; else { sum += rtt[i]; n++; }
    }
    perSecond.push({ sent: to - from, lost, avgRtt: n ? sum / n : null });
  }
  const sorted = [...got].sort((a, b) => a - b);
  const pct = (n, of) => (of > 0 ? (n / of) * 100 : null);
  return {
    sent, received, late, serverReceived: reached,
    uploadLoss: reached == null ? null : pct(sent - reached, sent),
    downloadLoss: reached == null ? null : pct(reached - received, reached),
    totalLoss: pct(sent - received, sent),
    latePct: pct(late, sent),
    avgRtt: received ? got.reduce((a, b) => a + b, 0) / received : null,
    minRtt: received ? sorted[0] : null,
    maxRtt: received ? sorted[sorted.length - 1] : null,
    p95Rtt: received ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null,
    jitter: got.length > 1 ? jitterSum / (got.length - 1) : null,
    perSecond,
    bytesEachWay: sent * Math.max(HEADER, cfg.packetSize),
  };
}

// cfg: { packetSize, rate, durationS, lateMs, preWaitS }
// hooks: onPhase(name), onPacket(seq, rttMs), onProgress(fraction)
export async function runLossTest(base, cfg, { signal, onPhase, onPacket, onProgress } = {}) {
  if (typeof RTCPeerConnection === 'undefined') throw new Error('this browser has no WebRTC support');
  onPhase?.('connect');
  const { pc, loss, ctrl } = await connect(base, signal);

  const total = cfg.rate * cfg.durationS;
  const warmupTotal = Math.round(cfg.rate * cfg.preWaitS);
  const rtt = new Float64Array(total).fill(NaN);
  let statsResolve = null;

  loss.onmessage = (e) => {
    const data = e.data;
    if (!(data instanceof ArrayBuffer) || data.byteLength < HEADER) return;
    const view = new DataView(data);
    if (view.getUint8(0) & FLAG_WARMUP) return;
    const seq = view.getUint32(1, true);
    if (seq >= total || !Number.isNaN(rtt[seq])) return;
    rtt[seq] = performance.now() - view.getFloat64(5, true);
    onPacket?.(seq, rtt[seq]);
  };
  ctrl.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'stats') statsResolve?.(msg.received);
    } catch { /* ignore */ }
  };

  // Sends every packet whose due time has passed, so a late timer catches up with a burst
  // instead of silently lowering the rate.
  const sendSchedule = (count, flags, onSent) => waitFor((done) => {
    const interval = 1000 / cfg.rate;
    const start = performance.now();
    let next = 0;
    const tick = () => {
      if (signal?.aborted) return;
      const due = Math.min(count, Math.floor((performance.now() - start) / interval) + 1);
      for (; next < due; next++) {
        if (loss.readyState !== 'open') return;
        loss.send(packet(cfg.packetSize, flags, next));
        onSent?.(next);
      }
      if (next >= count) return done();
      setTimeout(tick, Math.max(0, start + next * interval - performance.now()));
    };
    tick();
  }, (count / cfg.rate) * 1000 + 15000, 'packet sender stalled', signal);

  try {
    if (warmupTotal > 0) {
      onPhase?.('prewait');
      await sendSchedule(warmupTotal, FLAG_WARMUP);
    }
    onPhase?.('send');
    await sendSchedule(total, 0, (seq) => onProgress?.((seq + 1) / total));
    if (loss.readyState !== 'open') throw new Error('packet channel closed during the test');

    // Grace period for packets still in flight; anything later counts as lost.
    onPhase?.('drain');
    await sleep(Math.min(5000, Math.max(1000, cfg.lateMs * 3)), signal);

    onPhase?.('stats');
    let serverReceived = null;
    try {
      serverReceived = await waitFor((done) => {
        statsResolve = done;
        ctrl.send(JSON.stringify({ type: 'stats' }));
      }, 3000, 'no stats', signal);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // Without the server's count the total is still exact; only the split is unknown.
    }
    return summarize(cfg, rtt, serverReceived);
  } finally {
    try { if (ctrl.readyState === 'open') ctrl.send(JSON.stringify({ type: 'bye' })); } catch { /* ignore */ }
    setTimeout(() => pc.close(), 200);
  }
}

export function lossEstimate(cfg) {
  const packets = cfg.rate * cfg.durationS;
  return { packets, bytesEachWay: packets * Math.max(HEADER, cfg.packetSize) };
}
