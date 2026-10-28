import * as C from './core.js';
import * as V from './vault.js';

const APP_VERSION = '0.2.5';
const RELEASES_URL = 'https://github.com/ericscalibur/Vouch/releases';
const PIN_LENGTH = 6;
const AUTO_LOCK_MS = 60_000;
const HOLD_FOR_DURESS_MS = 1500;

const $app = document.getElementById('app');
let cleanups = [];

// ---------- helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = sel => $app.querySelector(sel);
const contacts = () => V.get().contacts;
const findContact = id => contacts().find(c => c.id === id);
const initial = name => esc((name.trim()[0] || '?').toUpperCase());
const wordList = (words, cls = '') =>
  `<ol class="words ${cls}">${words.map((w, i) => `<li data-n="${i + 1}">${esc(w)}</li>`).join('')}</ol>`;
// crypto.randomUUID needs iOS 15.4+; fall back for older iPhones.
const newId = () => crypto.randomUUID?.() ?? C.b64u(crypto.getRandomValues(new Uint8Array(16)));
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const icon = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  kebab: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  paste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/></svg>',
};

const mark = `<svg class="hero-mark" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="28" fill="#16181d"/>
  <path d="M26 34l22 34 22-34" stroke="#7ce0b5" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="26" cy="34" r="3" fill="#7ce0b5"/><circle cx="70" cy="34" r="3" fill="#7ce0b5"/>
</svg>`;

let backHandler = null;   // what the phone's Back button does on the current screen
let scannerCancel = null;

function render(html) {
  cleanups.forEach(fn => fn());
  cleanups = [];
  backHandler = null;
  closeSheet();
  $app.innerHTML = `<main class="screen">${html}</main>`;
  window.scrollTo(0, 0);
}

function bar({ title = '', back = null, right = '' }) {
  return `<header class="bar">
    ${back ? `<button class="icon-btn" data-back aria-label="Back">${icon.back}</button>` : ''}
    <h1 ${back ? '' : 'class="brand"'}>${esc(title)}</h1>${right}
  </header>`;
}
function wireBack(fn) {
  backHandler = fn;
  const b = $('[data-back]');
  if (b) b.onclick = fn;
}

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

function sheet(html) {
  closeSheet();
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  o.addEventListener('click', e => { if (e.target === o) closeSheet(); });
  document.body.appendChild(o);
  return o.querySelector('.sheet');
}
function closeSheet() {
  document.querySelector('.overlay')?.remove();
}

async function persist() {
  await V.save();
}

// Ask the browser to treat Vouch's storage as important, so it's never cleared
// to free up space. There's no backup yet, so losing it would mean re-pairing everyone.
async function keepStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not supported: nothing to do */ }
}

// ---------- PIN pad ----------
function pinScreen({ title, subtitle = '', back = null, hero = false, onPin }) {
  let pin = '';
  render(`
    ${back ? bar({ title: '', back: true }) : ''}
    <div class="pin">
      <div>
        ${hero ? `<div style="margin-bottom:16px">${mark}</div>` : ''}
        <p class="title" style="font-size:24px">${esc(title)}</p>
        ${subtitle ? `<p class="lead" style="margin-top:8px">${esc(subtitle)}</p>` : ''}
      </div>
      <div class="pin-dots">${'<i></i>'.repeat(PIN_LENGTH)}</div>
      <div class="pin-msg" aria-live="polite"></div>
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-k="${n}">${n}</button>`).join('')}
        <button class="key blank" aria-hidden="true"></button>
        <button class="key" data-k="0">0</button>
        <button class="key fn" data-k="del" aria-label="Delete">Delete</button>
      </div>
    </div>`);
  if (back) wireBack(back);
  const dots = $('.pin-dots'), msg = $('.pin-msg');
  let busy = false;
  const draw = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const fail = text => {
    msg.textContent = text;
    dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
    navigator.vibrate?.(80);
    pin = ''; draw();
  };
  const press = async k => {
    if (busy) return;
    if (k === 'del') { pin = pin.slice(0, -1); draw(); return; }
    if (pin.length >= PIN_LENGTH) return;
    pin += k; draw(); msg.textContent = '';
    if (pin.length === PIN_LENGTH) {
      busy = true;
      const err = await onPin(pin);
      busy = false;
      if (err) fail(err);
    }
  };
  $('.keypad').onclick = e => { const k = e.target.closest('[data-k]')?.dataset.k; if (k) press(k); };
  const onKey = e => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  };
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));
}

// ---------- onboarding & lock ----------
// Chrome and Edge on Android offer their own install prompt. Hold on to it so
// the tour can show an Install button; elsewhere the tour explains the menu.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  if (exists()) return; // already set up: let the browser show its usual prompt
  e.preventDefault();
  installPrompt = e;
});
window.addEventListener('appinstalled', () => { installPrompt = null; toast('Vouch is on your home screen'); });

const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const chip = svg => `<span class="chip">${svg}</span>`;

// Where "Add to Home Screen" lives depends on the phone and browser.
const iosSteps = [
  `Tap Share ${chip(icon.share)}. In Safari it's at the bottom (on newer iPhones, tap ${chip(icon.more)} first). In Chrome it's at the top.`,
  `Scroll down and tap <strong>Add to Home Screen</strong>.`,
  `Tap <strong>Add</strong>, then open Vouch from your home screen.`,
];
const iosNote = `On iPhone, the home screen app keeps its own storage. Finish setting up there, not in the browser. Don't see the option? Open this page in Safari.`;
const androidSteps = [
  `In Chrome, tap the menu ${chip(icon.kebab)} in the top right.`,
  `Tap <strong>Add to Home screen</strong> (it may say <strong>Install app</strong>).`,
  `If it asks, pick <strong>Install</strong>, not <strong>Create shortcut</strong>. Then confirm.`,
];

