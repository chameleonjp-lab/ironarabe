'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const modulePath = path.join(__dirname, '../js/guest-plays.js');
const guests = fs.existsSync(modulePath) ? require(modulePath) : {};
const VERSION = 'ironarabe-web-1.4.1-stagepack001-v2-sunset-r0';
const OTHER_VERSION = 'ironarabe-web-1.4.1-stagepack001-v2-aurora-r3';
const FIRST_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_ID = '10000000-0000-4000-8000-000000000002';
const THIRD_ID = '10000000-0000-4000-8000-000000000003';
const PLAY_ID = '90000000-0000-4000-8000-000000000001';
const PREFIX = 'ironarabe.guestPlay.v1.';

class MemoryStorage {
  constructor(entries = []) { this.entries = new Map(entries); }
  get length() { return this.entries.size; }
  key(index) { return [...this.entries.keys()][index] ?? null; }
  getItem(key) { return this.entries.get(key) ?? null; }
  setItem(key, value) { this.entries.set(key, String(value)); }
  removeItem(key) { this.entries.delete(key); }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function accepted(startId = FIRST_ID, clientVersion = VERSION) {
  return { accepted: true, start_id: startId, game_slug: 'ironarabe', play_id: PLAY_ID, client_version: clientVersion };
}

function nextTurn() { return new Promise(resolve => setImmediate(resolve)); }

function browserModule(globals = {}) {
  const sandbox = { ...globals };
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), sandbox, { filename: 'guest-plays.js' });
  return { sandbox, api: sandbox.IronarabeGuests };
}

test('persists only a guest start before sending asynchronously and removes it after a matching acknowledgement', async () => {
  assert.equal(typeof guests.createGuestPlayCounter, 'function');
  assert.equal(guests.GUEST_PENDING_PREFIX, PREFIX);
  const storage = new MemoryStorage();
  const traffic = [];
  const response = deferred();
  const statuses = [];
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => FIRST_ID,
    onChange: (startId, status) => statuses.push([startId, status]),
    send(payload) {
      assert.deepEqual(JSON.parse(storage.getItem(PREFIX + FIRST_ID)), { startId: FIRST_ID, clientVersion: VERSION });
      traffic.push(payload);
      return response.promise;
    }
  });
  assert.equal(counter.record(VERSION), FIRST_ID);
  assert.deepEqual(JSON.parse(storage.getItem(PREFIX + FIRST_ID)), { startId: FIRST_ID, clientVersion: VERSION });
  assert.deepEqual(traffic, [], 'the synchronous game start must finish before network work');
  await nextTurn();
  assert.deepEqual(traffic, [{ p_start_id: FIRST_ID, p_game_slug: 'ironarabe', p_client_version: VERSION }]);
  response.resolve(accepted());
  await counter.retry();
  assert.equal(storage.getItem(PREFIX + FIRST_ID), null);
  assert.deepEqual(statuses, [[FIRST_ID, 'pending'], [FIRST_ID, 'success']]);
});

test('retains a rejected start and retries with the same UUID without an automatic retry loop', async () => {
  const storage = new MemoryStorage();
  const traffic = [];
  const statuses = [];
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => FIRST_ID,
    onChange: (startId, status) => statuses.push([startId, status]),
    send(payload) {
      traffic.push(payload);
      if (traffic.length === 1) return Promise.reject(new Error('offline'));
      return Promise.resolve(accepted());
    }
  });
  counter.record(VERSION);
  await assert.doesNotReject(counter.retry());
  await nextTurn();
  assert.equal(traffic.length, 1);
  assert.notEqual(storage.getItem(PREFIX + FIRST_ID), null);
  assert.deepEqual(statuses, [[FIRST_ID, 'pending'], [FIRST_ID, 'failed']]);
  await counter.retry();
  assert.deepEqual(traffic, [
    { p_start_id: FIRST_ID, p_game_slug: 'ironarabe', p_client_version: VERSION },
    { p_start_id: FIRST_ID, p_game_slug: 'ironarabe', p_client_version: VERSION }
  ]);
  assert.equal(storage.getItem(PREFIX + FIRST_ID), null);
  assert.deepEqual(statuses.slice(-2), [[FIRST_ID, 'pending'], [FIRST_ID, 'success']]);
});

