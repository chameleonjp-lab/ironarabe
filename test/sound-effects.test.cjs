"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modulePath = path.join(__dirname, "../js/sound-effects.js");
const loadModule = () => require(modulePath);

function eventTarget(extra = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    emit(type) {
      for (const callback of listeners.get(type) || []) callback();
    }
  }, extra);
}

function memoryStorage(value = null) {
  const values = new Map(value === null ? [] : [["ironarabe.sound.v1", value]]);
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, item) { values.set(key, item); }
  };
}

// Node has no audio hardware. These boundary doubles record the actual Web Audio
// graph, automation and scheduling commands issued by the production module.
function harness(options = {}) {
  const settings = { state: "running", fail: null, resumeMode: "resolve", ...options };
  const contexts = [];
  const storage = settings.storage || memoryStorage();
  const documentObject = eventTarget({ hidden: false, visibilityState: "visible" });
  const windowObject = eventTarget({ localStorage: storage });
  const fail = (step) => {
    if (settings.fail === step) throw new Error("Web Audio failed at " + step);
  };
  function parameter(name) {
    return {
      events: [],
      setValueAtTime(value, time) {
        fail(name);
        this.events.push({ method: "set", value, time });
      },
      linearRampToValueAtTime(value, time) {
        fail(name);
        this.events.push({ method: "linear", value, time });
      },
      exponentialRampToValueAtTime(value, time) {
        fail(name);
        this.events.push({ method: "exponential", value, time });
      },
      cancelScheduledValues(time) {
        this.events.push({ method: "cancel", time });
      }
    };
  }
  class AudioContext {
    constructor() {
      fail("context");
      this.state = settings.state;
      this.currentTime = 10;
      this.destination = {};
      this.oscillators = [];
      this.gains = [];
      this.resumeCalls = 0;
      contexts.push(this);
    }
    resume() {
      this.resumeCalls += 1;
      fail("resume");
      if (settings.resumeMode === "reject") return Promise.reject(new Error("resume denied"));
      if (settings.resumeMode === "pending") {
        return new Promise((resolve) => {
          this.resolveResume = () => { this.state = "running"; resolve(); };
        });
      }
      this.state = "running";
      return Promise.resolve();
    }
    createOscillator() {
      fail("oscillator");
      const oscillator = {
        type: "sine",
        frequency: parameter("frequency"),
        starts: [],
        stops: [],
        disconnected: false,
        onended: null,
        connect(destination) { fail("connect"); this.destination = destination; },
        disconnect() { fail("disconnect"); this.disconnected = true; },
        start(time) { fail("start"); this.starts.push(time); },
        stop(time) { fail("stop"); this.stops.push(time); },
        finish() { if (this.onended) this.onended(); }
      };
      this.oscillators.push(oscillator);
      return oscillator;
    }
    createGain() {
      fail("gain");
      const gain = {
        gain: parameter("envelope"),
        disconnected: false,
        connect(destination) { fail("connect"); this.destination = destination; },
        disconnect() { fail("disconnect"); this.disconnected = true; }
      };
      this.gains.push(gain);
      return gain;
    }
  }
  if (!settings.unsupported) {
    windowObject[settings.webkit ? "webkitAudioContext" : "AudioContext"] = AudioContext;
  }
  const sound = loadModule().createSoundEffects({ storage, windowObject, documentObject });
  return { sound, contexts, storage, documentObject, windowObject, settings };
}

function pitches(context) {
  return context.oscillators.map((oscillator) => oscillator.frequency.events[0].value);
}

function soundEnd(context) {
  return Math.max(...context.oscillators.flatMap((oscillator) => oscillator.stops));
}

