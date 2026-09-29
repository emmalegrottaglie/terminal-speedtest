// UI wiring: screens, test runs, rendering. Measurements live in measure.js and loss.js.

import * as S from './settings.js';
import * as H from './history.js';
import * as G from './grade.js';
import { fetchInfo, measureLatency, measureDownload, measureUpload, ADAPTIVE } from './measure.js';
import { runLossTest, lossEstimate } from './loss.js';
import * as L from './serverlist.js';

const $ = (id) => document.getElementById(id);
const VERSION = '0.2.1';
const MAX_BARS = 12;
const VIEWS = ['test', 'loss', 'history', 'settings'];

let settings = S.load();
let view = 'test';
let running = null;              // { kind: 'full' | 'loss', ctrl: AbortController }
const serverStatus = new Map();  // url -> { ok, info, error }
let wakeLock = null;
let publicList = null;           // the trusted public server list (serverlist.js), or null
let ranked = [];                 // its servers that answered, nearest first
let rankedAt = 0;
let ranking = null;              // the rescan in progress, if any
const RANK_MAX_AGE_MS = 10 * 60_000;

// ── Formatting ────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const DASH = '—';

function fmtMbps(v) {
  if (v == null || !Number.isFinite(v)) return DASH;
  return v >= 100 ? String(Math.round(v)) : v.toFixed(1);
}
function fmtMs(v) {
  if (v == null || !Number.isFinite(v)) return DASH;
  return v >= 10 ? String(Math.round(v)) : v.toFixed(1);
}
function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return DASH;
  if (v === 0) return '0.0';
  return v < 0.1 ? v.toFixed(2) : v.toFixed(1);
}
function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}
const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const stamp = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${clock(d)}`;

// ── Settings helpers ──────────────────────────────────────────────────────
function getPath(path) {
  const [g, k] = path.split('.');
  return settings[g][k];
}
function setPath(path, value) {
  const [g, k] = path.split('.');
  settings[g][k] = value;
  S.save(settings);
}
// The server tests run against: in AUTO mode the nearest public server, otherwise the
// custom server in use. Null when there is none.
function server() {
  return settings.auto ? ranked[0] || null : S.activeServer(settings);
}
function serverLabel(url) {
  const st = serverStatus.get(url);
  if (st?.info) return `${st.info.name} · ${st.info.location}`;
  try { return new URL(url).host; } catch { return url; }
}

// ── Toasts ────────────────────────────────────────────────────────────────
function toast(message, kind = 'err') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="led ${kind}"></span><span>${esc(message)}</span>`;
  $('toasts').append(el);
  setTimeout(() => el.remove(), 5000);
}

// Two-tap confirmation inside the console instead of a native dialog: the first tap arms
// the button and swaps its label for the question; a second tap within 4 s runs the action.
// Waiting, or moving focus away, disarms it.
function confirmTap(button, question, action) {
  const label = button.textContent;
  let timer = null;
  const disarm = () => {
    clearTimeout(timer);
    timer = null;
    button.classList.remove('armed');
    button.textContent = label;
  };
  button.addEventListener('click', () => {
    if (!timer) {
      button.classList.add('armed');
      button.textContent = question;
      timer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    action();
  });
  button.addEventListener('blur', disarm);
}

// ── Header, footer, navigation ────────────────────────────────────────────
function promptFor(v) {
  const s = server();
  const name = s ? (serverStatus.get(s.url)?.info?.name || 'custom') : null;
  if (!s && v !== 'history') return 'config --add-server <address>';
  const sp = settings.speed, l = settings.loss;
  switch (v) {
    case 'test': {
      const flags = [`--server ${settings.auto ? 'auto' : name}`, `--streams ${sp.streams}`, `--time ${sp.durationS}s`];
      if (sp.adaptive) flags.push('--stop-when-stable');
      if (!sp.runDownload) flags.push('--no-download');
      if (!sp.runUpload) flags.push('--no-upload');
      if (sp.runLoss) flags.push('--loss');
      return `speedtest --run ${flags.join(' ')}`;
    }
    case 'loss':
      return `losstest --server ${settings.auto ? 'auto' : name} --size ${l.packetSize} --rate ${l.rate} --time ${l.durationS}s --late ${l.lateMs}ms --prewait ${l.preWaitS}s`;
    case 'history':
      return `history --list --limit 100`;
    default:
      return 'config --edit';
  }
}

function renderHeader() {
  const section = $(`view-${view}`);
  $('band-title').textContent = section.dataset.title;
  const s = server();
  const st = s && serverStatus.get(s.url);
  let state = '● IDLE';
  if (running) state = '● TESTING';
  else if (!s) state = '○ NO SERVER';
  else if (st && !st.ok) state = '○ OFFLINE';
  else if (st?.ok) state = '● READY';
  $('state').textContent = state;

  $('sub-left').textContent = s ? `SERVER ${serverLabel(s.url)}${settings.auto ? ' · AUTO' : ''}` : 'NO SERVER CONFIGURED';
  const ip = st?.info?.ip;
  $('sub-right').textContent = ip ? `${ip.includes(':') ? 'IPV6' : 'IPV4'} ${ip}` : (st && !st.ok ? 'UNREACHABLE' : DASH);
  if (!running) $('prompt').textContent = promptFor(view);
  $('end-right').textContent = st?.info ? `SERVER ${st.info.name} · V${st.info.version}` : `TERMSPEED V${VERSION}`;
}

function route() {
  const wanted = location.hash.slice(1);
  view = VIEWS.includes(wanted) ? wanted : 'test';
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== view;
  document.querySelectorAll('.nav button').forEach((b) => {
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (view === 'history') renderHistory();
  if (view === 'settings') renderServers();
  renderHeader();
  window.scrollTo(0, 0);
}

// ── Display settings ──────────────────────────────────────────────────────
function applyDisplay() {
  const d = settings.display;
  const html = document.documentElement;
  html.dataset.palette = d.palette;
  if (d.accents === 'broadcast') delete html.dataset.accents; else html.dataset.accents = d.accents;
  html.dataset.font = d.font;
  $('crt').hidden = !d.crt;
  $('app').style.zoom = d.scale === 1 ? '' : String(d.scale);
  $('s-scale').textContent = `${Math.round(d.scale * 100)}%`;
  fitHistory();
  document.querySelectorAll('.switch[data-axis]').forEach((group) => {
    const value = d[group.dataset.axis];
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === value)));
  });
}

