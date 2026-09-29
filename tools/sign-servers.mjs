// Signs the public server list, so the app can trust a list it downloads.
//
//   node tools/sign-servers.mjs keygen   create the signing key (once) and print the public key
//   node tools/sign-servers.mjs          sign servers/list.json into web/servers.json
//
// The private key lives outside the repository, at ~/.termspeed/servers-ed25519.pem, or at
// the path in TERMSPEED_SIGNING_KEY. Never commit it. Anyone holding it can publish a list
// the app will trust. The public key goes into PUBLIC_KEY in web/js/serverlist.js.

import { generateKeyPairSync, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'servers', 'list.json');
const OUTPUT = path.join(ROOT, 'web', 'servers.json');
const KEY_FILE = process.env.TERMSPEED_SIGNING_KEY || path.join(homedir(), '.termspeed', 'servers-ed25519.pem');
const VALID_DAYS = 365;

function publicKeyOf(privateKey) {
  return createPublicKey(privateKey).export({ format: 'jwk' }).x;
}

function keygen() {
  if (existsSync(KEY_FILE)) {
    console.error(`${KEY_FILE} already exists; not overwriting it.`);
    process.exit(1);
  }
  const { privateKey } = generateKeyPairSync('ed25519');
  mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  writeFileSync(KEY_FILE, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  console.log(`Private key written to ${KEY_FILE}. Back it up somewhere safe, such as a password manager.`);
  console.log(`Public key for web/js/serverlist.js: ${publicKeyOf(privateKey)}`);
}

function validate(list) {
  if (!Array.isArray(list?.servers)) throw new Error('servers/list.json needs a "servers" array');
  const ids = new Set();
  for (const s of list.servers) {
    if (typeof s.id !== 'string' || !/^[a-z0-9-]{2,24}$/.test(s.id)) throw new Error(`bad id: ${JSON.stringify(s.id)}`);
    if (ids.has(s.id)) throw new Error(`duplicate id: ${s.id}`);
    ids.add(s.id);
    const url = new URL(s.url);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search) throw new Error(`${s.id}: url must be https://host with no path`);
    if (typeof s.location !== 'string' || !s.location) throw new Error(`${s.id}: location is required`);
  }
  return list.servers.map(({ id, url, location }) => ({ id, url: new URL(url).origin, location }));
}

function signList() {
  const privateKey = createPrivateKey(readFileSync(KEY_FILE));
  const servers = validate(JSON.parse(readFileSync(SOURCE, 'utf8')));
  const now = new Date();
  // seq only ever grows, so the app can refuse to go back to an older list.
  const payload = JSON.stringify({
    seq: Math.floor(now.getTime() / 1000),
    updated: now.toISOString(),
    expires: new Date(now.getTime() + VALID_DAYS * 86_400_000).toISOString(),
    servers,
  });
  const signature = sign(null, Buffer.from(payload), privateKey).toString('base64');
  writeFileSync(OUTPUT, JSON.stringify({ payload, signature }, null, 2) + '\n');
  console.log(`Signed ${servers.length} server(s) into ${path.relative(ROOT, OUTPUT)}, valid for ${VALID_DAYS} days.`);
  console.log(`Public key: ${publicKeyOf(privateKey)}`);
}

if (process.argv[2] === 'keygen') keygen();
else signList();
