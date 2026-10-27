import * as C from './core.js';
import * as V from './vault.js';

const APP_VERSION = '0.1.2';
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
function welcome() {
  render(`
    <div class="spacer"></div>
    ${mark}
    <h1 class="title">Prove it's really you.</h1>
    <p class="lead">A cloned voice or a deepfake video can sound just like someone you love. It can't produce the words only the two of you share.</p>
    <p class="lead">Pair once with each person you trust. On any call after that, you each read out three words. If they match, it's really them.</p>
    <div class="spacer"></div>
    <button class="btn primary" id="go">Get started</button>
    <p class="small" style="text-align:center">Everything stays on this phone. No account, no server.</p>`);
  $('#go').onclick = setupPin;
}

function setupPin() {
  pinScreen({
    title: 'Choose a 6-digit PIN',
    subtitle: 'It locks Vouch and encrypts your contacts on this phone.',
    back: exists() ? null : welcome,
    onPin: async first => {
      pinScreen({
        title: 'Enter it again',
        back: setupPin,
        onPin: async second => {
          if (second !== first) { setTimeout(setupPin, 700); return 'PINs didn’t match. Try again.'; }
          await V.create(first);
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
      if (await V.unlock(pin)) { failures = 0; home(); return; }
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
    ${list.length ? `
      <div class="list">
        ${list.map(c => `
          <button class="contact" data-id="${c.id}">
            <span class="avatar ${c.status === 'paired' ? '' : 'pending'}">${initial(c.name)}</span>
            <span>
              <div class="name">${esc(c.name)}</div>
              <div class="meta">${c.status === 'paired' ? 'Tap to verify a call' : 'Pairing not finished'}</div>
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
    const c = { id: crypto.randomUUID(), name: input.value.trim(), status: 'pending', myPub: C.b64u(pub), privJwk, created: Date.now() };
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
    <section class="card">
      <div class="step"><b>2</b><h2>Add their invite</h2></div>
      <p class="small">They tap “Add someone” in their Vouch too, then send you theirs.</p>
      <button class="btn" id="scan">${icon.scan} Scan their code</button>
      <textarea class="field" id="paste" placeholder="…or paste their invite here" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
      <p class="small" id="paste-msg" style="color:var(--danger)"></p>
    </section>`);
  wireBack(home);

  $('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(inviteMessage(invite)); toast('Invite copied'); }
    catch { toast('Couldn’t copy. Long-press to select instead.'); }
  };
  $('#share')?.addEventListener('click', () => navigator.share({ text: inviteMessage(invite) }).catch(() => {}));
  $('#more').onclick = () => manageSheet(c);

  const accept = text => {
    try {
      const theirPub = C.parseInvite(text);
      C.roleFor(C.unb64u(c.myPub), theirPub);
      confirmPair(id, theirPub);
    } catch (e) {
      $('#paste-msg').textContent = e.message;
    }
  };
  $('#paste').oninput = e => { if (e.target.value.trim()) accept(e.target.value); };
  $('#scan').onclick = async () => {
    const text = await scanQR();
    if (text) accept(text);
  };
}

async function confirmPair(id, theirPub) {
  const c = findContact(id);
  const mine = await C.keyWords(C.unb64u(c.myPub));
  const theirs = await C.keyWords(theirPub);
  render(`
    ${bar({ title: `Pair with ${c.name}`, back: true })}
    <h2 class="title">Make sure it's really ${esc(c.name)}</h2>
    <p class="lead">Do this face to face, or on a live video call. Each of you reads your own words out loud.</p>
    <section class="card">
      <p class="label">You read out</p>
      ${wordList(mine, 'compact')}
    </section>
    <section class="card accent">
      <p class="label">${esc(c.name)} should read out</p>
      ${wordList(theirs, 'compact')}
    </section>
    <p class="small">Talking on a call? For extra safety, also ask a question only the real ${esc(c.name)} would know.</p>
    <div class="spacer"></div>
    <button class="btn primary" id="yes">All words match</button>
    <button class="btn danger" id="no">They don't match</button>`);
  wireBack(() => pairing(id));

  $('#yes').onclick = async () => {
    const myPub = C.unb64u(c.myPub);
    const seed = await C.deriveSeed(c.privJwk, myPub, theirPub);
    Object.assign(c, { status: 'paired', seed: C.b64u(seed), role: C.roleFor(myPub, theirPub), theirPub: C.b64u(theirPub), paired: Date.now() });
    delete c.privJwk; // only the shared seed is needed from now on
    await persist();
    toast(`Paired with ${c.name}`);
    verify(id);
  };
  $('#no').onclick = () => {
    const s = sheet(`
      <h2>Don't pair yet</h2>
      <p class="result bad">If the words differ, the invite may have been swapped on the way. Someone could be pretending to be ${esc(c.name)}.</p>
      <p class="small">Throw this invite away. Send invites again over a different app, then compare the words on a live video call.</p>
      <button class="btn primary" id="retry">Start over</button>`);
    s.querySelector('#retry').onclick = async () => {
      const { pub, privJwk } = await C.generateKeyPair();
      Object.assign(c, { myPub: C.b64u(pub), privJwk });
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
  };
  s.querySelector('#go').onclick = run;
  input.onkeydown = e => { if (e.key === 'Enter') run(); };
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
      <p class="small">Use these to re-check your pairing face to face or on a live video call.</p>
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
    <div class="list">
      <button class="contact" id="help"><span class="name">How Vouch works</span><span class="chev">${icon.chev}</span></button>
      <button class="contact" id="pin"><span class="name">Change PIN</span><span class="chev">${icon.chev}</span></button>
      <button class="contact" id="lock"><span class="name">Lock now</span><span class="chev">${icon.chev}</span></button>
    </div>
    <div class="spacer"></div>
    <button class="btn danger" id="wipe">Erase everything</button>
    <p class="small" style="text-align:center">Vouch ${APP_VERSION} · works offline · nothing leaves this phone</p>`);
  wireBack(home);
  $('#help').onclick = help;
  $('#lock').onclick = relock;
  $('#pin').onclick = () => pinScreen({
    title: 'New 6-digit PIN', back: settings,
    onPin: async first => pinScreen({
      title: 'Enter it again', back: settings,
      onPin: async second => {
        if (first !== second) return 'PINs didn’t match';
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

function help() {
  render(`
    ${bar({ title: 'How Vouch works', back: true })}
    <div class="prose">
      <h2>Pairing</h2>
      <p>You and the other person swap invites, in person or over any app. Then you each read out your <strong>pairing words</strong> face to face or on a live video call. If they match, nobody swapped the invites, and your phones now share a secret no one else has.</p>
      <h2>Verifying a call</h2>
      <p>Open their name. You'll see <strong>your three words</strong> and <strong>the three words they should say</strong>. The words change every 3 minutes. If they can't say the right words, hang up and call them back on a number you know.</p>
      <h2>Duress words</h2>
      <p>If someone is forcing you to vouch, <strong>press and hold your words</strong> for a moment. They switch to duress words that look completely normal. A tiny dot by “You say” is your only clue. On the other phone, these words won't match. When they type them into “They said something different”, Vouch warns them quietly.</p>
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

let updatePending = false;

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
  const hadController = !!navigator.serviceWorker.controller; // false on first install
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // A new version was installed in the background. Apply it now if that loses nothing (app locked),
  // otherwise apply it the next time Vouch locks.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    if (!V.isUnlocked()) { reloaded = true; location.reload(); }
    else updatePending = true;
  });
}
const relock = () => { V.lock(); updatePending ? location.reload() : lockScreen(); };

if (!window.isSecureContext || !crypto.subtle) {
  render(`<div class="spacer"></div><h1 class="title">Open Vouch over https</h1>
    <p class="lead">Your browser only allows Vouch's encryption on a secure (https) address.</p><div class="spacer"></div>`);
} else {
  exists() ? lockScreen() : welcome();
}