const malformedAcknowledgements = [
  ['missing response', null],
  ['an array instead of a JSON object', [accepted()]],
  ['accepted false', { ...accepted(), accepted: false }],
  ['truthy accepted', { ...accepted(), accepted: 'true' }],
  ['another start', { ...accepted(), start_id: SECOND_ID }],
  ['another game', { ...accepted(), game_slug: 'takkeu' }],
  ['a malformed play UUID', { ...accepted(), play_id: 'not-a-uuid' }],
  ['another client version', { ...accepted(), client_version: OTHER_VERSION }],
  ['a missing client version', { accepted: true, start_id: FIRST_ID, game_slug: 'ironarabe', play_id: PLAY_ID }]
];

for (const [label, response] of malformedAcknowledgements) {
  test(`retains the queue when an acknowledgement contains ${label}`, async () => {
    const storage = new MemoryStorage();
    let attempts = 0;
    const statuses = [];
    const counter = guests.createGuestPlayCounter({
      storage,
      randomUUID: () => FIRST_ID,
      onChange: (startId, status) => statuses.push([startId, status]),
      send: async () => { attempts++; return attempts === 1 ? response : accepted(); }
    });
    counter.record(VERSION);
    await counter.retry();
    assert.notEqual(storage.getItem(PREFIX + FIRST_ID), null);
    assert.deepEqual(statuses.at(-1), [FIRST_ID, 'failed']);
    await nextTurn();
    assert.equal(attempts, 1, 'a malformed acknowledgement must await a later retry trigger');
    await counter.retry();
    assert.equal(storage.getItem(PREFIX + FIRST_ID), null);
  });
}

test('uses the browser crypto.randomUUID by default', async () => {
  const { api } = browserModule({ crypto: { randomUUID: () => FIRST_ID } });
  const traffic = [];
  const counter = api.createGuestPlayCounter({ send: async payload => { traffic.push({ ...payload }); return accepted(); } });
  assert.equal(counter.record(VERSION), FIRST_ID);
  await counter.retry();
  assert.deepEqual(traffic, [{ p_start_id: FIRST_ID, p_game_slug: 'ironarabe', p_client_version: VERSION }]);
});

test('uses cryptographic getRandomValues on Safari without crypto.randomUUID', async () => {
  const fallbackId = '00000000-0000-4000-8000-000000000000';
  const { api } = browserModule({ crypto: { getRandomValues(bytes) { bytes.fill(0); return bytes; } } });
  const traffic = [];
  const counter = api.createGuestPlayCounter({
    send: async payload => { traffic.push({ ...payload }); return accepted(fallbackId); }
  });
  assert.equal(counter.record(VERSION), fallbackId);
  await counter.retry();
  assert.deepEqual(traffic, [{ p_start_id: fallbackId, p_game_slug: 'ironarabe', p_client_version: VERSION }]);
});

test('falls back to getRandomValues when crypto.randomUUID throws', async () => {
  const fallbackId = '00000000-0000-4000-8000-000000000000';
  const { api } = browserModule({ crypto: {
    randomUUID() { throw new Error('unavailable'); },
    getRandomValues(bytes) { bytes.fill(0); return bytes; }
  } });
  const counter = api.createGuestPlayCounter({ send: async () => accepted(fallbackId) });
  assert.equal(counter.record(VERSION), fallbackId);
  await counter.retry();
});

test('returns null without stopping gameplay when a cryptographic UUID is unavailable', async () => {
  const { api } = browserModule();
  let attempts = 0;
  const counter = api.createGuestPlayCounter({ send: async () => { attempts++; return accepted(); } });
  assert.equal(counter.record(VERSION), null);
  await counter.retry();
  assert.equal(attempts, 0);
});

for (const [label, randomUUID] of [
  ['throws', () => { throw new Error('crypto unavailable'); }],
  ['returns malformed data', () => 'not-a-uuid']
]) {
  test(`keeps gameplay available when the injected UUID generator ${label}`, async () => {
    const storage = new MemoryStorage();
    let attempts = 0;
    const counter = guests.createGuestPlayCounter({ storage, randomUUID, send: async () => { attempts++; return accepted(); } });
    assert.equal(counter.record(VERSION), null);
    await counter.retry();
    assert.equal(attempts, 0);
    assert.equal(storage.length, 0);
  });
}