test("exports the same API to CommonJS and a classic browser script", () => {
  const soundModule = loadModule();
  assert.deepEqual(Object.keys(soundModule).sort(), ["SOUND_STORAGE_KEY", "VOLUME_STORAGE_KEY", "createSoundEffects"]);
  assert.equal(soundModule.SOUND_STORAGE_KEY, "ironarabe.sound.v1");
  const browser = {};
  vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), browser);
  assert.equal(typeof browser.IronarabeSound.createSoundEffects, "function");
  assert.equal(browser.IronarabeSound.SOUND_STORAGE_KEY, "ironarabe.sound.v1");
});

test("defaults to enabled without creating an audio context", () => {
  const { sound, contexts } = harness();
  assert.equal(sound.isEnabled(), true);
  assert.equal(contexts.length, 0);
  assert.equal(sound.play("select"), false);
  assert.equal(contexts.length, 0);
});

test("restores and saves the sound setting without unlocking audio", () => {
  const { sound, storage, contexts } = harness({ storage: memoryStorage("false") });
  assert.equal(sound.isEnabled(), false);
  sound.unlock();
  assert.equal(contexts.length, 0);
  sound.setEnabled(true);
  assert.equal(sound.isEnabled(), true);
  assert.equal(storage.getItem("ironarabe.sound.v1"), "true");
  assert.equal(contexts.length, 0);
  sound.setEnabled(false);
  assert.equal(storage.getItem("ironarabe.sound.v1"), "false");
  assert.equal(harness({ storage: memoryStorage("invalid") }).sound.isEnabled(), true);
});

test("blocked or unavailable storage does not affect sound controls", () => {
  const { createSoundEffects } = loadModule();
  const brokenStorage = {
    getItem() { throw new Error("storage blocked"); },
    setItem() { throw new Error("storage full"); }
  };
  const sound = createSoundEffects({ storage: brokenStorage });
  assert.equal(sound.isEnabled(), true);
  assert.doesNotThrow(() => sound.setEnabled(false));
  assert.equal(sound.isEnabled(), false);
  const windowObject = {};
  Object.defineProperty(windowObject, "localStorage", { get() { throw new Error("storage denied"); } });
  assert.doesNotThrow(() => createSoundEffects({ windowObject }));
  assert.doesNotThrow(() => createSoundEffects().unlock());
});

test("unlock creates and resumes synchronously only when explicitly requested", async () => {
  const { sound, contexts } = harness({ state: "suspended" });
  sound.play("select");
  sound.setEnabled(true);
  assert.equal(contexts.length, 0);
  sound.unlock();
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].resumeCalls, 1);
  assert.equal(contexts[0].oscillators.length, 0);
  sound.unlock();
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].resumeCalls, 1);
  await Promise.resolve();
  sound.play("select");
  assert.equal(contexts[0].oscillators.length, 1);
});

test("uses Safari's prefixed AudioContext", () => {
  const { sound, contexts } = harness({ webkit: true });
  sound.unlock();
  assert.equal(sound.play("select"), true);
  assert.equal(contexts.length, 1);
});

test("play during a pending resume is discarded and never replayed later", async () => {
  const { sound, contexts } = harness({ state: "suspended", resumeMode: "pending" });
  sound.unlock();
  const context = contexts[0];
  sound.unlock();
  assert.equal(context.resumeCalls, 1);
  assert.equal(sound.play("swap"), false);
  assert.equal(context.resumeCalls, 1);
  assert.equal(context.oscillators.length, 0);
  context.resolveResume();
  await Promise.resolve();
  assert.equal(context.oscillators.length, 0);
  assert.equal(sound.play("select"), true);
});

test("a failed resume is caught and a later explicit unlock can retry", async () => {
  const { sound, contexts, settings } = harness({ state: "suspended", resumeMode: "reject" });
  assert.doesNotThrow(() => sound.unlock());
  await new Promise(setImmediate);
  assert.equal(sound.play("result"), false);
  assert.equal(contexts[0].oscillators.length, 0);
  settings.resumeMode = "resolve";
  sound.unlock();
  assert.equal(contexts[0].resumeCalls, 2);
  assert.equal(sound.play("select"), true);
});

