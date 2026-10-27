# Vouch

Prove it's really you. Rotating 3-word codes shared between two people to beat deepfakes and voice cloning.

A cloned voice or deepfake video can sound like someone you love, but it can't produce words only the two of you share. Pair once with each person you trust. On any call after that, each of you reads out three words. If they match, it's really them.

- **Offline PWA:** add it to your home screen on iOS or Android. No app store, no server, no accounts.
- **Pair anywhere:** scan a QR code in person, or send an invite over any app and confirm 5 pairing words on a live video call.
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

Vouch is static files: no build step, no backend. Anything that serves files over **https** works, because browsers only allow its encryption on secure origins.

```sh
git clone https://github.com/ericscalibur/Vouch.git
cd Vouch
git checkout v0.2.0   # pin to a release you've reviewed
```

Then serve the folder with any static host: your own GitHub Pages fork, a home server (Start9, Umbrel, a Raspberry Pi behind Caddy or nginx), or any web server with a TLS certificate. For local testing, `python3 -m http.server` works on `localhost`.

To update a self-hosted copy, review the diff (`git fetch && git diff v0.2.0 v0.2.1`), then check out the new tag. Install Vouch on your phone from **your** address. Each address keeps its own pairings, so pair again after switching hosts.

Run the tests with `npm test`.

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
