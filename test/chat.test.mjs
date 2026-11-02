import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { request as httpRequest } from 'node:http';
import { WebSocket } from 'ws';
import { createApp } from '../server/app.mjs';

async function fixture(options = {}) {
  const app = await createApp({ databasePath: ':memory:', ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function http(path, body, cookie, origin = base) {
    const res = await fetch(`${base}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  async function account(name) {
    const auth = await http('register', { name, password: 'correct-horse-42', avatar: 'mage' });
    assert.equal(auth.status, 200);
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/socket', { headers: { Cookie: auth.cookie, Origin: base } });
    const events = []; const pending = new Map(); let latestState;
    let initialized;
    const ready = new Promise(resolve => { initialized = resolve; });
    ws.on('error', () => {});
    ws.on('message', raw => {
      const event = JSON.parse(raw);
      events.push(event);
      if (event.event === 'state') { latestState = event.data; initialized(); }
      if (event.event === 'reply') {
        const entry = pending.get(event.data.id);
        if (entry) { clearTimeout(entry.timer); pending.delete(event.data.id); event.data.error ? entry.reject(new Error(event.data.error)) : entry.resolve(event.data.result); }
      }
    });
    await ready;
    function request(action, data) {
      const id = randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${action}`)); }, 3000);
        pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, action, data }));
      });
    }
    return { ...auth.data, cookie: auth.cookie, ws, events, request, get state() { return latestState; },
      send: (roomId, text, clientId = randomUUID()) => request('message', { roomId, text, clientId }),
    };
  }
  return { app, base, http, account, close: () => app.close() };
}
const pause = () => new Promise(resolve => setTimeout(resolve, 30));

test('nine simultaneous clients receive World messages once, while guild and private messages stay scoped', async () => {
  const f = await fixture();
  try {
    const clients = await Promise.all(Array.from({ length: 9 }, (_, i) => f.account(`Adventurer${i + 1}`)));
    await Promise.all(clients.map(c => c.request('join', { roomId: 'world' })));
    const { roomId: guildId } = await clients[0].request('createGuild', { name: 'Nine-player test', description: 'Load baseline' });
    await Promise.all(clients.slice(1, 4).map(c => c.request('join', { roomId: guildId })));
    const { roomId: privateId } = await clients[0].request('private', { userId: clients[8].user.id });
    const started = performance.now();
    await Promise.all(clients.flatMap((c, i) => Array.from({ length: 3 }, (_, j) => c.send('world', `World ${i}:${j}`))));
    await clients[0].send(guildId, 'Guild-only quest');
    await clients[8].send(privateId, 'Private-only quest');
    await pause();
    for (const [i, client] of clients.entries()) {
      assert.equal(client.state.users.filter(u => u.online).length, 9);
      const world = client.events.filter(e => e.event === 'message' && e.data.roomId === 'world');
      assert.equal(world.length, 27);
      assert.equal(new Set(world.map(e => e.data.id)).size, 27);
      assert.equal(client.events.some(e => e.event === 'message' && e.data.roomId === guildId), i < 4);
      assert.equal(client.events.some(e => e.event === 'message' && e.data.roomId === privateId), i === 0 || i === 8);
      assert.equal(client.state.rooms.find(r => r.id === 'world').unread, 24);
    }
    console.log(`Nine-client baseline: 29 persisted messages, 249 expected message deliveries in ${Math.round(performance.now() - started)} ms (local machine only).`);
  } finally { await f.close(); }
});

test('an expired session cannot receive a room broadcast before the next heartbeat', async () => {
  const f = await fixture();
  try {
    const a = await f.account('Alice'), b = await f.account('Bob');
    const { roomId } = await a.request('private', { userId: b.user.id });
    f.app.store.run('UPDATE sessions SET expires=? WHERE user_id=?', Date.now() - 1, a.user.id);
    await b.send(roomId, 'After session expiry');
    await pause();
    assert.equal(a.events.some(e => e.event === 'message' && e.data.text === 'After session expiry'), false);
    assert.notEqual(a.ws.readyState, WebSocket.OPEN);
  } finally { await f.close(); }
});