test("play never resumes a context suspended after a previous unlock", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  contexts[0].state = "suspended";
  assert.equal(sound.play("select"), false);
  assert.equal(contexts[0].resumeCalls, 0);
  assert.equal(contexts[0].oscillators.length, 0);
});

test("a closed context is replaced only by a later unlock", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  contexts[0].state = "closed";
  assert.equal(sound.play("select"), false);
  assert.equal(contexts.length, 1);
  sound.unlock();
  assert.equal(contexts.length, 2);
  assert.equal(sound.play("select"), true);
});

test("select is a light high tone of about forty milliseconds", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  assert.equal(sound.play("select"), true);
  const context = contexts[0], oscillator = context.oscillators[0];
  assert.equal(context.oscillators.length, 1);
  assert.ok(pitches(context)[0] >= 750);
  assert.ok(soundEnd(context) - oscillator.starts[0] >= 0.03);
  assert.ok(soundEnd(context) - oscillator.starts[0] <= 0.06);
});

test("cancel is a lower short tone that is distinct from selection", () => {
  const selection = harness(), cancellation = harness();
  selection.sound.unlock();
  cancellation.sound.unlock();
  selection.sound.play("select");
  cancellation.sound.play("cancel");
  assert.equal(cancellation.contexts[0].oscillators.length, 1);
  assert.ok(pitches(cancellation.contexts[0])[0] < pitches(selection.contexts[0])[0]);
  assert.ok(soundEnd(cancellation.contexts[0]) - 10 <= 0.07);
});

test("swap schedules two clear rising tones over about one tenth of a second", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  sound.play("swap");
  const context = contexts[0];
  assert.equal(context.oscillators.length, 2);
  assert.ok(context.oscillators[1].starts[0] - context.oscillators[0].starts[0] >= 0.035);
  assert.ok(pitches(context)[1] > pitches(context)[0]);
  assert.ok(soundEnd(context) - 10 >= 0.08);
  assert.ok(soundEnd(context) - 10 <= 0.13);
});

test("completion preserves the final swap and follows it with a short ascending fanfare", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  sound.play("swap");
  const context = contexts[0];
  const swap = context.oscillators.slice();
  const swapEnd = soundEnd(context);
  sound.play("complete");
  const fanfare = context.oscillators.slice(2);
  assert.ok(fanfare.length >= 3);
  assert.ok(swap.every((oscillator) => !oscillator.disconnected));
  assert.ok(fanfare[0].starts[0] >= swapEnd + 0.02);
  assert.ok(fanfare[0].starts[0] - 10 <= 0.16);
  const notes = fanfare.map((oscillator) => oscillator.frequency.events[0].value);
  assert.ok(notes.every((pitch, index) => index === 0 || pitch > notes[index - 1]));
  assert.ok(soundEnd(context) - 10 <= 0.6);
});

test("result has a separate festive phrase and can be explicitly played again", () => {
  const completed = harness(), results = harness();
  completed.sound.unlock();
  results.sound.unlock();
  completed.sound.play("complete");
  results.sound.play("result");
  const context = results.contexts[0];
  assert.ok(context.oscillators.length >= 4);
  assert.notDeepEqual(pitches(context), pitches(completed.contexts[0]));
  assert.ok(soundEnd(context) - 10 <= 0.7);
  const firstCount = context.oscillators.length;
  assert.equal(results.sound.play("result"), true);
  assert.ok(context.oscillators.length > firstCount);
});