test('normalizes and validates client versions before creating a durable guest start', async () => {
  const storage = new MemoryStorage();
  const traffic = [];
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => FIRST_ID,
    send: async payload => { traffic.push(payload); return accepted(); }
  });
  for (const invalid of [undefined, null, 1, '', 'unversioned', `${VERSION}-extra`, 'ironarabe-web-1.4.1-stagepack001-v2-sunset-r4', 'x'.repeat(81)]) {
    assert.equal(counter.record(invalid), null);
  }
  assert.equal(storage.length, 0);
  assert.equal(counter.record(`  ${VERSION}\n`), FIRST_ID);
  assert.deepEqual(JSON.parse(storage.getItem(PREFIX + FIRST_ID)), { startId: FIRST_ID, clientVersion: VERSION });
  await counter.retry();
  assert.deepEqual(traffic, [{ p_start_id: FIRST_ID, p_game_slug: 'ironarabe', p_client_version: VERSION }]);
});

test('retains the in-memory queue when every storage method is denied', async () => {
  const storage = {
    get length() { throw new Error('denied'); },
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
    key() { throw new Error('denied'); }
  };
  const traffic = [];
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => FIRST_ID,
    send: async payload => { traffic.push(payload); if (traffic.length === 1) throw new Error('offline'); return accepted(); }
  });
  assert.equal(counter.record(VERSION), FIRST_ID);
  await counter.retry();
  await counter.retry();
  assert.deepEqual(traffic.map(row => row.p_start_id), [FIRST_ID, FIRST_ID]);
});

test('keeps a memory queue when the browser localStorage getter is denied', async () => {
  const { sandbox, api } = browserModule();
  Object.defineProperty(sandbox, 'localStorage', { get() { throw new Error('SecurityError'); } });
  const traffic = [];
  const counter = api.createGuestPlayCounter({
    randomUUID: () => FIRST_ID,
    send: async payload => { traffic.push({ ...payload }); if (traffic.length === 1) throw new Error('offline'); return accepted(); }
  });
  assert.equal(counter.record(VERSION), FIRST_ID);
  await counter.retry();
  await counter.retry();
  assert.equal(traffic.length, 2);
});

test('a throwing status callback cannot break the record or acknowledgement', async () => {
  const storage = new MemoryStorage();
  const traffic = [];
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => FIRST_ID,
    onChange() { throw new Error('UI unavailable'); },
    send: async payload => { traffic.push(payload); return accepted(); }
  });
  assert.equal(counter.record(VERSION), FIRST_ID);
  await counter.retry();
  assert.equal(traffic.length, 1);
  assert.equal(storage.length, 0);
});

test('reload retries the persisted UUID with its original client version', async () => {
  const storage = new MemoryStorage();
  const original = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => FIRST_ID,
    send: async () => { throw new Error('offline'); }
  });
  original.record(OTHER_VERSION);
  await original.retry();
  const traffic = [];
  const reloaded = guests.createGuestPlayCounter({
    storage,
    send: async payload => { traffic.push(payload); return accepted(FIRST_ID, OTHER_VERSION); }
  });
  await reloaded.retry();
  assert.deepEqual(traffic, [{ p_start_id: FIRST_ID, p_game_slug: 'ironarabe', p_client_version: OTHER_VERSION }]);
  assert.equal(storage.length, 0);
});

test('a new start retries older persisted entries before sending the new UUID', async () => {
  const storage = new MemoryStorage([[PREFIX + FIRST_ID, JSON.stringify({ startId: FIRST_ID, clientVersion: OTHER_VERSION })]]);
  const traffic = [];
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => SECOND_ID,
    send: async payload => { traffic.push(payload); return accepted(payload.p_start_id, payload.p_client_version); }
  });
  assert.equal(counter.record(VERSION), SECOND_ID);
  await counter.retry();
  assert.deepEqual(traffic, [
    { p_start_id: FIRST_ID, p_game_slug: 'ironarabe', p_client_version: OTHER_VERSION },
    { p_start_id: SECOND_ID, p_game_slug: 'ironarabe', p_client_version: VERSION }
  ]);
  assert.equal(storage.length, 0);
});