function installSteps() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return { groups: [{ steps: iosSteps }], note: iosNote };
  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) return { groups: [{ steps: [
      `Tap the menu ${chip(icon.menu)} at the bottom of the screen.`,
      `Tap <strong>Add page to</strong>, then <strong>Home screen</strong>.`,
      `Tap <strong>Add</strong>.`,
    ] }] };
    if (/Firefox/.test(ua)) return { groups: [{ steps: [
      `Tap the menu ${chip(icon.kebab)}.`,
      `Tap <strong>Install</strong> or <strong>Add to Home screen</strong>.`,
      `Tap <strong>Add</strong> to confirm.`,
    ] }] };
    return { groups: [{ steps: androidSteps }] };
  }
  // On a computer: Vouch belongs on a phone, so hand it over with a QR code.
  return { desktop: true, groups: [{ label: 'Android', steps: androidSteps }, { label: 'iPhone', steps: iosSteps }], note: iosNote };
}

function pageQR(text = location.origin + location.pathname) {
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return `<div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div>`;
  } catch { return ''; }
}

const demoWords = { mine: ['orbit', 'maple', 'garden'], theirs: ['rocket', 'tunnel', 'cherry'], duress: ['velvet', 'harbor', 'pencil'] };

const tourSlides = () => [
  ...(installed() ? [] : [{
    body: () => {
      const how = installSteps();
      const list = steps => `<ol class="howto">${steps.map(s => `<li><span>${s}</span></li>`).join('')}</ol>`;
      if (how.desktop) return `
        <h1 class="title">Vouch lives on your phone</h1>
        <p class="lead">Scan this with your phone's camera to open Vouch there. Then add it to your home screen.</p>
        ${pageQR()}
        ${how.groups.map(g => `<p class="label">${g.label}</p>${list(g.steps)}`).join('')}
        <p class="small">${how.note}</p>`;
      return `
        <h1 class="title">First, put Vouch on your home screen</h1>
        <p class="lead">It then opens like an app, works offline, and is ready the moment a suspicious call comes in.</p>
        ${installPrompt ? `<button class="btn primary" id="install">${icon.plus} Install Vouch</button>
          <p class="small">Or do it from your browser's menu:</p>` : ''}
        ${list(how.groups[0].steps)}
        ${how.note ? `<p class="small">${how.note}</p>` : ''}`;
    },
    wire: next => {
      $('#install')?.addEventListener('click', async () => {
        const p = installPrompt;
        installPrompt = null;
        await p.prompt();
        const { outcome } = await p.userChoice;
        if (outcome === 'accepted') next();
        else welcome(0);
      });
    },
  }]),
  {
    body: () => `
      ${mark}
      <h1 class="title">Authenticate your closest contacts.</h1>
      <p class="lead">Pair your phones once. From then on, you can Vouch.</p>
      <p class="small">In a world of deepfakes and voice cloning, Vouch gives you a means to authenticate your closest peers.</p>`,
  },
  {
    body: () => `
      <h1 class="title">Pair once with each person you trust</h1>
      <p class="lead">There are two ways to do it.</p>
      <section class="card accent">
        <div class="way"><h2>Together</h2><span class="badge">Best</span></div>
        <p class="small">Open Vouch on both phones and scan each other's code. That's it, you're paired.</p>
        <div class="mock" aria-hidden="true">
          <div class="step"><b>1</b><h2>Give Alex your invite</h2></div>
          ${pageQR('Example only: open Vouch to get your own code.')}
          <div class="step done"><b>✓</b><h2>Got Alex's invite</h2></div>
          <span class="btn primary">We’ve both scanned</span>
        </div>
      </section>
      <section class="card">
        <div class="way"><h2>Far apart</h2></div>
        <p class="small">Send your invite on any app. Then compare pairing words somewhere you already know it's them: their usual phone number, their usual email. A video call if there's nothing better.</p>
      </section>`,
  },
  {
    body: () => `
      <h1 class="title">On a call, swap three words</h1>
      <p class="lead">Open their name. You each say your words. If theirs match the screen, it's really them. The words change every 3 minutes.</p>
      <div class="demo" aria-hidden="true">
        <section class="card"><p class="label">You say</p>${wordList(demoWords.mine, 'compact')}</section>
        <section class="card accent"><p class="label">Alex should say</p>${wordList(demoWords.theirs, 'compact')}</section>
        <div class="timer"><div class="track"><div class="fill" style="width:62%"></div></div><span>1:52</span></div>
      </div>`,
  },
  {
    body: () => `
      <h1 class="title">If someone is forcing you</h1>
      <p class="lead">Press and hold your words. They switch to duress words that look completely normal. On the other phone they won't match, and Vouch quietly warns them.</p>
      <section class="card say" id="demo-say">
        <p class="label">You say<span class="dot" id="demo-dot"></span></p>
        <div id="demo-words">${wordList(demoWords.mine, 'compact')}</div>
      </section>
      <p class="small" style="text-align:center">Try it: press and hold the card.</p>`,
    wire: () => {
      const say = $('#demo-say');
      let duress = false, hold = null;
      const start = () => {
        hold = setTimeout(() => {
          duress = !duress;
          navigator.vibrate?.(15);
          $('#demo-words').innerHTML = wordList(duress ? demoWords.duress : demoWords.mine, 'compact');
          $('#demo-dot').classList.toggle('on', duress);
        }, HOLD_FOR_DURESS_MS);
      };
      const cancel = () => clearTimeout(hold);
      say.addEventListener('pointerdown', start);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => say.addEventListener(ev, cancel));
      say.addEventListener('contextmenu', e => e.preventDefault());
      cleanups.push(cancel);
    },
  },
  {
    body: () => `
      ${mark}
      <h1 class="title">Everything stays on this phone</h1>
      <p class="lead">No account, no server. Last step: choose a PIN. It locks Vouch and encrypts your contacts.</p>`,
    last: true,
  },
];

// A short tour before the PIN. It opens with how to install, unless Vouch
// is already running from the home screen. at < 0 counts from the end.
function welcome(at = 0) {
  const slides = tourSlides();
  const i = Math.max(0, Math.min(slides.length - 1, at < 0 ? slides.length + at : at));
  const s = slides[i];
  const go = n => welcome(n);
  render(`
    <header class="bar tour-bar">
      <div class="tour-dots">${slides.map((_, n) => `<i class="${n === i ? 'on' : ''}"></i>`).join('')}</div>
      ${s.last ? '' : '<button class="btn ghost tour-skip" id="skip">Skip</button>'}
    </header>
    <div class="tour">${s.body()}</div>
    <div class="spacer"></div>
    <div class="row">
      ${i > 0 ? '<button class="btn" id="prev">Back</button>' : ''}
      <button class="btn primary" id="next">${s.last ? 'Create your PIN' : 'Next'}</button>
    </div>`);
  const next = () => (s.last ? setupPin() : go(i + 1));
  const prev = i > 0 ? () => go(i - 1) : null;
  wireBack(prev);
  $('#next').onclick = next;
  $('#prev')?.addEventListener('click', prev);
  $('#skip')?.addEventListener('click', () => go(-1));
  s.wire?.(next);

  // Swipe between slides.
  let x0 = null;
  const down = e => { x0 = e.touches[0].clientX; };
  const up = e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (dx < -60) next();
    else if (dx > 60 && prev) prev();
  };
  $app.addEventListener('touchstart', down, { passive: true });
  $app.addEventListener('touchend', up);
  cleanups.push(() => { $app.removeEventListener('touchstart', down); $app.removeEventListener('touchend', up); });
}

function setupPin() {
  pinScreen({
    title: 'Choose a 6-digit PIN',
    subtitle: 'It locks Vouch and encrypts your contacts on this phone.',
    back: exists() ? null : () => welcome(-1),
    onPin: async first => {
      pinScreen({
        title: 'Enter it again',
        back: setupPin,
        onPin: async second => {
          if (second !== first) { setTimeout(setupPin, 700); return 'PINs didn’t match. Try again.'; }
          await V.create(first);
          keepStorage();
          home();
        },
      });
    },
  });
}
const exists = () => V.exists();

let failures = 0, lockedUntil = 0;
function lockScreen() {
  pinScreen({
    title: 'Vouch is locked',
    subtitle: 'Enter your PIN to open it.',
    hero: true,
    onPin: async pin => {
      if (Date.now() < lockedUntil) return `Too many tries. Wait ${Math.ceil((lockedUntil - Date.now()) / 1000)}s.`;
      if (await V.unlock(pin)) {
        failures = 0; home(); keepStorage();
        let from = null;
        try { from = sessionStorage.getItem('vouch.updatedFrom'); sessionStorage.removeItem('vouch.updatedFrom'); } catch {}
        if (from && from !== APP_VERSION) toast(`Updated to version ${APP_VERSION}`);
        return;
      }
      failures++;
      if (failures >= 5) { lockedUntil = Date.now() + 30_000 * (failures - 4); return 'Too many tries. Wait 30 seconds.'; }
      return 'Wrong PIN';
    },
  });
}

// ---------- home ----------
function home() {
  const list = [...contacts()].sort((a, b) => a.name.localeCompare(b.name));
  render(`
    ${bar({ title: 'Vouch', right: `<button class="icon-btn" id="settings" aria-label="Settings">${icon.gear}</button>` })}
    <div id="update-banner"></div>
    ${list.length ? `
      <div class="list">
        ${list.map(c => `
          <button class="contact" data-id="${c.id}">
            <span class="avatar ${c.status === 'paired' ? '' : 'pending'}">${initial(c.name)}</span>
            <span>
              <div class="name">${esc(c.name)}</div>
              <div class="meta">${c.status === 'paired' ? 'Tap to verify a call' : c.theirPubPending ? (c.theirPubScanned ? 'Ready to finish pairing' : 'Ready to compare words') : 'Pairing not finished'}</div>
            </span>
            <span class="chev">${icon.chev}</span>
          </button>`).join('')}
      </div>
      <div class="spacer"></div>
      <button class="btn primary" id="add">${icon.plus} Add someone</button>`
    : `
      <div class="empty">
        ${mark}
        <h2 class="title" style="font-size:24px">Add someone you trust</h2>
        <p class="lead">Start with the people whose voice a scammer would most likely fake: family first.</p>
      </div>
      <div class="spacer"></div>
      <button class="btn primary" id="add">${icon.plus} Add someone</button>`}
  `);
  $('#settings').onclick = settings;
  drawUpdateBanner();
  $('#add').onclick = addContact;
  $app.querySelectorAll('.contact').forEach(el => {
    el.onclick = () => {
      const c = findContact(el.dataset.id);
      c.status === 'paired' ? verify(c.id) : pairing(c.id);
    };
  });
}

// ---------- add & pair ----------
function addContact() {
  render(`
    ${bar({ title: 'Add someone', back: true })}
    <h2 class="title">Who are you pairing with?</h2>
    <p class="lead">Just a name for your own list. It's never shared.</p>
    <input class="field" id="name" maxlength="40" placeholder="e.g. Dad" autocomplete="off" enterkeyhint="next">
    <div class="spacer"></div>
    <button class="btn primary" id="next" disabled>Continue</button>`);
  wireBack(home);
  const input = $('#name'), next = $('#next');
  input.oninput = () => { next.disabled = !input.value.trim(); };
  input.onkeydown = e => { if (e.key === 'Enter' && input.value.trim()) next.click(); };
  setTimeout(() => input.focus(), 50);
  next.onclick = async () => {
    next.disabled = true;
    const { pub, privJwk } = await C.generateKeyPair();
    const c = { id: newId(), name: input.value.trim(), status: 'pending', myPub: C.b64u(pub), privJwk, created: Date.now() };
    contacts().push(c);
    await persist();
    pairing(c.id);
  };
}

function inviteMessage(invite) {
  const appUrl = location.origin + location.pathname.replace(/index\.html$/, '');
  return `Let's pair on Vouch so we can always prove it's really us on calls.\n\n` +
    `1. Get Vouch: ${appUrl}\n` +
    `   (iPhone: open in Safari > Share > Add to Home Screen)\n` +
    `2. Open it, tap "Add someone", and paste this whole message.\n\n` +
    `My invite:\n${invite}`;
}

function pairing(id) {
  const c = findContact(id);
  const invite = C.encodeInvite(C.unb64u(c.myPub));
  let qrSvg = '';
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(invite);
    qr.make();
    qrSvg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  } catch { /* QR lib missing: paste flow still works */ }

  render(`
    ${bar({ title: `Pair with ${c.name}`, back: true, right: `<button class="icon-btn" id="more" aria-label="Options">${icon.more}</button>` })}
    <section class="card">
      <div class="step"><b>1</b><h2>Give ${esc(c.name)} your invite</h2></div>
      <p class="small">Together? Let them scan this. Far apart? Send it on any app: WhatsApp, email, text. It's safe if someone else sees it.</p>
      ${qrSvg ? `<div class="qr">${qrSvg}</div>` : ''}
      <div class="row">
        ${navigator.share ? `<button class="btn" id="share">${icon.share} Send</button>` : ''}
        <button class="btn" id="copy">${icon.copy} Copy</button>
      </div>
    </section>
    ${c.theirPubPending ? `
    <section class="card accent">
      <div class="step done"><b>✓</b><h2>Got ${esc(c.name)}'s invite</h2></div>
      <p class="small">${c.theirPubScanned
        ? `Now let ${esc(c.name)} scan your code above. Once you've both scanned, you're done.`
        : `Make sure ${esc(c.name)} has yours too: let them scan the code above, or send it.`}</p>
      <button class="btn ghost" id="replace" style="min-height:40px;font-size:15px">Wrong code? Replace it</button>
    </section>
    <div class="spacer"></div>
    <button class="btn primary" id="compare">${c.theirPubScanned ? 'We’ve both scanned' : 'Next: compare words'}</button>` : `
    <section class="card">
      <div class="step"><b>2</b><h2>Add their invite</h2></div>
      <p class="small">They tap “Add someone” in their Vouch too, then send you theirs.</p>
      <button class="btn" id="scan">${icon.scan} Scan their code</button>
      <textarea class="field" id="paste" placeholder="Got their invite as a message? Copy the whole message and paste it here." autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
      <p class="small" id="paste-msg" style="color:var(--danger)"></p>
    </section>`}`);
  wireBack(home);

  $('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(inviteMessage(invite)); toast('Invite copied'); }
    catch { toast('Couldn’t copy. Long-press to select instead.'); }
  };
  $('#share')?.addEventListener('click', () => navigator.share({ text: inviteMessage(invite) }).catch(() => {}));
  $('#more').onclick = () => manageSheet(c);

  // Keep their invite and stay on this screen, so your own code stays visible
  // for them to scan (in person) or send (remote).
  // A code scanned off their own screen, in person, can't have been swapped on
  // the way, so that path skips reading out the pairing words.
  const accept = async (text, scanned = false) => {
    try {
      const theirPub = C.parseInvite(text);
      C.roleFor(C.unb64u(c.myPub), theirPub);
      c.theirPubPending = C.b64u(theirPub);
      if (scanned) c.theirPubScanned = true; else delete c.theirPubScanned;
      await persist();
      navigator.vibrate?.(30);
      toast(`Got ${c.name}'s invite`);
      pairing(id);
    } catch (e) {
      const msg = $('#paste-msg');
      if (msg) msg.textContent = e.message; else toast(e.message);
    }
  };
  if (c.theirPubPending) {
    const theirPub = C.unb64u(c.theirPubPending);
    $('#compare').onclick = () => c.theirPubScanned ? confirmInPerson(id, theirPub) : confirmPair(id, theirPub);
    $('#replace').onclick = async () => { delete c.theirPubPending; delete c.theirPubScanned; await persist(); pairing(id); };
    return;
  }
  $('#paste').oninput = e => { if (e.target.value.trim()) accept(e.target.value); };
  $('#scan').onclick = async () => {
    const text = await scanQR();
    if (text) accept(text, true);
  };
}

// Scanned in person: no need to read out words. But a QR can also arrive as a
// screenshot, so check it really came off their phone before trusting it.
function confirmInPerson(id, theirPub) {
  const c = findContact(id);
  const s = sheet(`
    <h2>Finish pairing?</h2>
    <p class="small">Only if both are true:</p>
    <ol class="howto">
      <li><span>You scanned ${esc(c.name)}'s code off <strong>their own phone</strong>, in person. Not a screenshot or a photo.</span></li>
      <li><span>${esc(c.name)} has scanned yours too.</span></li>
    </ol>
    <button class="btn primary" id="finish">Yes, finish pairing</button>
    <button class="btn ghost" id="words">No, compare words instead</button>`);
  s.querySelector('#finish').onclick = () => finishPair(id, theirPub);
  s.querySelector('#words').onclick = () => confirmPair(id, theirPub);
}

async function finishPair(id, theirPub) {
  const c = findContact(id);
  const myPub = C.unb64u(c.myPub);
  const seed = await C.deriveSeed(c.privJwk, myPub, theirPub);
  Object.assign(c, { status: 'paired', seed: C.b64u(seed), role: C.roleFor(myPub, theirPub), theirPub: C.b64u(theirPub), paired: Date.now() });
  delete c.privJwk; // only the shared seed is needed from now on
  delete c.theirPubPending;
  delete c.theirPubScanned;
  await persist();
  toast(`Paired with ${c.name}`);
  verify(id);
}

async function confirmPair(id, theirPub) {
  const c = findContact(id);
  const mine = await C.keyWords(C.unb64u(c.myPub));
  const theirs = await C.keyWords(theirPub);
  render(`
    ${bar({ title: `Pair with ${c.name}`, back: true })}
    <h2 class="title">Make sure it's really ${esc(c.name)}</h2>
    <p class="lead">Compare these somewhere you already know it's really ${esc(c.name)}: a call or text to their usual number, their usual email, an account you've used together for years.</p>
    <p class="small">Use a video call only if there's nothing better. Voices and faces can be faked, so a channel you already trust is safer. Avoid the app you sent the invite on.</p>
    <section class="card">
      <p class="label">Your words</p>
      ${wordList(mine, 'compact')}
    </section>
    <section class="card accent">
      <p class="label">${esc(c.name)}'s words should be</p>
      ${wordList(theirs, 'compact')}
    </section>
    <p class="small">Talking on a call? For extra safety, also ask a question only the real ${esc(c.name)} would know.</p>
    <div class="spacer"></div>
    <button class="btn primary" id="yes">All words match</button>
    <button class="btn danger" id="no">They don't match</button>`);
  wireBack(() => pairing(id));

  $('#yes').onclick = () => finishPair(id, theirPub);
  $('#no').onclick = () => {
    const s = sheet(`
      <h2>Don't pair yet</h2>
      <p class="result bad">If the words differ, the invite may have been swapped on the way. Someone could be pretending to be ${esc(c.name)}.</p>
      <p class="small">Throw this invite away. Send invites again, then compare the words over a channel you already trust with ${esc(c.name)}, like their usual phone number.</p>
      <button class="btn primary" id="retry">Start over</button>`);
    s.querySelector('#retry').onclick = async () => {
      const { pub, privJwk } = await C.generateKeyPair();
      Object.assign(c, { myPub: C.b64u(pub), privJwk });
      delete c.theirPubPending;
      delete c.theirPubScanned;
      await persist();
      pairing(id);
    };
  };
}

// ---------- scanner ----------
function scanQR() {
  return new Promise(async resolve => {
    if (!navigator.mediaDevices?.getUserMedia || !window.jsQR) {
      toast('Camera not available. Paste their invite instead.');
      return resolve(null);
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      toast('Camera access was blocked. Paste their invite instead.');
      return resolve(null);
    }
    const el = document.createElement('div');
    el.className = 'scanner';
    el.innerHTML = `<video playsinline muted autoplay></video><div class="frame"></div>
      <div class="scan-ui"><p class="lead" style="color:#fff">Point at their Vouch code</p>
      <button class="btn" id="scan-cancel">Cancel</button></div>`;
    document.body.appendChild(el);
    const video = el.querySelector('video');
    video.srcObject = stream;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let done = false;
    const finish = result => {
      if (done) return;
      done = true;
      scannerCancel = null;
      stream.getTracks().forEach(t => t.stop());
      el.remove();
      resolve(result);
    };
    scannerCancel = () => finish(null);
    el.querySelector('#scan-cancel').onclick = scannerCancel;
    cleanups.push(scannerCancel);
    const tick = () => {
      if (done) return;
      if (video.readyState >= 2 && video.videoWidth) {
        const scale = Math.min(1, 720 / video.videoWidth);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data?.includes('vouch1.')) { navigator.vibrate?.(40); return finish(code.data); }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ---------- verify ----------
function verify(id) {
  const c = findContact(id);
  const seed = C.unb64u(c.seed);
  const theirRole = C.otherRole(c.role);
  let duress = false, counter = null;

  render(`
    ${bar({ title: c.name, back: true, right: `<button class="icon-btn" id="more" aria-label="Options">${icon.more}</button>` })}
    <section class="card say" id="say">
      <p class="label">You say<span class="dot" id="dot"></span></p>
      <div id="mine"></div>
    </section>
    <section class="card accent">
      <p class="label">${esc(c.name)} should say</p>
      <div id="theirs"></div>
    </section>
    <div class="timer"><div class="track"><div class="fill" id="fill"></div></div><span id="left"></span></div>
    <p class="small">Either of you can go first. Just ask: “What are your Vouch words?”</p>
    <div class="spacer"></div>
    <button class="btn" id="check">They said something different</button>`);
  wireBack(home);
  $('#more').onclick = () => manageSheet(c);
  $('#check').onclick = () => checkSheet(c, seed, theirRole);

  const draw = async () => {
    const n = C.counterAt();
    const [mine, theirs] = await Promise.all([
      C.codeWords(seed, c.role, n, duress ? 'duress' : 'code'),
      C.codeWords(seed, theirRole, n, 'code'),
    ]);
    if (!$('#mine')) return;
    $('#mine').innerHTML = wordList(mine);
    $('#theirs').innerHTML = wordList(theirs);
    $('#dot').classList.toggle('on', duress);
    counter = n;
  };
  const tick = () => {
    const left = C.secondsLeft();
    $('#fill').style.width = `${(left / C.WINDOW_SECONDS) * 100}%`;
    $('#left').textContent = fmt(left);
    if (C.counterAt() !== counter) { duress = false; draw(); }
  };
  draw(); tick();
  const iv = setInterval(tick, 1000);
  cleanups.push(() => clearInterval(iv));

  // Press and hold your words to swap in duress words. Looks identical to anyone watching.
  const say = $('#say');
  let hold = null;
  const start = () => { hold = setTimeout(() => { duress = !duress; navigator.vibrate?.(15); draw(); }, HOLD_FOR_DURESS_MS); };
  const cancel = () => clearTimeout(hold);
  say.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => say.addEventListener(ev, cancel));
  say.addEventListener('contextmenu', e => e.preventDefault());
  cleanups.push(cancel);
}

function checkSheet(c, seed, theirRole) {
  const s = sheet(`
    <h2>What did ${esc(c.name)} say?</h2>
    <p class="small">Type the three words. The first few letters of each is enough.</p>
    <input class="field" id="said" placeholder="word word word" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
    <div id="out"></div>
    <button class="btn primary" id="go">Check</button>`);
  const input = s.querySelector('#said'), out = s.querySelector('#out');
  setTimeout(() => input.focus(), 50);
  const run = async () => {
    const r = await C.classify(seed, theirRole, input.value);
    out.innerHTML = {
      ok: `<p class="result ok">✓ That's a valid code from ${esc(c.name)}. Their clock may be a minute or two off from yours, which is fine.</p>`,
      duress: `<p class="result bad"><strong>${esc(c.name)} used their duress words.</strong> They may be under pressure, or someone may be with them. Stay calm and don't react on the call. Get help, or reach them another way you trust.</p>`,
      none: `<p class="result bad">✗ Those words don't match. Treat this caller as unverified. Hang up and call ${esc(c.name)} back on a number you already know.</p>`,
      incomplete: `<p class="result warn">Enter all three words.</p>`,
    }[r];
    // Once there's a verdict, the button just closes the panel. Editing the words re-arms Check.
    if (r !== 'incomplete') { input.blur(); setButton('Done', closeSheet); }
  };
  const btn = s.querySelector('#go');
  const setButton = (label, fn) => { btn.textContent = label; btn.onclick = fn; };
  setButton('Check', run);
  input.oninput = () => { out.innerHTML = ''; setButton('Check', run); };
  input.onkeydown = e => { if (e.key === 'Enter') btn.click(); };
}

function manageSheet(c) {
  const s = sheet(`
    <h2>${esc(c.name)}</h2>
    <button class="btn" id="rename">Rename</button>
    ${c.status === 'paired' ? '<button class="btn" id="keys">Show pairing words</button>' : ''}
    <button class="btn danger" id="del">Remove ${esc(c.name)}</button>`);
  s.querySelector('#rename').onclick = () => {
    const r = sheet(`<h2>Rename</h2><input class="field" id="nn" maxlength="40" value="${esc(c.name)}"><button class="btn primary" id="ok">Save</button>`);
    r.querySelector('#ok').onclick = async () => {
      const v = r.querySelector('#nn').value.trim();
      if (!v) return;
      c.name = v; await persist();
      c.status === 'paired' ? verify(c.id) : pairing(c.id);
    };
  };
  s.querySelector('#keys')?.addEventListener('click', async () => {
    const mine = await C.keyWords(C.unb64u(c.myPub));
    const theirs = await C.keyWords(C.unb64u(c.theirPub));
    sheet(`<h2>Pairing words</h2>
      <p class="small">Use these to re-check your pairing in person, or over a channel you already trust with them.</p>
      <p class="label">Yours</p>${wordList(mine, 'compact')}
      <p class="label">${esc(c.name)}'s</p>${wordList(theirs, 'compact')}`);
  });
  s.querySelector('#del').onclick = () => {
    const d = sheet(`<h2>Remove ${esc(c.name)}?</h2>
      <p class="small">You'll need to pair again to verify calls with them.</p>
      <button class="btn primary" id="yes" style="background:var(--danger);color:#fff">Remove</button>
      <button class="btn ghost" id="cancel">Cancel</button>`);
    d.querySelector('#cancel').onclick = closeSheet;
    d.querySelector('#yes').onclick = async () => {
      V.get().contacts = contacts().filter(x => x.id !== c.id);
      await persist();
      home();
    };
  };
}

// ---------- settings & help ----------
function settings() {
  render(`
    ${bar({ title: 'Settings', back: true })}
    <div id="update-banner"></div>
    <div class="list">
      <button class="contact" id="help"><span class="name">How Vouch works</span><span class="chev">${icon.chev}</span></button>
      <button class="contact" id="pin"><span class="name">Change PIN</span><span class="chev">${icon.chev}</span></button>
      <button class="contact" id="lock"><span class="name">Lock now</span><span class="chev">${icon.chev}</span></button>
      <button class="contact" id="update"><span><div class="name">Check for updates</div><div class="meta" id="update-meta">You have version ${APP_VERSION}</div></span><span class="chev">${icon.chev}</span></button>
    </div>
    <div class="spacer"></div>
    <button class="btn danger" id="wipe">Erase everything</button>
    <p class="small" style="text-align:center">Vouch ${APP_VERSION} · works offline · nothing leaves this phone</p>`);
  wireBack(home);
  $('#help').onclick = help;
  drawUpdateBanner();
  $('#lock').onclick = relock;
  $('#update').onclick = checkForUpdate;
  $('#pin').onclick = () => pinScreen({
    title: 'Enter your current PIN', back: settings,
    onPin: async current => {
      if (Date.now() < lockedUntil) return `Too many tries. Wait ${Math.ceil((lockedUntil - Date.now()) / 1000)}s.`;
      if (!(await V.checkPin(current))) {
        failures++;
        if (failures >= 5) { lockedUntil = Date.now() + 30_000 * (failures - 4); return 'Too many tries. Wait 30 seconds.'; }
        return 'Wrong PIN';
      }
      failures = 0;
      newPin();
    },
  });
  const newPin = () => pinScreen({
    title: 'Choose a new 6-digit PIN', back: settings,
    onPin: async first => pinScreen({
      title: 'Enter it again', back: newPin,
      onPin: async second => {
        if (first !== second) { setTimeout(newPin, 700); return 'PINs didn’t match. Try again.'; }
        await V.changePin(first); toast('PIN changed'); settings();
      },
    }),
  });
  $('#wipe').onclick = () => {
    const d = sheet(`<h2>Erase everything?</h2>
      <p class="small">This deletes every pairing on this phone. You'll have to pair with everyone again. It can't be undone.</p>
      <button class="btn primary" id="yes" style="background:var(--danger);color:#fff">Erase</button>
      <button class="btn ghost" id="cancel">Cancel</button>`);
    d.querySelector('#cancel').onclick = closeSheet;
    d.querySelector('#yes').onclick = () => { V.wipe(); welcome(); };
  };
}

// ---------- updates (always user-approved) ----------
// The service worker keeps serving the version you approved. A newer published
// version waits until you review it and tap Update. See sw.js.
let updateAvailable = null;

async function askWorker(type) {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg?.active) return null;
  return new Promise(resolve => {
    const ch = new MessageChannel();
    ch.port1.onmessage = e => resolve(e.data);
    reg.active.postMessage({ type }, [ch.port2]);
    setTimeout(() => resolve(null), 3000);
  });
}

async function refreshUpdateStatus() {
  const status = await askWorker('status');
  updateAvailable = status?.available || null;
  drawUpdateBanner();
}

function drawUpdateBanner() {
  const slot = $('#update-banner');
  if (!slot) return;
  slot.innerHTML = updateAvailable && V.isUnlocked() ? `
    <section class="card accent">
      <p class="label">Update available</p>
      <p class="small">Version ${esc(updateAvailable)} is ready. Nothing changes until you choose to update.</p>
      <div class="row">
        <a class="btn" href="${RELEASES_URL}/tag/v${esc(updateAvailable)}" target="_blank" rel="noopener">What changed</a>
        <button class="btn primary" id="apply-update">Update</button>
      </div>
    </section>` : '';
  slot.querySelector('#apply-update')?.addEventListener('click', confirmUpdate);
}

function confirmUpdate() {
  const v = updateAvailable;
  const s = sheet(`
    <h2>Update to version ${esc(v)}?</h2>
    <p class="small">Only update if you trust the change. Read what changed first, or ask someone you trust who reads code.</p>
    <a class="btn" href="${RELEASES_URL}/tag/v${esc(v)}" target="_blank" rel="noopener">What changed in ${esc(v)}</a>
    <button class="btn primary" id="go-update">Update now</button>
    <button class="btn ghost" id="not-now">Not now</button>
    <p class="small" style="text-align:center">Vouch will restart and ask for your PIN. Your contacts stay as they are.</p>`);
  s.querySelector('#not-now').onclick = closeSheet;
  s.querySelector('#go-update').onclick = async () => {
    const r = await askWorker('approve');
    if (!r) { toast('Update failed. Try again.'); return; }
    try { sessionStorage.setItem('vouch.updatedFrom', APP_VERSION); } catch {}
    location.reload();
  };
}

// Settings > Check for updates: look for a newer published version. It's
// downloaded and kept ready for review, never applied automatically.
async function checkForUpdate() {
  const meta = $('#update-meta'), btn = $('#update');
  const say = t => { if (meta) meta.textContent = t; };
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg || !navigator.onLine) { say('You need to be online to check for updates'); return; }
  btn.disabled = true;
  say('Checking…');
  try {
    await reg.update();
    const incoming = reg.installing || reg.waiting;
    if (incoming) {
      await new Promise(resolve => {
        const done = () => ['activated', 'redundant'].includes(incoming.state) && resolve();
        incoming.addEventListener('statechange', done); done();
      });
    }
  } catch {
    btn.disabled = false;
    say('Couldn’t reach the update server. Try again later.');
    return;
  }
  await refreshUpdateStatus();
  btn.disabled = false;
  say(updateAvailable
    ? `Version ${updateAvailable} is ready to review above`
    : `You're up to date (version ${APP_VERSION})`);
}

function help() {
  render(`
    ${bar({ title: 'How Vouch works', back: true })}
    <div class="prose">
      <h2>Pairing</h2>
      <p><strong>Together (best):</strong> open Vouch on both phones and scan each other's code. Scanning straight off their screen means nobody could have swapped the code, so you're done.</p>
      <p><strong>Far apart:</strong> send your invites over any app. Then compare your <strong>pairing words</strong> somewhere you already know it's really them: their usual phone number, their usual email, an account you've used together for years. If they match, nobody swapped the invites on the way. Use a live video call only if there's nothing better, since voices and faces can be faked.</p>
      <p>Either way, your phones now share a secret no one else has.</p>
      <h2>Verifying a call</h2>
      <p>Open their name. You'll see <strong>your three words</strong> and <strong>the three words they should say</strong>. The words change every 3 minutes. If they can't say the right words, hang up and call them back on a number you know.</p>
      <h2>Duress words</h2>
      <p>If someone is forcing you to vouch, <strong>press and hold your words</strong> for a moment. They switch to duress words that look completely normal. A tiny dot by “You say” is your only clue. On the other phone, these words won't match. When they type them into “They said something different”, Vouch warns them quietly.</p>
      <h2>Updates</h2>
      <p>Vouch never updates itself. When a new version is published, you'll see <strong>Update available</strong> with a link to what changed. Nothing changes until you tap Update.</p>
      <p>One honest limit: whoever hosts Vouch could publish a version that skips this step. If that worries you, run your own copy. The README explains how.</p>
      <h2>Good to know</h2>
      <p>Your phone's clock must be roughly right; automatic time is best. Vouch can't stop a scammer who calls you both at the same moment and relays words between you live. If anything feels off, hang up and call back.</p>
      <p>If you lose this phone or erase the app, pair again. There's no backup, by design.</p>
    </div>`);
  wireBack(settings);
}

// ---------- boot ----------
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (V.isUnlocked() && Date.now() - hiddenAt > AUTO_LOCK_MS) relock();
});

// Phone Back button: close the scanner or sheet, else go to the previous screen.
// On a top-level screen (home, lock) it leaves the app as usual.
history.replaceState({ vouch: 'base' }, '');
history.pushState({ vouch: 'top' }, '');
window.addEventListener('popstate', () => {
  if (scannerCancel) scannerCancel();
  else if (document.querySelector('.overlay')) closeSheet();
  else if (backHandler) backHandler();
  else { history.back(); return; }
  history.pushState({ vouch: 'top' }, '');
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // A newer version finished downloading: offer it. It is never applied without approval.
  navigator.serviceWorker.addEventListener('controllerchange', refreshUpdateStatus);
  navigator.serviceWorker.ready.then(refreshUpdateStatus);
}
const relock = () => { V.lock(); lockScreen(); };

if (!window.isSecureContext || !crypto.subtle) {
  render(`<div class="spacer"></div><h1 class="title">Open Vouch over https</h1>
    <p class="lead">Your browser only allows Vouch's encryption on a secure (https) address.</p><div class="spacer"></div>`);
} else {
  exists() ? lockScreen() : welcome();
}