test("every tone uses low gain, a short attack and a silent envelope end", () => {
  for (const kind of ["select", "cancel", "swap", "complete", "result"]) {
    const { sound, contexts } = harness();
    sound.unlock();
    sound.play(kind);
    const context = contexts[0];
    for (let index = 0; index < context.oscillators.length; index += 1) {
      const oscillator = context.oscillators[index];
      const gain = context.gains[index];
      const envelope = gain.gain.events.filter((event) => event.method !== "cancel");
      assert.equal(oscillator.destination, gain);
      assert.equal(gain.destination, context.destination);
      assert.equal(envelope[0].value, 0);
      assert.equal(envelope.at(-1).value, 0);
      assert.ok(Math.max(...envelope.map((event) => event.value)) <= 0.06);
      assert.ok(Math.max(...envelope.map((event) => event.value)) > 0);
      assert.ok(envelope[1].time - oscillator.starts[0] <= 0.01);
      assert.ok(envelope.at(-1).time <= oscillator.stops[0]);
    }
  }
});

test("rapid interaction sounds share a debounce and work again after a short gap", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  assert.equal(sound.play("select"), true);
  const context = contexts[0];
  for (const kind of ["select", "cancel", "swap", "select"]) {
    assert.equal(sound.play(kind), false);
  }
  assert.equal(context.oscillators.length, 1);
  context.currentTime += 0.1;
  assert.equal(sound.play("swap"), true);
  assert.equal(context.oscillators.length, 3);
});

test("rapid repeated fanfares keep the number of live oscillator graphs bounded", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  const context = contexts[0];
  for (let index = 0; index < 40; index += 1) {
    sound.play(index % 2 ? "complete" : "result");
    assert.ok(context.oscillators.filter((oscillator) => !oscillator.disconnected).length <= 8);
  }
});

test("ended tones release both oscillator and gain connections", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  sound.play("swap");
  const context = contexts[0];
  for (const oscillator of context.oscillators) oscillator.finish();
  assert.ok(context.oscillators.every((oscillator) => oscillator.disconnected));
  assert.ok(context.gains.every((gain) => gain.disconnected));
});

test("stop cancels future fanfare notes immediately and allows later sounds", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  sound.play("complete");
  const context = contexts[0];
  sound.stop();
  assert.ok(context.oscillators.every((oscillator) => oscillator.stops.at(-1) <= context.currentTime));
  assert.ok(context.oscillators.every((oscillator) => oscillator.disconnected));
  assert.ok(context.gains.every((gain) => gain.disconnected));
  assert.ok(context.gains.every((gain) => gain.gain.events.some((event) => event.method === "cancel")));
  assert.doesNotThrow(() => sound.stop());
  assert.equal(sound.play("select"), true);
});

test("turning sound off stops active notes and turning on does not unlock", () => {
  const { sound, contexts } = harness();
  sound.unlock();
  sound.play("result");
  sound.setEnabled(false);
  assert.ok(contexts[0].oscillators.every((oscillator) => oscillator.disconnected));
  assert.equal(sound.play("complete"), false);
  contexts[0].state = "suspended";
  sound.setEnabled(true);
  assert.equal(contexts[0].resumeCalls, 0);
  assert.equal(sound.play("select"), false);
});

test("hiding the page and pagehide immediately silence scheduled sounds", () => {
  const { sound, contexts, documentObject, windowObject } = harness();
  sound.unlock();
  sound.play("complete");
  const context = contexts[0];
  documentObject.hidden = true;
  documentObject.visibilityState = "hidden";
  documentObject.emit("visibilitychange");
  assert.ok(context.oscillators.every((oscillator) => oscillator.disconnected));
  assert.equal(sound.play("result"), false);
  documentObject.hidden = false;
  documentObject.visibilityState = "visible";
  documentObject.emit("visibilitychange");
  assert.equal(context.oscillators.length, 3);
  sound.play("result");
  windowObject.emit("pagehide");
  assert.ok(context.oscillators.every((oscillator) => oscillator.disconnected));
});

test("unknown sounds and unsupported browsers are harmless", () => {
  const missing = harness({ unsupported: true });
  assert.doesNotThrow(() => missing.sound.unlock());
  assert.equal(missing.sound.play("select"), false);
  const { sound, contexts } = harness();
  assert.equal(sound.play("unknown"), false);
  sound.unlock();
  assert.equal(sound.play("unknown"), false);
  assert.equal(contexts[0].oscillators.length, 0);
});

