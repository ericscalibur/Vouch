# Vouch

Authenticate your closest contacts. Pair your phones once, then you can Vouch: rotating 3-word codes shared between two people to beat deepfakes and voice cloning.

A cloned voice or deepfake video can sound like someone you love, but it can't produce words only the two of you share. Pair once with each person you trust. On any call after that, each of you reads out three words. If they match, it's really them.

- **Offline PWA:** add it to your home screen on iOS or Android. No app store, no server, no accounts.
- **Pair anywhere:** scan a QR code in person, or send an invite over any app and confirm 5 pairing words over a channel you already trust with them (their usual number or email; a live video call if nothing better).
- **Directional codes:** you each have different words, so an impostor can't just repeat yours back.
- **Duress words:** press and hold your words to quietly signal you're under pressure.
- **Encrypted on device:** contacts are locked behind a PIN.
- **No surprise updates:** new versions wait for your approval.

## How it works

Each pairing does a P-256 ECDH key exchange. Both phones derive the same 32-byte seed with HKDF, then every 3 minutes compute `HMAC(seed, direction ‖ time)` and show it as BIP39 words. Pairing words are a hash of each public key, so a swapped invite shows up as a mismatch. Everything uses the browser's built-in WebCrypto.

**Limits:** a 6-digit PIN can't resist an offline brute-force attack on a seized device. A live relay attack, where someone calls both of you at once and passes words between you, isn't prevented. When in doubt, hang up and call back.

## Trust model

Vouch has no server and never sends your data anywhere. But it is a web app, so **whoever hosts it controls the code your phone runs.** That is true of every web app. App stores have the same property; they just hide it.

What Vouch does about that:

- **Updates need your approval.** A new version is downloaded and kept ready, but Vouch keeps running the version you approved until you tap **Update**. Each update links to its release notes, so you can review the change first. Closing and reopening the app does not apply it.
- **Releases are tagged.** Every published version has a matching git tag (`v0.2.0`, ...) and a GitHub release describing what changed.

What it can't do:

- **It can't protect you from a compromised host.** If the hosting account were taken over, an attacker could publish a service worker that skips the approval step. Approval protects you from surprise updates, not from a malicious publisher.

If that risk matters to you, **self-host** (below). Then nobody but you can change the code you run.

## Run your own copy

Vouch is static files: no build step, no backend, no database. Self-hosting means serving this folder from an address you control, then installing Vouch on your phone from that address.

### What you need to know first

- **It must be https.** Phones only allow Vouch's encryption and offline mode on secure (https) addresses. A plain LAN address like `http://192.168.1.50:8765` won't work; Vouch will say "Open Vouch over https". (`http://localhost` works for testing, but only in a browser on the same computer as the server.)
- **The server is only needed to install and update.** Once installed, the whole app lives on your phone and works anywhere, offline, on any network. Your contacts are only ever stored on the phone, never on the server.
- **Keep the address stable.** Your phone treats each address as a separate app with separate storage. If the address changes (a new IP, a different hostname), you get a fresh, empty Vouch and have to pair everyone again. Use a fixed hostname, not a raw IP.

### 1. Get a copy you've reviewed

```sh
git clone https://github.com/ericscalibur/Vouch.git
cd Vouch
git tag                 # list releases
git checkout v0.2.2     # pin to a release you've reviewed
npm test                # optional: run the crypto tests (Node 20+)
```

### 2. Serve it over https

Pick one:

**Tailscale (easiest, private).** Gives you an https address with a real certificate that only your own devices can reach.

1. In the Tailscale admin console, under **DNS**, enable **MagicDNS** and **HTTPS certificates**.
2. On the computer hosting Vouch, inside the `Vouch` folder:
   ```sh
   python3 -m http.server 8765 --bind 127.0.0.1
   ```
3. In another terminal:
   ```sh
   tailscale serve --bg 8765
   ```
   Tailscale prints your address, like `https://yourmac.your-tailnet.ts.net/`.
4. Install the Tailscale app on your phone and sign in to the same tailnet.

The server only needs to be running when you install or update. For an always-on setup, run the web server as a background service.

**Start9 / Umbrel / home server.** Serve the folder with any static web server (Caddy, nginx) on a box that already provides https. Start9 serves https using its own certificate authority: install its root certificate on your phone first, or the address won't count as secure. Test an install before relying on it.

**A domain you own.** Point a domain at any server and use [Caddy](https://caddyserver.com), which gets a free Let's Encrypt certificate automatically:
```
vouch.example.com {
    root * /path/to/Vouch
    file_server
}
```
This is public: anyone with the address can load the app (but never anyone's contacts).

### 3. Install on your phone

Open your https address on the phone, then:
- **iPhone:** in **Safari**, tap Share → **Add to Home Screen**. It must be Safari.
- **Android:** in **Chrome**, tap ⋮ → **Install app** (choose Install, not Create shortcut).

Always open Vouch from the home screen icon.

### 4. Updating

Review the changes, then move to the new tag:
```sh
git fetch --tags
git diff v0.2.2 v0.2.3   # read what changed
git checkout v0.2.3
```
With the server reachable, open Vouch on your phone and go to **Settings → Check for updates**. Nothing changes until you tap **Update**.

## Roadmap

Ideas under consideration, not promises:

- **Recovery phrase backup:** export an encrypted backup of your contacts, locked with a 12-word recovery phrase, and restore it on a new phone. No server, no email login.
- **Phone-to-phone transfer:** move your contacts to a new phone by scanning a QR code from the old one.
- **Two-channel pairing:** optionally mix in a secret split across two apps (e.g. WhatsApp + email), so an attacker must also read both.
- **Biometric unlock:** Face ID / fingerprint instead of the PIN.
- **More prominent mismatch check:** make it harder to miss a duress signal when words don't match.
- **Multi-device sync:** keep contacts in step across your devices via end-to-end encrypted relays (e.g. Nostr). Only if people ask for it.

## License

AGPL-3.0