test('records during an in-flight success remain FIFO and concurrent retry calls share one send', async () => {
  const storage = new MemoryStorage();
  const first = deferred();
  const second = deferred();
  const ids = [FIRST_ID, SECOND_ID];
  const traffic = [];
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => ids.shift(),
    send(payload) { traffic.push(payload); return traffic.length === 1 ? first.promise : second.promise; }
  });
  assert.equal(counter.record(VERSION), FIRST_ID);
  const running = counter.retry();
  await nextTurn();
  assert.equal(counter.record(OTHER_VERSION), SECOND_ID);
  assert.equal(counter.retry(), running);
  assert.equal(counter.retry(), running);
  assert.equal(traffic.length, 1);
  assert.deepEqual(JSON.parse(storage.getItem(PREFIX + SECOND_ID)), { startId: SECOND_ID, clientVersion: OTHER_VERSION });
  first.resolve(accepted());
  await nextTurn();
  assert.deepEqual(traffic, [
    { p_start_id: FIRST_ID, p_game_slug: 'ironarabe', p_client_version: VERSION },
    { p_start_id: SECOND_ID, p_game_slug: 'ironarabe', p_client_version: OTHER_VERSION }
  ]);
  second.resolve(accepted(SECOND_ID, OTHER_VERSION));
  await running;
  await counter.retry();
  assert.equal(traffic.length, 2);
  assert.equal(storage.length, 0);
});

test('a new record during a failed in-flight send triggers one follow-up and preserves FIFO', async () => {
  const storage = new MemoryStorage();
  const first = deferred();
  const ids = [FIRST_ID, SECOND_ID];
  const traffic = [];
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => ids.shift(),
    send(payload) {
      traffic.push(payload);
      return traffic.length === 1 ? first.promise : Promise.resolve(accepted(payload.p_start_id, payload.p_client_version));
    }
  });
  counter.record(VERSION);
  await nextTurn();
  counter.record(OTHER_VERSION);
  first.reject(new Error('temporarily offline'));
  await counter.retry();
  assert.deepEqual(traffic.map(payload => payload.p_start_id), [FIRST_ID, FIRST_ID, SECOND_ID]);
  assert.equal(storage.length, 0);
});

test('new records during repeated rejections cannot trigger an unbounded retry chain', async () => {
  const storage = new MemoryStorage();
  const ids = [FIRST_ID, SECOND_ID, THIRD_ID];
  const traffic = [];
  let counter;
  counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => ids.shift(),
    send(payload) {
      traffic.push(payload);
      if (traffic.length < 3) counter.record(VERSION);
      return Promise.reject(new Error('offline'));
    }
  });
  counter.record(VERSION);
  await counter.retry();
  await nextTurn();
  assert.equal(traffic.length, 2, 'only one follow-up is allowed during a failed drain');
  assert.equal(storage.length, 3);
});

test('retry merges another tab entry without overwriting it or deleting it when a different UUID is acknowledged', async () => {
  const storage = new MemoryStorage([['unrelated.preference', 'keep']]);
  const first = deferred();
  const second = deferred();
  const traffic = [];
  const otherTabRow = JSON.stringify({ startId: SECOND_ID, clientVersion: OTHER_VERSION });
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => FIRST_ID,
    send(payload) { traffic.push(payload); return traffic.length === 1 ? first.promise : second.promise; }
  });
  counter.record(VERSION);
  await nextTurn();
  storage.setItem(PREFIX + SECOND_ID, otherTabRow);
  const running = counter.retry();
  assert.equal(storage.getItem(PREFIX + SECOND_ID), otherTabRow);
  first.resolve(accepted());
  await nextTurn();
  assert.equal(storage.getItem(PREFIX + FIRST_ID), null);
  assert.equal(storage.getItem(PREFIX + SECOND_ID), otherTabRow);
  assert.deepEqual(traffic.map(payload => payload.p_start_id), [FIRST_ID, SECOND_ID]);
  second.resolve(accepted(SECOND_ID, OTHER_VERSION));
  await running;
  assert.equal(storage.getItem(PREFIX + SECOND_ID), null);
  assert.equal(storage.getItem('unrelated.preference'), 'keep');
});

