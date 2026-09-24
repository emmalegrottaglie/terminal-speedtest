// Past results, kept only on this device.

const KEY = 'termspeed.history.v1';
const MAX = 100;

export function list() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function add(entry) {
  const items = [entry, ...list()].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
  return items;
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
