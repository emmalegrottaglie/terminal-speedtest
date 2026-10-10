// The public server list, and picking the nearest server from it (AUTO mode).
//
// The list is web/servers.json. The app ships with a copy and, in AUTO mode, fetches the
// current one from the repository at most once a day, so servers can be added without an
// app update. Lists are signed with Ed25519 (tools/sign-servers.mjs). A downloaded list is
// used only if its signature matches PUBLIC_KEY, it has not expired, and it is not older
// than the list already in use.

import { probeLatency } from './measure.js';

const PUBLIC_KEY = 'cFzM3a6Mylv1gok6Rsggr4jxIpUt-73Qu06psYLrBl4';
const REMOTE_URL = 'https://raw.githubusercontent.com/emmalegrottaglie/terminal-speedtest/main/web/servers.json';
const BUNDLED_URL = 'servers.json';
const CACHE_KEY = 'termspeed.serverlist.v1';  // { doc, fetchedAt }
const REFRESH_MS = 86_400_000;
const PROBE_SAMPLES = 3;
const PROBE_TIMEOUT_MS = 3000;

let verifierPromise = null;

// Accepts base64 and base64url.
function bytes(base64) {
  const b = base64.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

// A function (signature, message) => Promise<boolean> that checks against PUBLIC_KEY. It uses
// the browser's own Ed25519 where WebCrypto has it, and otherwise the bundled noble-ed25519,
// so Android WebViews from before Ed25519 support can still accept a downloaded list.
function verifier() {
  verifierPromise ??= (async () => {
    try {
      const key = await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: PUBLIC_KEY }, { name: 'Ed25519' }, false, ['verify']);
      return (sig, msg) => crypto.subtle.verify({ name: 'Ed25519' }, key, sig, msg);
    } catch {
      const ed = await import('./vendor/noble-ed25519.js');
      const publicKey = bytes(PUBLIC_KEY);
      return (sig, msg) => ed.verifyAsync(sig, msg, publicKey);
    }
  })().catch((err) => { verifierPromise = null; throw err; });
  return verifierPromise;
}

// true: valid signature. false: invalid. null: no way to check here. Both verifiers need
// crypto.subtle (noble-ed25519 hashes with it), which plain-http pages do not have.
async function verified(doc) {
  if (!globalThis.crypto?.subtle) return null;
  let check;
  try { check = await verifier(); } catch { return null; }
  try {
    return await check(bytes(doc.signature), new TextEncoder().encode(doc.payload));
  } catch {
    return false;  // malformed signature
  }
}

// The list inside a signed document, or null when it can't be trusted. The bundled copy
// came with the app itself, so it is accepted when the signature can't be checked.
async function open(doc, { bundled = false } = {}) {
  if (typeof doc?.payload !== 'string' || typeof doc?.signature !== 'string') return null;
  const ok = await verified(doc);
  if (ok === false || (ok === null && !bundled)) return null;
  let list;
  try { list = JSON.parse(doc.payload); } catch { return null; }
  if (!Number.isFinite(list?.seq) || !Array.isArray(list.servers)) return null;
  if (!(Date.parse(list.expires) > Date.now())) return null;
  list.servers = list.servers.filter((s) =>
    typeof s?.id === 'string' && typeof s.location === 'string' && /^https:\/\/[^/]+$/.test(s.url));
  return list;
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch { return null; }
}

function writeCache(doc) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ doc, fetchedAt: Date.now() })); } catch { /* storage off */ }
}

async function fetchDoc(url) {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`server list answered ${res.status}`);
  return res.json();
}

// The newest trusted list: the cached or bundled copy, refreshed from the repository when
// the cached copy is more than a day old. `refresh: false` never touches the network.
export async function loadList({ refresh = true } = {}) {
  const candidates = [];
  try { candidates.push(await open(await fetchDoc(BUNDLED_URL), { bundled: true })); } catch { /* no bundled copy */ }
  const cache = readCache();
  const cached = cache ? await open(cache.doc) : null;
  candidates.push(cached);
  if (refresh && !(cache && Date.now() - cache.fetchedAt < REFRESH_MS)) {
    try {
      const doc = await fetchDoc(REMOTE_URL);
      const list = await open(doc);
      if (list) {
        // A stale or reverted copy must not replace a newer cached list.
        writeCache(cached && cached.seq > list.seq ? cache.doc : doc);
        candidates.push(list);
      }
    } catch { /* offline or blocked: keep what we have */ }
  }
  return candidates.filter(Boolean).sort((a, b) => b.seq - a.seq)[0] || null;
}

// Servers from the list that answered, nearest first: [{ id, url, location, rtt }].
// Every server is pinged in parallel; each gets PROBE_TIMEOUT_MS to answer.
export async function rankServers(list) {
  const probed = await Promise.all((list?.servers || []).map(async (s) => {
    try {
      const rtt = await probeLatency(s.url, PROBE_SAMPLES, AbortSignal.timeout(PROBE_TIMEOUT_MS));
      return { ...s, rtt };
    } catch {
      return null;
    }
  }));
  return probed.filter(Boolean).sort((a, b) => a.rtt - b.rtt);
}
