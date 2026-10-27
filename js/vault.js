// PIN-encrypted local storage. Nothing ever leaves the device.
import { b64u, unb64u } from './core.js';

const subtle = globalThis.crypto.subtle;
const STORE_KEY = 'vouch.vault.v1';
const ITERATIONS = 310000;

let key = null;      // AES-GCM key held in memory while unlocked
let salt = null;
let data = null;

async function deriveKey(pin, saltBytes) {
  const base = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: ITERATIONS },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function read() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}

export const exists = () => !!read();
export const isUnlocked = () => !!key;
export const get = () => data;

export async function create(pin) {
  salt = crypto.getRandomValues(new Uint8Array(16));
  key = await deriveKey(pin, salt);
  data = { contacts: [] };
  await save();
}

export async function unlock(pin) {
  const stored = read();
  const s = unb64u(stored.salt);
  const k = await deriveKey(pin, s);
  try {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64u(stored.iv) }, k, unb64u(stored.ct));
    data = JSON.parse(new TextDecoder().decode(pt));
    key = k; salt = s;
    return true;
  } catch {
    return false;
  }
}

export async function save() {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data))));
  localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, salt: b64u(salt), iv: b64u(iv), ct: b64u(ct) }));
}

export async function changePin(pin) {
  salt = crypto.getRandomValues(new Uint8Array(16));
  key = await deriveKey(pin, salt);
  await save();
}

export function lock() {
  key = null; data = null;
}

export function wipe() {
  localStorage.removeItem(STORE_KEY);
  lock();
}
