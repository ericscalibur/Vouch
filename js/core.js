// Vouch crypto core. Pure functions over WebCrypto; runs in browsers and Node 20+.
import { WORDS } from './wordlist.js';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export const WINDOW_SECONDS = 180;   // one code per 3 minutes
export const CODE_WORDS = 3;         // 33 bits per spoken code
export const KEY_WORDS = 5;          // 55 bits per key fingerprint
const INVITE_PREFIX = 'vouch1.';

// ---------- encoding ----------
export function b64u(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function compare(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

// Read the first n*11 bits of `bytes` as n BIP39 words.
export function bytesToWords(bytes, n) {
  const words = [];
  let acc = 0, bits = 0, i = 0;
  while (words.length < n) {
    acc = (acc << 8) | bytes[i++]; bits += 8;
    if (bits >= 11) {
      bits -= 11;
      words.push(WORDS[(acc >> bits) & 0x7ff]);
      acc &= (1 << bits) - 1;
    }
  }
  return words;
}

// ---------- keys & invites ----------
// P-256 ECDH: supported by WebCrypto on every iOS and Android browser.
export async function generateKeyPair() {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  const privJwk = await subtle.exportKey('jwk', kp.privateKey);
  return { pub, privJwk };
}

export function encodeInvite(pub) {
  return INVITE_PREFIX + b64u(pub);
}

// Accepts a bare invite or any text containing one (e.g. a pasted WhatsApp message).
export function parseInvite(text) {
  const m = String(text).match(/vouch1\.([A-Za-z0-9_-]{80,100})/);
  if (!m) throw new Error('No Vouch invite found in that text.');
  const pub = unb64u(m[1]);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('That invite looks damaged. Ask them to send it again.');
  return pub;
}

// Each person reads the words for THEIR OWN key; the other checks them.
// Comparing per-key (not a combined hash) means an attacker needs a second
// preimage (~2^55 work) rather than a birthday collision.
export async function keyWords(pub) {
  const h = new Uint8Array(await subtle.digest('SHA-256', concat(enc.encode('vouch/key/v1'), pub)));
  return bytesToWords(h, KEY_WORDS);
}

export function roleFor(myPub, theirPub) {
  const c = compare(myPub, theirPub);
  if (c === 0) throw new Error('That is your own invite. Scan or paste theirs instead.');
  return c < 0 ? 'A' : 'B';
}
export const otherRole = r => (r === 'A' ? 'B' : 'A');

// Shared 32-byte seed. `extra` is reserved for the optional two-channel split secret.
export async function deriveSeed(privJwk, myPub, theirPub, extra = new Uint8Array(0)) {
  const priv = await subtle.importKey('jwk', privJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const pubKey = await subtle.importKey('raw', theirPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: pubKey }, priv, 256));
  const [lo, hi] = compare(myPub, theirPub) < 0 ? [myPub, theirPub] : [theirPub, myPub];
  const salt = new Uint8Array(await subtle.digest('SHA-256', concat(lo, hi)));
  const ikm = await subtle.importKey('raw', concat(shared, extra), 'HKDF', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('vouch/seed/v1') }, ikm, 256);
  return new Uint8Array(bits);
}

// ---------- rotating codes ----------
export function counterAt(ms = Date.now()) {
  return Math.floor(ms / 1000 / WINDOW_SECONDS);
}
export function secondsLeft(ms = Date.now()) {
  return WINDOW_SECONDS - Math.floor(ms / 1000) % WINDOW_SECONDS;
}

const hmacCache = new Map();
async function hmacKey(seed) {
  const id = b64u(seed);
  if (!hmacCache.has(id)) {
    hmacCache.set(id, await subtle.importKey('raw', seed, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']));
  }
  return hmacCache.get(id);
}

// kind: 'code' (normal) or 'duress'. role: whose code it is ('A' or 'B').
export async function codeWords(seed, role, counter, kind = 'code') {
  const key = await hmacKey(seed);
  const mac = new Uint8Array(await subtle.sign('HMAC', key, enc.encode(`vouch/${kind}/v1/${role}/${counter}`)));
  return bytesToWords(mac, CODE_WORDS);
}

// Normalise what someone typed: BIP39 words are unique by their first 4 letters.
export function normalizeWords(text) {
  return String(text).toLowerCase().split(/[^a-z]+/).filter(Boolean).map(w => w.slice(0, 4));
}

// Check words the OTHER person said. Accepts the previous/next window for clock drift.
export async function classify(seed, theirRole, text, ms = Date.now()) {
  const said = normalizeWords(text);
  if (said.length !== CODE_WORDS) return 'incomplete';
  const same = ws => ws.every((w, i) => w.slice(0, 4) === said[i]);
  const c = counterAt(ms);
  for (const n of [c, c - 1, c + 1]) {
    if (same(await codeWords(seed, theirRole, n, 'code'))) return 'ok';
    if (same(await codeWords(seed, theirRole, n, 'duress'))) return 'duress';
  }
  return 'none';
}