test('a UTF-8 account name survives an HTTP body split inside a multibyte character', async () => {
  const f = await fixture();
  try {
    const payload = Buffer.from(JSON.stringify({ name: '勇者阿甲', password: 'correct-horse-42' }));
    const splitAt = payload.indexOf(Buffer.from('勇')) + 1;
    const response = await new Promise((resolve, reject) => {
      const req = httpRequest(`${f.base}/api/register`, {
        method: 'POST', headers: { Origin: f.base, 'Content-Type': 'application/json', 'Content-Length': payload.length },
      }, res => {
        const chunks = []; res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
      });
      req.on('error', reject); req.write(payload.subarray(0, splitAt));
      setTimeout(() => req.end(payload.subarray(splitAt)), 20);
    });
    assert.equal(response.status, 200); assert.equal(response.data.user.name, '勇者阿甲');
  } finally { await f.close(); }
});

test('account validation, secure sessions, origin checks and logout revocation', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.http('me')).status, 401);
    assert.equal((await f.http('register', { name: 'abc', password: 'short' })).status, 400);
    const a = await f.account('Alice');
    assert.equal((await f.http('register', { name: 'alice', password: 'correct-horse-42' })).status, 409);
    assert.equal((await f.http('login', { name: 'Alice', password: 'wrong-password' })).status, 401);
    assert.equal((await f.http('login', { name: 'aLiCe', password: 'correct-horse-42' })).status, 200);
    assert.equal((await f.http('logout', {}, a.cookie, 'https://evil.example')).status, 403);
    const row = f.app.store.get('SELECT * FROM users WHERE id=?', a.user.id);
    assert.notEqual(row.password, 'correct-horse-42'); assert.match(row.password, /^[a-f0-9]+:[a-f0-9]+$/);
    const profile = await f.http('profile', { avatar: 'rogue' }, a.cookie);
    assert.equal(profile.data.user.avatar, 'rogue');
    await f.http('logout', {}, a.cookie);
    assert.equal((await f.http('me', undefined, a.cookie)).status, 401);
    await pause(); assert.notEqual(a.ws.readyState, WebSocket.OPEN);
  } finally { await f.close(); }
});

test('unauthenticated and foreign-origin WebSocket handshakes are rejected', async () => {
  const f = await fixture();
  try {
    const a = await f.account('Alice');
    for (const headers of [{ Origin: f.base }, { Origin: 'https://evil.example', Cookie: a.cookie }]) {
      const socket = new WebSocket(f.base.replace('http:', 'ws:') + '/socket', { headers });
      const outcome = await new Promise(resolve => { socket.on('error', () => resolve('rejected')); socket.on('unexpected-response', (_req, res) => { res.resume(); socket.terminate(); resolve('rejected'); }); socket.on('open', () => resolve('opened')); });
      assert.equal(outcome, 'rejected');
    }
  } finally { await f.close(); }
});

test('World is opt-in; private messages never reach a third account; retry is idempotent', async () => {
  const f = await fixture();
  try {
    const a = await f.account('Alice'), b = await f.account('Bob'), c = await f.account('Carol');
    await pause();
    assert.equal(a.state.users.filter(u => u.online).length, 3);
    assert.equal(a.state.users.some(u => u.id === a.user.id && u.online), true);
    await assert.rejects(a.send('world', 'blocked'), /Join/);
    await assert.rejects(c.request('history', { roomId: 'world' }), /Join/);
    await a.request('join', { roomId: 'world' });
    await b.request('join', { roomId: 'world' });
    await a.send('world', 'Hello realm'); await pause();
    assert.equal(b.events.some(e => e.event === 'message' && e.data.text === 'Hello realm'), true);
    assert.equal(c.events.some(e => e.event === 'message'), false);
    const { roomId } = await a.request('private', { userId: b.user.id });
    const same = await b.request('private', { userId: a.user.id }); assert.equal(same.roomId, roomId);
    const clientId = randomUUID();
    const first = await a.send(roomId, 'Secret <script>alert(1)</script> สวัสดี 👋', clientId);
    const retry = await a.send(roomId, 'Secret <script>alert(1)</script> สวัสดี 👋', clientId);
    assert.equal(first.message.id, retry.message.id);
    await assert.rejects(a.send(roomId, 'different', clientId), /already/);
    await pause();
    assert.equal(c.state.rooms.some(r => r.id === roomId), false);
    assert.equal(c.events.some(e => e.event === 'message' && e.data.roomId === roomId), false);
    await assert.rejects(c.request('history', { roomId }), /Join/);
    await assert.rejects(c.request('search', { roomId, query: 'Secret' }), /Join/);
    await assert.rejects(c.request('typing', { roomId }), /Join/);
    assert.equal((await b.request('history', { roomId })).messages.length, 1);
  } finally { await f.close(); }
});

