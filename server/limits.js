// Per-client limits for the measurement API, so a public server cannot be used as an
// unmetered bandwidth sink or be monopolised by one client.
//
//   - An hourly data budget per client (download + upload bytes), refilled continuously.
//   - A cap on parallel download/upload streams per client.
//   - A cap on how many clients can run a throughput test at the same time, so concurrent
//     tests do not share the port and under-report each other. Extra clients get 503.
//   - A cap on concurrent packet-loss sessions per client.
//
// A "client" is an IPv4 address or an IPv6 /64 (one subscriber usually owns a whole /64).
// Clients on the server's own network are not limited (see isLocal).
// All state is in memory and addresses are never logged or written to disk.

const env = process.env;

// Unset uses the default; 0 switches that limit off.
function limit(name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const HOURLY_BYTES = limit('CLIENT_HOURLY_GB', 8) * 1e9;
const CLIENT_STREAMS = limit('CLIENT_MAX_STREAMS', 8);
const ACTIVE_CLIENTS = limit('MAX_ACTIVE_CLIENTS', 3);
const CLIENT_LOSS_SESSIONS = limit('CLIENT_MAX_LOSS_SESSIONS', 2);
const LINGER_MS = 5_000;   // a client keeps its test slot between the download and upload phases
const HOUR_MS = 3_600_000;

const clients = new Map();  // key -> { tokens, at, streams, loss, lingerUntil }
const active = new Set();   // keys holding a test slot

// The client's address. A connection from loopback can only come from this machine, so its
// X-Forwarded-For is trusted: that is a reverse proxy on the same host (Caddy, nginx), and the
// header's last entry is the address the proxy itself saw.
export function clientAddress(req) {
  let ip = req.socket.remoteAddress || '';
  if (isLoopback(ip)) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) ip = String(fwd).split(',').pop().trim();
  }
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function isLoopback(ip) {
  return ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.');
}

// Loopback clients are never limited. Private and link-local clients are on the server's own
// network, where a test can move gigabytes a second at no cost, so they are not limited
// either unless UNLIMITED_PRIVATE_CLIENTS=0. The Docker image sets that: behind Docker's
// bridge NAT (or a load balancer on a private network) every client arrives from a private
// address, and exempting them would switch the limits off for everyone.
const UNLIMITED_PRIVATE = env.UNLIMITED_PRIVATE_CLIENTS !== '0';

export function isLocal(ip) {
  if (isLoopback(ip)) return true;
  if (!UNLIMITED_PRIVATE) return false;
  if (ip.includes(':')) return /^f[cd]/i.test(ip) || /^fe[89ab]/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

// The key limits are counted under, or null for a local client that is not limited.
export function clientKey(ip) {
  if (isLocal(ip)) return null;
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.split('%')[0].split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`;
}

function stateOf(key) {
  const now = Date.now();
  let c = clients.get(key);
  if (!c) {
    c = { tokens: HOURLY_BYTES, at: now, streams: 0, loss: 0, lingerUntil: 0 };
    clients.set(key, c);
  } else if (HOURLY_BYTES) {
    c.tokens = Math.min(HOURLY_BYTES, c.tokens + ((now - c.at) * HOURLY_BYTES) / HOUR_MS);
    c.at = now;
  }
  return c;
}

function holdsSlot(key) {
  const c = clients.get(key);
  return Boolean(c && (c.streams > 0 || c.lingerUntil > Date.now()));
}

function slotsInUse() {
  for (const key of active) if (!holdsSlot(key)) active.delete(key);
  return active.size;
}

// True when a new throughput test from this client would be turned away right now.
export function isBusy(key) {
  return Boolean(ACTIVE_CLIENTS && key) && !holdsSlot(key) && slotsInUse() >= ACTIVE_CLIENTS;
}

function refusal(status, error, retryAfter) {
  return { status, error, retryAfter: Math.max(1, Math.ceil(retryAfter)) };
}

// Admits one download or upload request of at most `bytes`. Returns a refusal
// ({ status, error, retryAfter }) or a stream handle: use(n) records bytes moved, end()
// releases the stream. The whole request is charged to the budget up front and the unused
// part refunded at the end, so parallel requests cannot overshoot the budget.
const UNLIMITED = { use() {}, end() {} };

export function admitStream(key, bytes) {
  if (!key) return UNLIMITED;
  const c = stateOf(key);
  const reserve = HOURLY_BYTES ? Math.min(bytes, HOURLY_BYTES) : 0;
  if (c.tokens < reserve) {
    const wait = ((reserve - c.tokens) / HOURLY_BYTES) * 3600 + 60;
    return refusal(429, `hourly data limit reached for your address, try again in ${Math.ceil(wait / 60)} min`, wait);
  }
  if (CLIENT_STREAMS && c.streams >= CLIENT_STREAMS) {
    return refusal(429, `too many parallel streams from your address (max ${CLIENT_STREAMS})`, 5);
  }
  if (isBusy(key)) return refusal(503, 'server busy, try again shortly', 5);

  c.streams++;
  c.tokens -= reserve;
  active.add(key);
  let open = true;
  let used = 0;
  return {
    use(n) { used += n; },
    end() {
      if (!open) return;
      open = false;
      const s = stateOf(key);
      s.tokens = Math.min(HOURLY_BYTES, s.tokens + Math.max(0, reserve - used));
      c.streams--;
      c.lingerUntil = Date.now() + LINGER_MS;
    },
  };
}

// Admits one packet-loss session. Returns a refusal or a handle whose end() releases it.
export function admitLossSession(key) {
  if (!key) return UNLIMITED;
  const c = stateOf(key);
  if (CLIENT_LOSS_SESSIONS && c.loss >= CLIENT_LOSS_SESSIONS) {
    return refusal(429, `too many packet-loss sessions from your address (max ${CLIENT_LOSS_SESSIONS})`, 10);
  }
  c.loss++;
  let open = true;
  return {
    end() {
      if (!open) return;
      open = false;
      c.loss--;
    },
  };
}

// Forget clients that are idle and whose budget has refilled.
setInterval(() => {
  const now = Date.now();
  for (const [key, c] of clients) {
    if (c.streams || c.loss || c.lingerUntil > now) continue;
    if (!HOURLY_BYTES || c.tokens + ((now - c.at) * HOURLY_BYTES) / HOUR_MS >= HOURLY_BYTES) clients.delete(key);
  }
}, 60_000).unref();
