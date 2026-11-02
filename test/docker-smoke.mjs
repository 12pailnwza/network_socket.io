// Uses only a new, uniquely named QA container/volume. Never mounts the user's data directory.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

const image = 'realm-chat:local';
const id = randomUUID();
const container = `realm-chat-qa-${id}`;
const volume = `realm-chat-qa-data-${id}`;
const sockets = [];
let containerCreated = false, volumeCreated = false;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 60000, stdio: 'pipe' }).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function ready(base) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await delay(300);
  }
  throw new Error('The QA container did not become ready within 30 seconds.');
}
async function account(base, name) {
  const response = await fetch(`${base}/api/register`, {
    method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password: randomUUID(), avatar: 'archer' }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return { cookie, user: (await response.json()).user };
}
async function connect(base, account) {
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/socket', { headers: { Cookie: account.cookie, Origin: base } });
  sockets.push(ws);
  const pending = new Map();
  let initialized;
  const initial = new Promise(resolve => { initialized = resolve; });
  const initialTimeout = setTimeout(() => ws.terminate(), 5000);
  ws.on('error', () => {});
  ws.on('message', raw => {
    const { event, data } = JSON.parse(raw.toString());
    if (event === 'state') { clearTimeout(initialTimeout); initialized(); }
    if (event === 'reply') {
      const p = pending.get(data.id);
      if (p) { clearTimeout(p.timer); pending.delete(data.id); data.error ? p.reject(new Error(data.error)) : p.resolve(data.result); }
    }
  });
  const failure = new Promise((_, reject) => ws.once('close', () => { clearTimeout(initialTimeout); reject(new Error('QA socket closed before receiving initial state.')); }));
  await Promise.race([initial, failure]);
  return (action, data) => new Promise((resolve, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`No reply to ${action}`)); }, 5000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, action, data }));
  });
}

try {
  docker('image', 'inspect', image);
  docker('volume', 'create', '--label', 'realm.qa=true', volume); volumeCreated = true;
  docker('run', '--detach', '--name', container, '--label', 'realm.qa=true', '-p', '127.0.0.1::3000',
    '--mount', `type=volume,source=${volume},target=/data`, image);
  containerCreated = true;
  const address = () => {
    const binding = docker('port', container, '3000/tcp').split('\n').find(line => line.startsWith('127.0.0.1:'));
    assert.ok(binding); return `http://${binding}`;
  };
  let base = address();
  await ready(base);
  const page = await fetch(base);
  assert.equal(page.status, 200); assert.match(await page.text(), /Realm/);
  const a = await account(base, 'DockerAlice'), b = await account(base, 'DockerBob');
  const sendA = await connect(base, a), sendB = await connect(base, b);
  await sendA('join', { roomId: 'world' }); await sendB('join', { roomId: 'world' });
  const { message } = await sendA('message', { roomId: 'world', text: 'Persist across a container restart. สวัสดี 👋', clientId: randomUUID() });
  const first = await sendB('history', { roomId: 'world' });
  assert.equal(first.messages[0].id, message.id);
  await sendB('read', { roomId: 'world', seq: message.seq });
  docker('exec', container, 'npm', 'run', 'backup', '--', '/data/qa-backup.sqlite');
  const backupCount = docker('exec', container, 'node', '--input-type=module', '-e',
    "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync('/data/qa-backup.sqlite',{readOnly:true}); console.log(db.prepare('SELECT COUNT(*) AS n FROM messages').get().n); db.close();");
  assert.equal(backupCount, '1');
  docker('restart', '--timeout', '10', container);
  // Docker may assign a new host port when restarting a container published with port 0.
  base = address();
  await ready(base);
  const me = await fetch(`${base}/api/me`, { headers: { Cookie: b.cookie } });
  assert.equal(me.status, 200); assert.equal((await me.json()).user.id, b.user.id);
  const reconnected = await connect(base, b);
  const restored = await reconnected('history', { roomId: 'world' });
  assert.equal(restored.messages[0].id, message.id);
  assert.equal(restored.messages[0].text, message.text);
  console.log('Docker smoke passed: page + HTTP + WebSocket + SQLite write + live backup + restart + persisted session/history.');
} catch (error) {
  if (containerCreated) console.error(docker('logs', container));
  throw error;
} finally {
  for (const socket of sockets) socket.terminate();
  // The names above are generated here; labels guard against touching unrelated Docker resources.
  if (containerCreated && docker('inspect', '--format', '{{index .Config.Labels "realm.qa"}}', container) === 'true') docker('rm', '--force', container);
  if (volumeCreated && docker('volume', 'inspect', '--format', '{{index .Labels "realm.qa"}}', volume) === 'true') docker('volume', 'rm', volume);
}