test('guild membership, all-history access, ownership transfer, leaving and archiving', async () => {
  const f = await fixture();
  try {
    const a = await f.account('Alice'), b = await f.account('Bob'), c = await f.account('Carol');
    const { roomId } = await a.request('createGuild', { name: 'Wandering Leaves', description: 'Our party' });
    await a.send(roomId, 'Before Bob joined'); await pause();
    const listing = c.state.rooms.find(r => r.id === roomId);
    assert.equal(listing.members.length, 1); assert.equal(listing.members[0].id, a.user.id); assert.equal(listing.joined, false);
    await assert.rejects(c.send(roomId, 'outsider'), /Join/);
    await b.request('join', { roomId });
    assert.equal((await b.request('history', { roomId })).messages[0].text, 'Before Bob joined');
    await assert.rejects(a.request('leave', { roomId }), /Transfer/);
    await assert.rejects(b.request('transfer', { roomId, userId: a.user.id }), /owner/);
    await assert.rejects(a.request('transfer', { roomId, userId: c.user.id }), /member/);
    await a.request('transfer', { roomId, userId: b.user.id });
    await assert.rejects(a.request('disband', { roomId }), /owner/);
    await a.request('leave', { roomId });
    await assert.rejects(a.request('history', { roomId }), /Join/);
    const before = a.events.filter(e => e.event === 'message' && e.data.roomId === roomId).length;
    await b.send(roomId, 'After Alice left'); await pause();
    assert.equal(a.events.filter(e => e.event === 'message' && e.data.roomId === roomId).length, before);
    await b.request('disband', { roomId }); await pause();
    assert.equal(c.state.rooms.some(r => r.id === roomId), false);
    await assert.rejects(b.request('history', { roomId }), /Join/);
    await assert.rejects(c.request('join', { roomId }), /not found/);
    assert.equal(f.app.store.get('SELECT COUNT(*) AS n FROM messages WHERE room_id=?', roomId).n, 2);
  } finally { await f.close(); }
});

test('history and search paginate beyond 50 messages; unread cursors cannot skip future messages', async () => {
  const f = await fixture();
  try {
    const a = await f.account('Alice'), b = await f.account('Bob');
    const { roomId } = await a.request('private', { userId: b.user.id });
    for (let i = 1; i <= 55; i++) await a.send(roomId, `quest ${i}`);
    await pause(); assert.equal(b.state.rooms.find(r => r.id === roomId).unread, 55);
    const page1 = await b.request('history', { roomId });
    assert.equal(page1.messages.length, 50); assert.equal(page1.hasMore, true);
    const page2 = await b.request('history', { roomId, before: page1.messages[0].seq });
    assert.equal(page2.messages.length, 5); assert.equal(page2.hasMore, false);
    const search1 = await b.request('search', { roomId, query: 'quest' });
    assert.equal(search1.messages.length, 50); assert.equal(search1.hasMore, true);
    const search2 = await b.request('search', { roomId, query: 'quest', before: search1.messages.at(-1).seq });
    assert.equal(search2.messages.length, 5);
    const literal = await b.request('search', { roomId, query: '%' }); assert.equal(literal.messages.length, 0);
    await b.request('read', { roomId, seq: Number.MAX_SAFE_INTEGER });
    await a.send(roomId, 'Next quest'); await pause();
    assert.equal(b.state.rooms.find(r => r.id === roomId).unread, 1);
    assert.equal(a.state.rooms.find(r => r.id === roomId).unread, 0);
  } finally { await f.close(); }
});

test('typing only reaches members and malformed requests do not stop the server', async () => {
  const f = await fixture();
  try {
    const a = await f.account('Alice'), b = await f.account('Bob'), c = await f.account('Carol');
    const { roomId } = await a.request('private', { userId: b.user.id });
    await a.request('typing', { roomId }); await pause();
    assert.equal(b.events.some(e => e.event === 'typing' && e.data.roomId === roomId), true);
    assert.equal(c.events.some(e => e.event === 'typing'), false);
    a.ws.send('null'); a.ws.send('{broken');
    await assert.rejects(a.request('history', null), /Invalid/);
    assert.equal((await a.request('history', { roomId })).messages.length, 0);
    assert.equal((await f.http('health')).status, 200);
  } finally { await f.close(); }
});

