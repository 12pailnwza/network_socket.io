import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { clientId } from '../src/client-id.ts';
import { mergeMessages, refreshHistory } from '../src/message-state.ts';

const message = seq => ({ id: `msg-${seq}`, seq, roomId: 'world', userId: 'alice', name: 'Alice', avatar: 'mage', text: `Message ${seq}`, createdAt: seq });

test('HTTP LAN browsers without randomUUID can generate distinct protocol and retry IDs', () => {
  const insecureOriginCrypto = { getRandomValues: bytes => webcrypto.getRandomValues(bytes) };
  const ids = Array.from({ length: 500 }, () => clientId(insecureOriginCrypto));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('reconnecting after more than one history page cannot leave a permanent gap', () => {
  const oldCache = Array.from({ length: 10 }, (_, i) => message(i + 1));
  const latestPage = Array.from({ length: 50 }, (_, i) => message(i + 61));
  const refreshed = refreshHistory(oldCache, latestPage);
  assert.equal(refreshed[0].seq, 61); // "Read earlier" must now start at 61, not at old message 1.
  const previousPage = Array.from({ length: 50 }, (_, i) => message(i + 11));
  const allPages = mergeMessages(previousPage, refreshed);
  assert.deepEqual(allPages.map(m => m.seq), Array.from({ length: 100 }, (_, i) => i + 11));
});

test('an incoming message during history loading is retained once in order', () => {
  const latestPage = Array.from({ length: 50 }, (_, i) => message(i + 61));
  const cacheWithLiveEvent = [message(1), message(110), message(111)];
  const refreshed = refreshHistory(cacheWithLiveEvent, latestPage);
  assert.equal(refreshed.length, 51);
  assert.equal(refreshed.at(-1).seq, 111);
  assert.equal(refreshed.filter(m => m.seq === 110).length, 1);
});
