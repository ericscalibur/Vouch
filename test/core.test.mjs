// Run: node test/core.test.mjs
import assert from 'node:assert/strict';
import * as C from '../js/core.js';

const T = 1_800_000_000_000;

// Two people pair remotely.
const alice = await C.generateKeyPair();
const bob = await C.generateKeyPair();
const aliceInvite = C.encodeInvite(alice.pub);
const bobInvite = C.encodeInvite(bob.pub);

// Invites survive being pasted inside a chat message.
assert.deepEqual(C.parseInvite(`Add me on Vouch: ${bobInvite} thanks!`), bob.pub);
assert.throws(() => C.parseInvite('hello'));

const seedA = await C.deriveSeed(alice.privJwk, alice.pub, C.parseInvite(bobInvite));
const seedB = await C.deriveSeed(bob.privJwk, bob.pub, C.parseInvite(aliceInvite));
assert.deepEqual(seedA, seedB, 'both sides derive the same seed');

const roleA = C.roleFor(alice.pub, bob.pub);
const roleB = C.roleFor(bob.pub, alice.pub);
assert.notEqual(roleA, roleB, 'roles differ');
assert.throws(() => C.roleFor(alice.pub, alice.pub));

// Key fingerprints: what Alice reads aloud equals what Bob's screen expects.
assert.deepEqual(await C.keyWords(alice.pub), await C.keyWords(alice.pub));
assert.equal((await C.keyWords(alice.pub)).length, 5);

// Codes: Alice's "say" == Bob's "expect", and directions differ.
const n = C.counterAt(T);
const aliceSays = await C.codeWords(seedA, roleA, n);
const bobExpects = await C.codeWords(seedB, C.otherRole(roleB), n);
assert.deepEqual(aliceSays, bobExpects);
assert.notDeepEqual(aliceSays, await C.codeWords(seedA, roleB, n), 'directional');
assert.notDeepEqual(aliceSays, await C.codeWords(seedA, roleA, n, 'duress'), 'duress differs');
assert.notDeepEqual(aliceSays, await C.codeWords(seedA, roleA, n + 1), 'rotates');

// Bob checks what Alice said.
assert.equal(await C.classify(seedB, roleA, aliceSays.join(' '), T), 'ok');
assert.equal(await C.classify(seedB, roleA, aliceSays.map(w => w.toUpperCase().slice(0, 4)).join(', '), T), 'ok');
assert.equal(await C.classify(seedB, roleA, aliceSays.join(' '), T + C.WINDOW_SECONDS * 1000), 'ok', 'drift tolerated');
assert.equal(await C.classify(seedB, roleA, aliceSays.join(' '), T + 3 * C.WINDOW_SECONDS * 1000), 'none', 'expires');
const duress = await C.codeWords(seedA, roleA, n, 'duress');
assert.equal(await C.classify(seedB, roleA, duress.join(' '), T), 'duress');
assert.equal(await C.classify(seedB, roleA, 'abandon ability', T), 'incomplete');
// An impostor echoing Bob's own code fails.
const bobSays = await C.codeWords(seedB, roleB, n);
assert.equal(await C.classify(seedB, roleA, bobSays.join(' '), T), 'none');

// A man-in-the-middle with his own keys yields different seeds and fingerprints.
const mallory = await C.generateKeyPair();
const seedAM = await C.deriveSeed(alice.privJwk, alice.pub, mallory.pub);
assert.notDeepEqual(seedAM, seedA);
assert.notDeepEqual(await C.keyWords(mallory.pub), await C.keyWords(bob.pub));

console.log('all core tests passed');
console.log('example code:', aliceSays.join(' '), '| key words:', (await C.keyWords(alice.pub)).join(' '));