test('SQLite preserves accounts, unread positions and messages across server restarts', async () => {
  mkdirSync('test-results', { recursive: true });
  const path = resolve('test-results', `persistence-${randomUUID()}.sqlite`);
  let f = await fixture({ databasePath: path });
  let roomId, cookie;
  try {
    const a = await f.account('Alice'), b = await f.account('Bob');
    ({ roomId } = await a.request('private', { userId: b.user.id })); cookie = b.cookie;
    const first = await a.send(roomId, 'Persist this adventure');
    await b.request('read', { roomId, seq: first.message.seq });
    await a.send(roomId, 'A new unread chapter');
    const backupPath = resolve('test-results', `backup-${randomUUID()}.sqlite`);
    execFileSync(process.execPath, ['scripts/backup.mjs', backupPath], { env: { ...process.env, DATABASE_PATH: path } });
    const restored = new DatabaseSync(backupPath, { readOnly: true });
    try { assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 2); }
    finally { restored.close(); }
    await f.close(); f = await fixture({ databasePath: path });
    assert.equal((await f.http('me', undefined, cookie)).data.user.name, 'Bob');
    assert.equal(f.app.store.get('SELECT text FROM messages WHERE room_id=? ORDER BY seq', roomId).text, 'Persist this adventure');
    assert.equal(f.app.store.get('SELECT COUNT(*) AS n FROM users').n, 2);
    assert.equal(f.app.store.get('SELECT last_read FROM members WHERE room_id=? AND user_id=?', roomId, b.user.id).last_read, first.message.seq);
  } finally { await f.close(); }
});

test('AI quota failures leave chat available, and revoked members cannot receive in-flight summaries', async () => {
  const previousKey = process.env.OPENROUTER_API_KEY, previousModel = process.env.AI_MODEL;
  process.env.OPENROUTER_API_KEY = 'test-key'; process.env.AI_MODEL = 'openrouter/free';
  let release, announce;
  const started = new Promise(resolve => { announce = resolve; });
  const f = await fixture({ aiFetch: async () => {
    announce(); await new Promise(resolve => { release = resolve; });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'A private guild summary.' } }] }), { status: 200 });
  } });
  let quotaFixture;
  try {
    const a = await f.account('Alice'), b = await f.account('Bob');
    const { roomId } = await a.request('createGuild', { name: 'Guild', description: '' });
    await b.request('join', { roomId });
    await a.send(roomId, 'Private guild plan');
    const pending = f.http('summary', { roomId, consent: true }, a.cookie);
    await started;
    await a.request('transfer', { roomId, userId: b.user.id });
    await a.request('leave', { roomId });
    release();
    assert.equal((await pending).status, 403);
    assert.equal(f.app.store.get('SELECT COUNT(*) AS n FROM summaries').n, 0);
    quotaFixture = await fixture({ aiFetch: async () => new Response('{}', { status: 429 }) });
    const c = await quotaFixture.account('Carol');
    await c.request('join', { roomId: 'world' });
    await c.send('world', 'Summarize this');
    const response = await quotaFixture.http('summary', { roomId: 'world', consent: true }, c.cookie);
    assert.equal(response.status, 429);
    await c.send('world', 'Chat still works');
    assert.equal((await c.request('history', { roomId: 'world' })).messages.length, 2);
  } finally {
    release?.(); await f.close(); await quotaFixture?.close();
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_MODEL; else process.env.AI_MODEL = previousModel;
  }
});

test('AI requires consent and membership, calls a free model and reuses a cached summary', async () => {
  const previousKey = process.env.OPENROUTER_API_KEY, previousModel = process.env.AI_MODEL;
  process.env.OPENROUTER_API_KEY = 'test-key'; process.env.AI_MODEL = 'openrouter/free';
  let calls = 0;
  const f = await fixture({ aiFetch: async (url, options) => {
    calls++; assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(JSON.parse(options.body).model, 'openrouter/free');
    return new Response(JSON.stringify({ choices: [{ message: { content: 'The party will meet at the gate.' } }] }), { status: 200 });
  } });
  try {
    const a = await f.account('Alice'), b = await f.account('Bob');
    const { roomId } = await a.request('createGuild', { name: 'Guild', description: '' });
    await a.send(roomId, 'Meet at the gate');
    assert.equal((await f.http('summary', { roomId, consent: true }, b.cookie)).status, 403);
    assert.equal((await f.http('summary', { roomId }, a.cookie)).status, 400);
    const first = await f.http('summary', { roomId, consent: true }, a.cookie);
    assert.equal(first.status, 200); assert.equal(first.data.cached, false);
    const second = await f.http('summary', { roomId, consent: true }, a.cookie);
    assert.equal(second.data.cached, true); assert.equal(calls, 1);
    process.env.AI_MODEL = 'paid/model';
    assert.equal((await f.http('summary', { roomId, consent: true }, a.cookie)).status, 503);
  } finally {
    await f.close();
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_MODEL; else process.env.AI_MODEL = previousModel;
  }
});
