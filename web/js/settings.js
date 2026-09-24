// Settings: defaults, validation ranges, loss-test presets and persistence.

const KEY = 'termspeed.settings.v1';

// Each numeric setting carries its own range so the UI and the loader clamp the same way.
export const RANGES = {
  'speed.pingSamples':   { min: 5,  max: 100,  step: 1 },
  'speed.durationS':     { min: 3,  max: 60,   step: 1 },
  'speed.warmupS':       { min: 0,  max: 5,    step: 1 },
  'speed.streams':       { min: 1,  max: 6,    step: 1 },
  'speed.chunkMB':       { min: 1,  max: 200,  step: 1 },
  'speed.uploadChunkMB': { min: 1,  max: 64,   step: 1 },
  'loss.packetSize':     { min: 16, max: 1200, step: 1 },
  'loss.rate':           { min: 1,  max: 250,  step: 1 },
  'loss.durationS':      { min: 3,  max: 120,  step: 1 },
  'loss.lateMs':         { min: 20, max: 2000, step: 10 },
  'loss.preWaitS':       { min: 0,  max: 10,   step: 1 },
};

// Traffic profiles for the packet-loss test. Values approximate the packet rate and size
// of each kind of traffic; they are starting points, not measurements of specific products.
export const LOSS_PRESETS = [
  { id: 'default', label: 'DEFAULT',     packetSize: 220,  rate: 15,  durationS: 10, lateMs: 200 },
  { id: 'fps64',   label: 'FPS 64 HZ',   packetSize: 180,  rate: 64,  durationS: 15, lateMs: 100 },
  { id: 'fps128',  label: 'FPS 128 HZ',  packetSize: 180,  rate: 128, durationS: 15, lateMs: 80 },
  { id: 'voip',    label: 'VOIP',        packetSize: 160,  rate: 50,  durationS: 20, lateMs: 150 },
  { id: 'video',   label: 'VIDEO CALL',  packetSize: 1100, rate: 100, durationS: 15, lateMs: 250 },
  { id: 'stress',  label: 'STRESS',      packetSize: 1200, rate: 250, durationS: 30, lateMs: 300 },
];

function isNative() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

// When the page is served by the measurement server itself, that server is the default.
function defaultServers() {
  if (isNative() || !/^https?:$/.test(location.protocol)) return [];
  return [{ url: location.origin }];
}

export function defaults() {
  const p = LOSS_PRESETS[0];
  return {
    servers: defaultServers(),
    activeServer: 0,
    speed: {
      pingSamples: 20, durationS: 10, warmupS: 1, streams: 4, chunkMB: 25, uploadChunkMB: 8,
      runDownload: true, runUpload: true, runLoss: true,
    },
    loss: { preset: p.id, packetSize: p.packetSize, rate: p.rate, durationS: p.durationS, lateMs: p.lateMs, preWaitS: 2 },
    display: { palette: 'term-phosphor', accents: 'broadcast', font: 'jetbrains', crt: true, scale: 1 },
    history: { save: true },
  };
}

export function clampSetting(path, value) {
  const r = RANGES[path];
  const n = Number(value);
  if (!r || !Number.isFinite(n)) return null;
  return Math.min(r.max, Math.max(r.min, Math.round(n / r.step) * r.step));
}

// Merge stored values over defaults, keeping only known keys with valid values.
function sanitize(stored) {
  const out = defaults();
  if (!stored || typeof stored !== 'object') return out;
  for (const group of ['speed', 'loss', 'display', 'history']) {
    for (const key of Object.keys(out[group])) {
      const v = stored[group]?.[key];
      if (v === undefined) continue;
      const path = `${group}.${key}`;
      if (RANGES[path]) {
        const c = clampSetting(path, v);
        if (c !== null) out[group][key] = c;
      } else if (typeof v === typeof out[group][key]) {
        out[group][key] = v;
      }
    }
  }
  if (Array.isArray(stored.servers)) {
    const servers = stored.servers.map((s) => normalizeServerUrl(s?.url)).filter(Boolean).map((url) => ({ url }));
    if (servers.length || !out.servers.length) out.servers = servers;
  }
  const idx = Number(stored.activeServer);
  out.activeServer = Number.isInteger(idx) && idx >= 0 && idx < out.servers.length ? idx : 0;
  out.display.scale = Math.min(1.4, Math.max(0.8, Number(out.display.scale) || 1));
  return out;
}

export function normalizeServerUrl(raw) {
  if (typeof raw !== 'string') return null;
  let text = raw.trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = 'http://' + text;
  try {
    const u = new URL(text);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function load() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return defaults();
  }
}

export function save(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode, quota): settings last for this session only.
  }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return defaults();
}

export function activeServer(settings) {
  return settings.servers[settings.activeServer] || null;
}

export function matchPreset(loss) {
  const p = LOSS_PRESETS.find((x) =>
    x.packetSize === loss.packetSize && x.rate === loss.rate && x.durationS === loss.durationS && x.lateMs === loss.lateMs);
  return p ? p.id : 'custom';
}
