# Vouch

Prove it's really you. Rotating 3-word codes shared between two people to beat deepfakes and voice cloning.

A cloned voice or deepfake video can sound like someone you love, but it can't produce words only the two of you share. Pair once with each person you trust. On any call after that, each of you reads out three words. If they match, it's really them.

- **Offline PWA:** add it to your home screen on iOS or Android. No app store, no server, no accounts.
- **Pair anywhere:** scan a QR code in person, or send an invite over any app and confirm 5 pairing words on a live video call.
- **Directional codes:** you each have different words, so an impostor can't just repeat yours back.
- **Duress words:** press and hold your words to quietly signal you're under pressure.
- **Encrypted on device:** contacts are locked behind a PIN.

## How it works

Each pairing does a P-256 ECDH key exchange. Both phones derive the same 32-byte seed with HKDF, then every 3 minutes compute `HMAC(seed, direction ‖ time)` and show it as BIP39 words. Pairing words are a hash of each public key, so a swapped invite shows up as a mismatch. Everything uses the browser's built-in WebCrypto.

**Limits:** a 6-digit PIN can't resist an offline brute-force attack on a seized device. A live relay attack, where someone calls both of you at once and passes words between you, isn't prevented. When in doubt, hang up and call back.

## Run it

Serve the folder over https (or `localhost`), for example with `python3 -m http.server`, then open it in a browser. Run the tests with `npm test`.

## License

AGPL-3.0