test('two counters can persist separate offline starts without replacing either entry', async () => {
  const storage = new MemoryStorage();
  const offline = async () => { throw new Error('offline'); };
  const firstTab = guests.createGuestPlayCounter({ storage, randomUUID: () => FIRST_ID, send: offline });
  const secondTab = guests.createGuestPlayCounter({ storage, randomUUID: () => SECOND_ID, send: offline });
  firstTab.record(VERSION);
  secondTab.record(OTHER_VERSION);
  await Promise.all([firstTab.retry(), secondTab.retry()]);
  assert.deepEqual([...storage.entries], [
    [PREFIX + FIRST_ID, JSON.stringify({ startId: FIRST_ID, clientVersion: VERSION })],
    [PREFIX + SECOND_ID, JSON.stringify({ startId: SECOND_ID, clientVersion: OTHER_VERSION })]
  ]);
});

test('ignores malformed and unknown storage entries while draining a valid start', async () => {
  const storage = new MemoryStorage([
    [PREFIX + 'bad-id', JSON.stringify({ startId: FIRST_ID, clientVersion: VERSION })],
    [PREFIX + SECOND_ID, JSON.stringify({ startId: THIRD_ID, clientVersion: VERSION })],
    [PREFIX + THIRD_ID, JSON.stringify({ startId: THIRD_ID, clientVersion: 'unknown-version' })],
    [PREFIX + PLAY_ID, 'malformed JSON'],
    [PREFIX + '10000000-0000-4000-8000-000000000004', 'null'],
    [PREFIX + '10000000-0000-4000-8000-000000000005', '[]'],
    ['ranking.pending', JSON.stringify({ startId: SECOND_ID, clientVersion: VERSION, playerName: 'Example', score: 1 })],
    [PREFIX + FIRST_ID, JSON.stringify({ startId: FIRST_ID, clientVersion: VERSION })]
  ]);
  const traffic = [];
  const counter = guests.createGuestPlayCounter({ storage, send: async payload => { traffic.push(payload); return accepted(); } });
  await counter.retry();
  assert.deepEqual(traffic, [{ p_start_id: FIRST_ID, p_game_slug: 'ironarabe', p_client_version: VERSION }]);
  assert.equal(storage.length, 7);
  assert.notEqual(storage.getItem('ranking.pending'), null);
});

test('refuses a repeated generated UUID instead of overwriting its pending row', async () => {
  const storage = new MemoryStorage();
  let attempts = 0;
  const counter = guests.createGuestPlayCounter({
    storage,
    randomUUID: () => FIRST_ID,
    send: async () => { attempts++; throw new Error('offline'); }
  });
  assert.equal(counter.record(VERSION), FIRST_ID);
  await counter.retry();
  assert.equal(counter.record(OTHER_VERSION), null);
  await counter.retry();
  assert.deepEqual(JSON.parse(storage.getItem(PREFIX + FIRST_ID)), { startId: FIRST_ID, clientVersion: VERSION });
  assert.equal(attempts, 2);
});

test('an online recovery during the old request schedules one retry after it fails',async()=>{
 const storage=new MemoryStorage(),first=deferred();let attempts=0;
 const counter=guests.createGuestPlayCounter({storage,randomUUID:()=>FIRST_ID,send(){attempts++;return attempts===1?first.promise:Promise.resolve(accepted());}});
 counter.record(VERSION);await nextTurn();const recovery=counter.retry({recover:true});first.reject(new Error('old offline request'));
 await recovery;assert.equal(attempts,2);assert.equal(storage.length,0,'recovery must acknowledge the original start rather than await another online event');
});
test('queued current games report failed when an older request stops the drain',async()=>{
 const storage=new MemoryStorage(),ids=[FIRST_ID,SECOND_ID],events=[];
 const counter=guests.createGuestPlayCounter({storage,randomUUID:()=>ids.shift(),send:async()=>{throw new Error('offline')},onChange:(id,status)=>events.push([id,status])});
 counter.record(VERSION);await counter.retry();counter.record(OTHER_VERSION);await counter.retry();
 assert.equal(events.filter(([id])=>id===SECOND_ID).at(-1)[1],'failed');assert.equal(storage.length,2);
});