function renderToggles() {
  document.querySelectorAll('[data-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(Boolean(getPath(b.dataset.toggle)))));
}

function renderInputs() {
  document.querySelectorAll('[data-setting]').forEach((input) => {
    const r = S.RANGES[input.dataset.setting];
    input.min = r.min; input.max = r.max; input.step = r.step;
    input.value = getPath(input.dataset.setting);
  });
}

// ── Charts and tiles ──────────────────────────────────────────────────────
function tile(value, label, { hl = false, sub = '', raw = false } = {}) {
  return `<div class="tile"><div class="tile-value${hl ? ' hl' : ''}">${raw ? value : esc(value)}</div>` +
    `<div class="tile-label">${esc(label)}</div>${sub ? `<div class="tile-sub">${esc(sub)}</div>` : ''}</div>`;
}

function gradeChip(g) {
  return g ? `<span class="grade" data-g="${esc(g)}">${esc(g)}</span>` : DASH;
}

// Bars follow the kit: value above every bar, axis label below, min–max scaling with a
// 12% floor, peak marked. Long series are averaged into groups so each bar keeps a
// readable value; the section label states the grouping. `per` is the unit of one value:
// 'second' (axis 1S, 2S…) or 'sample' (axis #1, #2…).
function renderBars(barsEl, labelEl, title, unit, values, fmt, { per = 'second' } = {}) {
  const group = Math.max(1, Math.ceil(values.length / MAX_BARS));
  const points = [];
  for (let i = 0; i < values.length; i += group) {
    const slice = values.slice(i, i + group).filter((v) => v != null);
    points.push({ v: slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null, end: Math.min(values.length, i + group) });
  }
  const known = points.map((p) => p.v).filter((v) => v != null);
  const grouping = per === 'sample'
    ? (group === 1 ? 'per sample' : `per ${group} samples`)
    : (group === 1 ? 'by second' : `per ${group} s`);
  labelEl.textContent = `${title} · ${unit} ${grouping}`;
  if (!known.length) { barsEl.innerHTML = ''; return; }
  const lo = Math.min(...known), hi = Math.max(...known), span = hi - lo || 1;
  const peak = points.findIndex((p) => p.v === hi);
  const axis = (end) => (per === 'sample' ? `#${end}` : `${end}S`);
  barsEl.innerHTML = points.map((p, i) => {
    const pct = p.v == null ? 0 : 12 + ((p.v - lo) / span) * 88;
    return `<div class="bar${i === peak ? ' peak' : ''}"><div class="bar-value">${p.v == null ? DASH : fmt(p.v)}</div>` +
      `<div class="bar-track"><div class="bar-fill" style="--pct:${pct}%"></div></div>` +
      `<div class="bar-label">${axis(p.end)}</div></div>`;
  }).join('');
}

// ── Boot sequence (real steps, each gains [ OK ] when it completes) ───────
function makeBoot(prefix, command) {
  const lines = $(`${prefix}-boot-lines`);
  const fill = $(`${prefix}-boot-fill`);
  const pctEl = $(`${prefix}-boot-pct`);
  lines.innerHTML = `<div class="boot-line cmd">❯ ${esc(command)}</div>`;
  let current = null, label = '', pct = 0;
  const setPct = (p) => {
    pct = Math.max(pct, Math.min(100, Math.round(p)));
    fill.style.setProperty('--pct', `${pct}%`);
    pctEl.textContent = `${pct}% — ${label.toUpperCase()}`;
  };
  return {
    step(text) { current = document.createElement('div'); current.className = 'boot-line'; current.textContent = text; lines.append(current); label = text; setPct(pct); },
    ok(detail) { if (!current) return; current.insertAdjacentHTML('beforeend', `${detail ? ` · ${esc(detail)}` : ''} <span class="ok">[ OK ]</span>`); current = null; },
    fail(detail) { if (!current) return; current.insertAdjacentHTML('beforeend', ` · ${esc(detail)} <span class="ok">[ FAIL ]</span>`); current = null; },
    progress: setPct,
    done(text) { label = text; setPct(100); },
  };
}

// Weighted progress across phases of known length.
function makeProgress(boot, weights) {
  const total = weights.reduce((a, w) => a + w.weight, 0);
  let base = 0, active = 0;
  return {
    begin(key) { base = weights.slice(0, weights.findIndex((w) => w.key === key)).reduce((a, w) => a + w.weight, 0); active = weights.find((w) => w.key === key).weight; boot.progress((base / total) * 100); },
    at(frac) { boot.progress(((base + active * Math.min(1, frac)) / total) * 100); },
  };
}

function setLive(value, unit) {
  $('t-live').textContent = value;
  $('t-live-unit').textContent = unit;
}

// ── Packet map ────────────────────────────────────────────────────────────
// state per packet: 0 in flight, 1 on time, 2 late, 3 lost
const GLYPHS = [['pm-wait', '·'], ['pm-ok', '▮'], ['pm-late', '▯'], ['pm-lost', '✕']];
function renderMap(states, count) {
  let html = '', run = -1, text = '';
  for (let i = 0; i < count; i++) {
    const s = states[i];
    if (s !== run) { if (text) html += `<b class="${GLYPHS[run][0]}">${text}</b>`; run = s; text = ''; }
    text += GLYPHS[s][1];
  }
  if (text) html += `<b class="${GLYPHS[run][0]}">${text}</b>`;
  $('l-map').innerHTML = html;
}

// ── Running tests ─────────────────────────────────────────────────────────
async function holdWakeLock(on) {
  try {
    if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    else { await wakeLock?.release(); wakeLock = null; }
  } catch { /* not supported or denied: the test still runs */ }
}

function setRunning(kind, ctrl) {
  running = kind ? { kind, ctrl } : null;
  const full = $('t-run-btn'), loss = $('l-run-btn');
  full.textContent = kind === 'full' ? '■ ABORT' : '▶ RUN TEST';
  loss.textContent = kind === 'loss' ? '■ ABORT' : '▶ RUN LOSS TEST';
  full.disabled = kind === 'loss';
  loss.disabled = kind === 'full';
  document.querySelectorAll('#view-loss [data-setting], #l-presets button, #view-test [data-toggle]').forEach((el) => { el.disabled = Boolean(kind); });
  holdWakeLock(Boolean(kind));
  renderHeader();
}

function requireServer() {
  if (settings.auto ? publicList?.servers.length : server()) return true;
  if (settings.auto && !publicList && ranking) { toast('LOADING THE SERVER LIST · TRY AGAIN', 'info'); return false; }
  toast(settings.auto ? 'NO PUBLIC SERVERS YET · ADD YOUR OWN IN SETTINGS' : 'ADD A SERVER IN SETTINGS FIRST');
  location.hash = '#settings';
  return false;
}

// Connects a test to its server. In AUTO mode the public servers are pinged again if the
// last ranking is old, then the nearest one that answers and isn't busy is used.
async function openServer(signal) {
  if (!settings.auto) {
    const s = server();
    const info = await fetchInfo(s.url, signal);
    serverStatus.set(s.url, { ok: true, info });
    return { url: s.url, info };
  }
  if (!ranked.length || Date.now() - rankedAt > RANK_MAX_AGE_MS) await rescan(signal);
  let lastError = new Error('no public server answered');
  for (const c of ranked) {
    try {
      const info = await fetchInfo(c.url, signal);
      serverStatus.set(c.url, { ok: true, info });
      if (info.busy) { lastError = new Error('the nearest servers are busy, try again shortly'); continue; }
      ranked = [c, ...ranked.filter((x) => x !== c)];
      return { url: c.url, info };
    } catch (err) {
      if (signal.aborted) throw err;
      serverStatus.set(c.url, { ok: false, error: err.message });
      lastError = err;
    }
  }
  throw lastError;
}

function explainError(err, base) {
  if (location.protocol === 'https:' && base.startsWith('http:')) return 'HTTPS PAGE CANNOT REACH AN HTTP SERVER';
  return String(err.message || err).toUpperCase();
}

// Hooks that turn loss-test phases into boot lines and packet-map updates.
function lossHooks(boot, cfg, progress, onRtt) {
  const total = cfg.rate * cfg.durationS;
  const states = new Uint8Array(total);
  let sent = 0, received = 0, lastRtt = null, dirty = true;
  const seconds = Math.ceil(total / cfg.rate);
  const rttSum = new Float64Array(seconds), rttCount = new Uint32Array(seconds);
  const perSecond = () => Array.from({ length: Math.min(seconds, Math.ceil(sent / cfg.rate)) },
    (_, i) => (rttCount[i] ? rttSum[i] / rttCount[i] : null));
  const steps = {
    connect: 'opening data channel · unordered · no retransmit',
    prewait: `pre-wait · ${cfg.preWaitS} s · not recorded`,
    send: `sending ${total} packets · ${cfg.rate}/s · ${cfg.packetSize} b`,
    drain: 'waiting for packets in flight',
    stats: 'reading server packet count',
  };
  let phase = null;
  const timer = setInterval(() => {
    if (!dirty) return;
    dirty = false;
    renderMap(states, sent);
    onRtt?.(lastRtt, sent, received, perSecond());
  }, 250);
  return {
    states,
    hooks: {
      onPhase(p) {
        if (phase) boot.ok(phase === 'send' ? `${sent} sent` : '');
        phase = p;
        boot.step(steps[p]);
      },
      onProgress(frac) { sent = Math.round(frac * total); dirty = true; progress(frac); },
      onPacket(seq, rtt) {
        states[seq] = rtt > cfg.lateMs ? 2 : 1;
        const sec = Math.floor(seq / cfg.rate);
        rttSum[sec] += rtt; rttCount[sec]++;
        received++; lastRtt = rtt; dirty = true;
      },
    },
    finish(ok) {
      clearInterval(timer);
      if (ok) {
        boot.ok('');
        for (let i = 0; i < total; i++) if (states[i] === 0) states[i] = 3;
        renderMap(states, total);
      }
    },
  };
}

async function runFull() {
  if (running?.kind === 'full') { running.ctrl.abort(); return; }
  if (!requireServer()) return;
  let base = server()?.url || '';
  const ctrl = new AbortController();
  const { signal } = ctrl;
  const sp = { ...settings.speed };
  const cfg = { ...settings.loss };
  const command = promptFor('test');
  setRunning('full', ctrl);

  $('t-idle').hidden = true;
  $('t-result').hidden = true;
  $('t-run').hidden = false;
  const liveBars = (title, unit, values, fmt, opts) => renderBars($('t-live-bars'), $('t-live-label'), title, unit, values, fmt, opts);
  $('t-live-bars').innerHTML = '';
  $('t-live-label').textContent = 'Live · waiting for data';
  setLive(DASH, 'WAITING');
  window.scrollTo(0, 0);
  const boot = makeBoot('t', command);
  const progress = makeProgress(boot, [
    { key: 'info', weight: 1 },
    { key: 'ping', weight: Math.max(1, sp.pingSamples * 0.05) },
    ...(sp.runDownload ? [{ key: 'down', weight: sp.durationS }] : []),
    ...(sp.runUpload ? [{ key: 'up', weight: sp.durationS }] : []),
    ...(sp.runLoss ? [{ key: 'loss', weight: cfg.durationS + cfg.preWaitS + 3 }] : []),
  ]);

  const phaseOpts = (unit) => ({
    streams: sp.streams, durationMs: sp.durationS * 1000, warmupMs: sp.warmupS * 1000,
    chunkMB: sp.chunkMB, uploadChunkMB: sp.uploadChunkMB, adaptive: sp.adaptive, signal,
    onTick: ({ mbps, elapsedMs, buckets }) => {
      setLive(fmtMbps(mbps), unit);
      progress.at(elapsedMs / (sp.durationS * 1000));
      const done = buckets.slice(0, Math.floor(elapsedMs / 1000)).map((b) => (b * 8) / 1e6);
      liveBars(unit.endsWith('DOWN') ? 'Download' : 'Upload', 'Mbps', done, fmtMbps);
    },
  });

  const upTo = sp.adaptive ? 'up to ' : '';
  const phaseDone = (r) => `${fmtMbps(r.mbps)} mbps${r.stopped ? ` · ${stopNote(r)}` : ''}`;

  try {
    progress.begin('info');
    boot.step(settings.auto ? 'finding the nearest server' : 'resolving server');
    const { url, info } = await openServer(signal);
    base = url;
    boot.ok(`${info.name} · ${info.location}`);

    progress.begin('ping');
    boot.step(`measuring latency · ${sp.pingSamples} samples`);
    const pings = [];
    const lat = await measureLatency(base, sp.pingSamples, {
      signal,
      onSample: (rtt, i, n) => {
        pings.push(rtt);
        setLive(fmtMs(rtt), 'MS PING');
        liveBars('Latency', 'ms', pings, fmtMs, { per: 'sample' });
        progress.at(i / n);
      },
    });
    boot.ok(`${fmtMs(lat.ping)} ms`);

    let down = null, up = null, loss = null, lossError = null;
    if (sp.runDownload) {
      progress.begin('down');
      boot.step(`download · ${upTo}${sp.durationS} s · ${sp.streams} streams`);
      $('t-live-bars').innerHTML = '';
      down = await measureDownload(base, phaseOpts('MBPS DOWN'));
      boot.ok(phaseDone(down));
    }
    if (sp.runUpload) {
      progress.begin('up');
      boot.step(`upload · ${upTo}${sp.durationS} s · ${sp.streams} streams`);
      $('t-live-bars').innerHTML = '';
      up = await measureUpload(base, phaseOpts('MBPS UP'));
      boot.ok(phaseDone(up));
    }
    if (sp.runLoss) {
      progress.begin('loss');
      $('t-live-bars').innerHTML = '';
      $('t-live-label').textContent = 'Packet loss · waiting for packets';
      setLive(DASH, 'MS RTT');
      const tracker = lossHooks(boot, cfg, (f) => progress.at(f), (rtt, sent, received, perSec) => {
        setLive(fmtMs(rtt), 'MS RTT');
        liveBars('Latency', 'ms', perSec, fmtMs);
      });
      try {
        loss = await runLossTest(base, cfg, { signal, ...tracker.hooks });
        tracker.finish(true);
      } catch (err) {
        tracker.finish(false);
        if (err.name === 'AbortError') throw err;
        lossError = String(err.message);
        boot.fail(lossError);
      }
    }
    boot.done('complete');

    const lossPct = loss?.totalLoss ?? null;
    const result = {
      at: new Date(), info, sp, cfg, ping: lat.ping, jitter: lat.jitter, down, up, loss, lossError,
      grade: G.gradeOf({ ping: lat.ping, jitter: lat.jitter, loss: lossPct }),
      stability: G.stabilityOf({ jitter: lat.jitter, loss: lossPct, late: loss?.latePct ?? null }),
    };
    renderFull(result);
    $('t-run').hidden = true;
    $('t-result').hidden = false;
    if (settings.history.save) {
      H.add({
        at: result.at.toISOString(), kind: 'full', server: info.name,
        down: down?.mbps ?? null, up: up?.mbps ?? null, ping: lat.ping, jitter: lat.jitter,
        loss: lossPct, grade: result.grade,
      });
    }
  } catch (err) {
    $('t-run').hidden = true;
    if (err.name === 'AbortError') {
      toast('TEST ABORTED', 'info');
    } else {
      if (base && !serverStatus.get(base)?.ok) serverStatus.set(base, { ok: false, error: err.message });
      toast(explainError(err, base));
    }
    if ($('r-hero').textContent === DASH) { renderIdle(); $('t-idle').hidden = false; } else $('t-result').hidden = false;
  } finally {
    setRunning(null);
  }
}

// Why an adaptive phase ended before the phase duration, e.g. "stable at 5.3 s".
function stopNote(r) {
  return `${r.stopped === 'cap' ? `${ADAPTIVE.capBytes / 1e6} mb cap` : 'stable'} at ${r.seconds.toFixed(1)} s`;
}

function renderFull(r) {
  const heroEl = $('r-hero');
  if (r.down) {
    heroEl.innerHTML = `${esc(fmtMbps(r.down.mbps))}<span class="hero-unit">MBPS</span>`;
  } else if (r.up) {
    heroEl.innerHTML = `${esc(fmtMbps(r.up.mbps))}<span class="hero-unit">MBPS UP</span>`;
  } else {
    heroEl.innerHTML = `${esc(fmtMs(r.ping))}<span class="hero-unit">MS</span>`;
  }
  heroEl.classList.toggle('long', heroEl.textContent.length > 7);
  const words = [G.speedWord(r.down?.mbps ?? r.up?.mbps ?? null) ?? G.pingWord(r.ping), G.stabilityWord(r.stability)].filter(Boolean);
  $('r-status').textContent = words.join(' · ') || DASH;
  const meta = [];
  if (r.down) meta.push(`DOWNLOAD ${fmtMbps(r.down.mbps)} MBPS`);
  if (r.up) meta.push(`UPLOAD ${fmtMbps(r.up.mbps)} MBPS`);
  meta.push(`PING ${fmtMs(r.ping)} MS`);
  $('r-meta').textContent = meta.join(' · ');

  const chips = [];
  if (r.info.ip) chips.push(`<span class="chip">${r.info.ip.includes(':') ? 'IPV6' : 'IPV4'}</span>`);
  if (r.down || r.up) chips.push(`<span class="chip two">${r.sp.streams} STREAM${r.sp.streams > 1 ? 'S' : ''}</span>`);
  if (r.loss) chips.push(`<span class="chip three">WEBRTC LOSS</span>`);
  const conn = navigator.connection?.type;
  if (conn && conn !== 'unknown') chips.push(`<span class="chip ghost">${esc(conn.toUpperCase())}</span>`);
  chips.push(`<span class="chip ghost">${esc(r.info.name)}</span>`);
  $('r-chips').innerHTML = chips.join('');

  const lossSub = r.loss ? `${r.loss.sent} PACKETS` : (r.lossError ? 'FAILED' : 'NOT RUN');
  $('r-tiles').innerHTML = [
    tile(fmtMs(r.ping), 'MS PING', { hl: true, sub: G.pingWord(r.ping) }),
    tile(fmtMs(r.jitter), 'MS JITTER'),
    tile(r.loss ? `${fmtPct(r.loss.totalLoss)}%` : DASH, 'PACKET LOSS', { sub: lossSub }),
    tile(fmtMbps(r.down?.mbps), 'MBPS DOWN', { sub: r.down ? '' : 'NOT RUN' }),
    tile(fmtMbps(r.up?.mbps), 'MBPS UP', { sub: r.up ? '' : 'NOT RUN' }),
    tile(gradeChip(r.grade), 'GRADE', { hl: true, raw: true, sub: r.loss ? '' : 'NO LOSS DATA' }),
  ].join('');

  $('r-down-block').hidden = !r.down;
  if (r.down) renderBars($('r-down-bars'), $('r-down-label'), 'Download', 'Mbps', r.down.perSecond, fmtMbps);
  $('r-up-block').hidden = !r.up;
  if (r.up) renderBars($('r-up-bars'), $('r-up-label'), 'Upload', 'Mbps', r.up.perSecond, fmtMbps);

  $('r-q-label').textContent = `STABILITY ${r.stability ?? DASH}${r.stability == null ? '' : '%'}`;
  $('r-q-ticks').textContent = G.ticks(r.stability);
  const w = G.STABILITY_WEIGHTS;
  const latePart = r.loss ? ` − ${w.late} × late ${fmtPct(r.loss.latePct)}%` : '';
  const lossPart = r.loss ? ` − ${w.loss} × loss ${fmtPct(r.loss.totalLoss)}%` : ' (loss not measured)';
  $('r-why-panel').innerHTML =
    `<b>STABILITY</b> = 100 − ${w.jitter} × jitter ${esc(fmtMs(r.jitter))} ms${esc(lossPart)}${esc(latePart)}, clamped to 0–100.<br>` +
    `<b>JITTER</b> is the mean change between consecutive ping samples (${r.sp.pingSamples} HTTP pings).<br>` +
    `<b>GRADE</b> is the best step every measured value meets: ` +
    G.GRADE_STEPS.map((s) => `${s.grade} ≤ ${s.ping} ms / ${s.jitter} ms / ${s.loss}%`).join(' · ') + ' · otherwise F.<br>' +
    (r.sp.adaptive && (r.down || r.up) ? `<b>DURATION</b> stop when stable: each phase runs at least ${ADAPTIVE.minMs / 1000} s and at least ${ADAPTIVE.afterWarmupMs / 1000} s past the warm-up, then ends once every one-second rate in the last ${ADAPTIVE.windowMs / 1000} s is within ${ADAPTIVE.spread * 100}% of the others, or after ${ADAPTIVE.capBytes / 1e6} MB, and at the latest after ${r.sp.durationS} s. ` +
      [r.down && `Download ran ${r.down.seconds.toFixed(1)} s`, r.up && `upload ran ${r.up.seconds.toFixed(1)} s`].filter(Boolean).join(', ') + '.<br>' : '') +
    (r.loss ? `<b>LOSS</b> ${r.loss.sent} packets of ${r.cfg.packetSize} B at ${r.cfg.rate}/s; late after ${r.cfg.lateMs} ms.` :
      r.lossError ? `<b>LOSS</b> test failed: ${esc(r.lossError)}` : '<b>LOSS</b> phase was switched off.');
  $('r-why-panel').hidden = true;
  $('r-why').setAttribute('aria-expanded', 'false');
  $('r-when').textContent = `MEASURED ${stamp(r.at)} AGAINST ${r.info.name} (${r.info.location})` +
    (r.down || r.up ? ` · FIRST ${r.sp.warmupS} S EXCLUDED FROM SPEED AVERAGES` : '') +
    [r.down?.stopped && ` · DOWNLOAD ${stopNote(r.down).toUpperCase()}`, r.up?.stopped && ` · UPLOAD ${stopNote(r.up).toUpperCase()}`].filter(Boolean).join('');
}

async function runLoss() {
  if (running?.kind === 'loss') { running.ctrl.abort(); return; }
  if (!requireServer()) return;
  let base = server()?.url || '';
  const ctrl = new AbortController();
  const cfg = { ...settings.loss };
  const command = promptFor('loss');
  setRunning('loss', ctrl);

  // Live view: counters, packet map and latency chart on top; the log tail below them.
  const show = (live, result) => {
    $('l-live').hidden = !live;
    $('l-run').hidden = !live;
    $('l-result').hidden = !result;
    $('l-map-block').hidden = !(live || result);
    $('l-charts').hidden = !(live || result);
  };
  show(true, false);
  $('l-map').innerHTML = '';
  $('l-rtt-bars').innerHTML = '';
  $('l-rtt-label').textContent = 'Latency · waiting for packets';
  $('l-lost-block').hidden = true;
  $('l-when').textContent = '';
  window.scrollTo(0, 0);
  const boot = makeBoot('l', command);
  const progress = makeProgress(boot, [
    { key: 'info', weight: 1 },
    { key: 'loss', weight: cfg.durationS + cfg.preWaitS + 3 },
  ]);
  const liveTiles = (rtt, sent, received, perSec) => {
    $('l-live-tiles').innerHTML = [
      tile(String(sent), 'SENT'), tile(String(received), 'RECEIVED'), tile(fmtMs(rtt), 'MS LAST RTT', { hl: true }),
    ].join('');
    if (perSec) renderBars($('l-rtt-bars'), $('l-rtt-label'), 'Latency', 'ms', perSec, fmtMs);
  };
  liveTiles(null, 0, 0);

  try {
    progress.begin('info');
    boot.step(settings.auto ? 'finding the nearest server' : 'resolving server');
    const { url, info } = await openServer(ctrl.signal);
    base = url;
    boot.ok(`${info.name} · ${info.location}`);
    progress.begin('loss');
    const tracker = lossHooks(boot, cfg, (f) => progress.at(f), liveTiles);
    let summary;
    try {
      summary = await runLossTest(base, cfg, { signal: ctrl.signal, ...tracker.hooks });
      tracker.finish(true);
    } catch (err) {
      tracker.finish(false);
      throw err;
    }
    boot.done('complete');
    renderLoss(summary, cfg);
    show(false, true);
    if (settings.history.save) {
      H.add({
        at: new Date().toISOString(), kind: 'loss', server: info.name, down: null, up: null,
        ping: summary.avgRtt, jitter: summary.jitter, loss: summary.totalLoss,
        grade: G.gradeOf({ ping: summary.avgRtt, jitter: summary.jitter, loss: summary.totalLoss }),
      });
    }
  } catch (err) {
    show(false, false);
    if (err.name === 'AbortError') toast('TEST ABORTED', 'info');
    else toast(explainError(err, base));
  } finally {
    setRunning(null);
  }
}

function renderLoss(r, cfg) {
  const noSplit = r.serverReceived == null ? 'NO SERVER COUNT' : '';
  $('l-tiles').innerHTML = [
    tile(`${fmtPct(r.uploadLoss)}%`, 'UPLOAD LOSS', { sub: noSplit || 'TO SERVER' }),
    tile(`${fmtPct(r.downloadLoss)}%`, 'DOWNLOAD LOSS', { sub: noSplit || 'FROM SERVER' }),
    tile(`${fmtPct(r.totalLoss)}%`, 'TOTAL LOSS', { hl: true, sub: `${r.sent - r.received} OF ${r.sent}` }),
    tile(`${fmtPct(r.latePct)}%`, 'LATE PACKETS', { sub: `> ${cfg.lateMs} MS` }),
    tile(fmtMs(r.avgRtt), 'MS AVG LATENCY', { hl: true }),
    tile(fmtMs(r.jitter), 'MS JITTER'),
    tile(fmtMs(r.minRtt), 'MS MIN'),
    tile(fmtMs(r.p95Rtt), 'MS P95'),
    tile(fmtMs(r.maxRtt), 'MS MAX'),
    tile(String(r.sent), 'SENT'),
    tile(String(r.received), 'RECEIVED'),
    tile(fmtBytes(r.bytesEachWay), 'EACH WAY'),
  ].join('');
  // Parameters can change after a run, so the result states the ones it was measured with.
  $('l-when').textContent = `MEASURED ${stamp(new Date())} · ${r.sent} PACKETS OF ${cfg.packetSize} B AT ${cfg.rate}/S · ` +
    `LATE AFTER ${cfg.lateMs} MS · PRE-WAIT ${cfg.preWaitS} S`;
  renderBars($('l-rtt-bars'), $('l-rtt-label'), 'Latency', 'ms', r.perSecond.map((s) => s.avgRtt), fmtMs);
  const lost = r.perSecond.map((s) => s.lost);
  $('l-lost-block').hidden = !lost.some((n) => n > 0);
  renderBars($('l-lost-bars'), $('l-lost-label'), 'Lost', 'packets', lost, (v) => String(Math.round(v)));
}

// ── Idle, history, loss parameters ────────────────────────────────────────
function renderIdle() {
  const last = H.list().find((e) => e.kind !== 'loss');
  const lines = ['<div class="boot-line cmd">❯ awaiting command</div>'];
  if (last) {
    const parts = [];
    if (last.down != null) parts.push(`${fmtMbps(last.down)} mbps down`);
    if (last.ping != null) parts.push(`${fmtMs(last.ping)} ms ping`);
    lines.push(`<div class="boot-line">last run ${esc(stamp(new Date(last.at)))} · ${esc(parts.join(' · '))}</div>`);
  } else {
    lines.push('<div class="boot-line">no result yet · press run test</div>');
  }
  if (!server() && !(settings.auto && ranking)) {
    const why = !settings.auto ? 'no server configured'
      : publicList?.servers.length ? 'no public server answered' : 'no public servers yet';
    lines.push(`<div class="boot-line">${why} · open settings</div>`);
  }
  $('t-idle').innerHTML = lines.join('');
}

function renderHistory() {
  const items = H.list();
  // data-label names each value when the table falls back to stacked rows (fitHistory).
  $('h-rows').innerHTML = items.length ? items.map((e) => {
    const d = new Date(e.at);
    return `<tr>
      <td class="t-key h-when"><span>${pad(d.getDate())}.${pad(d.getMonth() + 1)}</span> <span>${clock(d)}</span></td>
      <td class="t-type h-type">${{ loss: 'LOSS', mlab: 'M-LAB' }[e.kind] || 'FULL'}</td>
      <td class="t-num" data-label="MBPS DOWN">${esc(fmtMbps(e.down))}</td>
      <td class="t-data" data-label="MBPS UP">${esc(fmtMbps(e.up))}</td>
      <td class="t-delta" data-label="MS PING">${esc(fmtMs(e.ping))}</td>
      <td class="t-num" data-label="% LOSS">${esc(fmtPct(e.loss))}</td>
      <td class="h-grade">${gradeChip(e.grade)}</td></tr>`;
  }).join('')
    : '<tr class="empty"><td colspan="7">NO RESULTS YET</td></tr>';
  $('h-clear').disabled = !items.length;
  fitHistory();
}

// The history table must never scroll sideways. When its columns do not fit (narrow phone,
// large text size or system font scaling), rows switch to a stacked two-line layout.
function fitHistory() {
  const wrap = $('h-wrap');
  if (wrap.offsetParent === null) return;
  wrap.classList.remove('stacked');
  wrap.classList.toggle('stacked', wrap.scrollWidth > wrap.clientWidth);
}

function renderPresets() {
  const current = S.matchPreset(settings.loss);
  settings.loss.preset = current;
  const chips = S.LOSS_PRESETS.map((p) => `<button class="chip" data-preset="${p.id}" aria-pressed="${p.id === current}">${esc(p.label)}</button>`);
  chips.push(`<span class="chip ${current === 'custom' ? 'three' : 'ghost'}">CUSTOM</span>`);
  $('l-presets').innerHTML = chips.join('');
  const est = lossEstimate(settings.loss);
  $('l-estimate').textContent = `SENDS ${est.packets} PACKETS · ${fmtBytes(est.bytesEachWay)} EACH WAY · ${fmtBytes(est.bytesEachWay * 2)} TOTAL` +
    (settings.loss.preWaitS ? ` · PLUS ${settings.loss.preWaitS} S PRE-WAIT` : '');
}

// ── Servers ───────────────────────────────────────────────────────────────
async function checkServer(url) {
  try {
    const info = await fetchInfo(url);
    serverStatus.set(url, { ok: true, info });
  } catch (err) {
    serverStatus.set(url, { ok: false, error: explainError(err, url) });
  }
  renderServers();
  renderHeader();
  return serverStatus.get(url);
}

// Loads the public list and pings its servers. Runs at start-up in AUTO mode, when AUTO is
// switched on, before a test when the ranking is old, and from RESCAN.
function rescan(signal) {
  ranking ??= (async () => {
    renderServers();
    publicList = await L.loadList();
    ranked = await L.rankServers(publicList, signal);
    rankedAt = Date.now();
  })().finally(() => {
    ranking = null;
    renderServers();
    renderHeader();
    renderIdle();
    if (settings.auto && ranked[0] && !serverStatus.get(ranked[0].url)?.info) checkServer(ranked[0].url);
  });
  return ranking;
}

function renderAuto() {
  const count = publicList?.servers.length ?? 0;
  const top = ranked[0];
  let detail;
  if (ranking) detail = 'PINGING PUBLIC SERVERS…';
  else if (!publicList) detail = 'SERVER LIST NOT LOADED';
  else if (!count) detail = 'NO PUBLIC SERVERS YET';
  else if (!top) detail = settings.auto ? `NONE OF ${count} ANSWERED` : `${count} SERVER${count > 1 ? 'S' : ''} · NOT PINGED`;
  else detail = `${serverLabel(top.url)} · ${fmtMs(top.rtt)} MS · ${ranked.length} OF ${count} ONLINE`;
  $('s-auto').innerHTML = `<div class="server">
      <span class="led${top ? '' : ' off'}" aria-label="${top ? 'online' : 'none reachable'}"></span>
      <div class="server-main"><div class="server-name">AUTO · NEAREST PUBLIC SERVER</div><div class="server-url">${esc(detail)}</div></div>
      <div class="server-actions">
        <button class="chip${settings.auto ? '' : ' ghost'}" data-auto aria-pressed="${settings.auto}">${settings.auto ? 'IN USE' : 'USE'}</button>
        <button class="chip ghost" data-rescan${ranking ? ' disabled' : ''}>RESCAN</button>
      </div></div>`;
}

function renderServers() {
  renderAuto();
  const list = settings.servers;
  if (!list.length) {
    $('s-servers').innerHTML = '<div class="server-empty">○ NO SERVERS · ADD ONE BELOW</div>';
    return;
  }
  $('s-servers').innerHTML = list.map((s, i) => {
    const st = serverStatus.get(s.url);
    const active = !settings.auto && i === settings.activeServer;
    const name = st?.info ? `${st.info.name} · ${st.info.location}` : (st ? st.error : 'NOT CHECKED');
    return `<div class="server">
      <span class="led${st?.ok ? '' : ' off'}" aria-label="${st?.ok ? 'online' : 'offline or unchecked'}"></span>
      <div class="server-main"><div class="server-name">${esc(name)}</div><div class="server-url">${esc(s.url)}</div></div>
      <div class="server-actions">
        <button class="chip${active ? '' : ' ghost'}" data-use="${i}" aria-pressed="${active}">${active ? 'IN USE' : 'USE'}</button>
        <button class="chip ghost" data-check="${i}">CHECK</button>
        <button class="chip ghost" data-remove="${i}" aria-label="Remove server">✕</button>
      </div></div>`;
  }).join('');
}

// ── Event wiring ──────────────────────────────────────────────────────────
function bind() {
  window.addEventListener('hashchange', route);
  new ResizeObserver(fitHistory).observe($('h-wrap'));
  document.querySelector('.nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) location.hash = `#${b.dataset.view}`;
  });
  $('t-run-btn').addEventListener('click', runFull);
  $('l-run-btn').addEventListener('click', runLoss);
  $('r-why').addEventListener('click', () => {
    const panel = $('r-why-panel');
    panel.hidden = !panel.hidden;
    $('r-why').setAttribute('aria-expanded', String(!panel.hidden));
  });

  document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    setPath(b.dataset.toggle, !getPath(b.dataset.toggle));
    renderToggles();
    applyDisplay();
    renderHeader();
  }));

  document.querySelectorAll('[data-setting]').forEach((input) => input.addEventListener('change', () => {
    const path = input.dataset.setting;
    const v = S.clampSetting(path, input.value);
    if (v === null) { input.value = getPath(path); return; }
    setPath(path, v);
    input.value = v;
    if (path.startsWith('loss.')) renderPresets();
    renderHeader();
  }));

  $('l-presets').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-preset]');
    if (!b || running) return;
    const p = S.LOSS_PRESETS.find((x) => x.id === b.dataset.preset);
    Object.assign(settings.loss, { preset: p.id, packetSize: p.packetSize, rate: p.rate, durationS: p.durationS, lateMs: p.lateMs });
    S.save(settings);
    renderInputs();
    renderPresets();
    renderHeader();
  });

  document.querySelectorAll('.switch[data-axis]').forEach((group) => group.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    setPath(`display.${group.dataset.axis}`, b.dataset.v);
    applyDisplay();
  }));
  const scaleBy = (delta) => {
    settings.display.scale = Math.round(Math.min(1.4, Math.max(0.8, settings.display.scale + delta)) * 10) / 10;
    S.save(settings);
    applyDisplay();
  };
  $('s-scale-down').addEventListener('click', () => scaleBy(-0.1));
  $('s-scale-up').addEventListener('click', () => scaleBy(0.1));

  $('s-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = S.normalizeServerUrl($('s-add-url').value);
    if (!url) { toast('ENTER A HTTP:// OR HTTPS:// ADDRESS'); return; }
    if (!settings.servers.some((s) => s.url === url)) settings.servers.push({ url });
    settings.activeServer = settings.servers.findIndex((s) => s.url === url);
    settings.auto = false;
    S.save(settings);
    $('s-add-url').value = '';
    renderServers();
    renderIdle();
    const st = await checkServer(url);
    toast(st.ok ? `CONNECTED · ${st.info.name}` : st.error, st.ok ? 'info' : 'err');
  });

  $('s-auto').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (running) { toast('WAIT FOR THE RUNNING TEST TO FINISH'); return; }
    if (b.dataset.auto !== undefined) {
      settings.auto = true;
      S.save(settings);
      renderServers();
      renderHeader();
      renderIdle();
      if (!ranked.length) rescan();
    } else if (b.dataset.rescan !== undefined) {
      rescan();
    }
  });

  $('s-servers').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.use !== undefined) {
      if (running) { toast('WAIT FOR THE RUNNING TEST TO FINISH'); return; }
      settings.activeServer = Number(b.dataset.use);
      settings.auto = false;
      S.save(settings);
      renderServers();
      renderHeader();
      checkServer(server().url);
    } else if (b.dataset.check !== undefined) {
      checkServer(settings.servers[Number(b.dataset.check)].url);
    } else if (b.dataset.remove !== undefined) {
      if (running) { toast('WAIT FOR THE RUNNING TEST TO FINISH'); return; }
      const i = Number(b.dataset.remove);
      settings.servers.splice(i, 1);
      if (settings.activeServer >= settings.servers.length || i < settings.activeServer) {
        settings.activeServer = Math.max(0, settings.activeServer - 1);
      }
      S.save(settings);
      renderServers();
      renderIdle();
      renderHeader();
    }
  });

  confirmTap($('h-clear'), '⚠ TAP AGAIN TO DELETE ALL RESULTS', () => {
    H.clear();
    renderHistory();
    renderIdle();
  });

  confirmTap($('s-reset'), '⚠ TAP AGAIN TO RESET SETTINGS + SERVERS', () => {
    if (running) { toast('WAIT FOR THE RUNNING TEST TO FINISH'); return; }
    settings = S.reset();
    S.save(settings);
    applyDisplay();
    renderToggles();
    renderInputs();
    renderPresets();
    renderServers();
    renderIdle();
    renderHeader();
    connectInitial();
  });
}

// At start-up (and after a reset): rank the public servers in AUTO mode, otherwise check
// the custom server. Outside AUTO mode the list is read from the app's own copy only, so
// nothing is fetched from GitHub.
function connectInitial() {
  if (settings.auto) { rescan(); return; }
  L.loadList({ refresh: false }).then((list) => { publicList = list; renderServers(); });
  if (server()) checkServer(server().url);
}

function tickClock() {
  $('clock').textContent = clock(new Date());
}

function init() {
  applyDisplay();
  renderToggles();
  renderInputs();
  renderPresets();
  renderIdle();
  bind();
  route();
  tickClock();
  setInterval(tickClock, 15000);
  connectInitial();
}

init();