for (const failedStep of ["context", "resume", "oscillator", "gain", "frequency", "envelope", "connect", "start", "stop", "disconnect"]) {
  test("audio failure at " + failedStep + " does not escape into the game", () => {
    const { sound, contexts, settings } = harness({ state: failedStep === "resume" ? "suspended" : "running", fail: failedStep });
    assert.doesNotThrow(() => sound.unlock());
    assert.doesNotThrow(() => sound.play("swap"));
    assert.doesNotThrow(() => sound.stop());
    assert.doesNotThrow(() => sound.setEnabled(false));
    settings.fail = null;
    sound.setEnabled(true);
    sound.unlock();
    if (contexts[0]) contexts.at(-1).currentTime += 1;
    assert.equal(sound.play("select"), true);
  });
}

test('volume preserves zero across reload and stops pending voices', () => {
  const storage=memoryStorage();
  const first=loadModule().createSoundEffects({storage,windowObject:{}});
  assert.equal(first.getVolume(),1);
  first.setVolume(0);
  const next=loadModule().createSoundEffects({storage,windowObject:{AudioContext(){throw Error('must not create')}}});
  assert.equal(next.getVolume(),0);
  assert.equal(next.unlock(),false);
  next.setVolume(0.4);
  assert.equal(loadModule().createSoundEffects({storage,windowObject:{}}).getVolume(),0.4);
});

test('interrupted context stops scheduled sounds without waiting for visibilitychange',()=>{const h=harness();h.sound.unlock();h.sound.play('complete');const c=h.contexts[0];c.state='interrupted';c.onstatechange?.();assert.ok(c.oscillators.every(o=>o.disconnected));assert.ok(c.gains.every(g=>g.disconnected));});

test('a later gesture retries an indefinitely pending resume without replaying sounds', async () => {
  const { sound, contexts, settings } = harness({ state: 'suspended', resumeMode: 'pending' });
  sound.unlock();
  const context = contexts[0];
  const resolveOld = context.resolveResume;
  sound.unlock();
  assert.equal(context.resumeCalls, 1, 'same synchronous gesture is coalesced');
  assert.equal(sound.play('result'), false);
  await new Promise(setImmediate);
  settings.resumeMode = 'resolve';
  assert.equal(sound.unlock(), true);
  assert.equal(context.resumeCalls, 2);
  assert.equal(contexts.length, 1);
  resolveOld();
  await Promise.resolve();
  assert.equal(context.oscillators.length, 0, 'old sounds are not queued');
});

for (const condition of ['off', 'zero', 'hidden', 'closed']) {
  test(`pending resume retry respects ${condition} and can recover on a later gesture`, async () => {
    const { sound, contexts, documentObject, settings } = harness({ state: 'suspended', resumeMode: 'pending' });
    sound.unlock();
    const old = contexts[0];
    const settleOld = old.resolveResume;
    await new Promise(setImmediate);
    if (condition === 'off') sound.setEnabled(false);
    if (condition === 'zero') sound.setVolume(0);
    if (condition === 'hidden') { documentObject.hidden = true; documentObject.emit('visibilitychange'); }
    if (condition === 'closed') old.state = 'closed';
    sound.unlock();
    assert.equal(old.resumeCalls, 1);
    assert.equal(sound.play('result'), false);
    if (condition === 'off') sound.setEnabled(true);
    if (condition === 'zero') sound.setVolume(0.4);
    documentObject.hidden = false;
    await new Promise(setImmediate);
    settings.resumeMode = 'resolve';
    assert.equal(sound.unlock(), true);
    const current = contexts.at(-1);
    assert.equal(current.resumeCalls, 2);
    settleOld();
    await Promise.resolve();
    assert.equal(current.oscillators.length, 0);
    assert.equal(sound.getVolume(), condition === 'zero' ? 0.4 : 1);
  });
}
