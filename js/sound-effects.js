(function (root) {
  "use strict";

  const SOUND_STORAGE_KEY = "ironarabe.sound.v1";
  const VOLUME_STORAGE_KEY = "ironarabe.volume.v1";
  const MAX_VOICES = 6;
  const INTERACTION_SPACING = { select: 0.035, cancel: 0.04, swap: 0.065 };
  // Each note is [offset, frequency, duration, gain, oscillator type].
  const SOUNDS = {
    select: [[0, 880, 0.04, 0.025, "sine"]],
    cancel: [[0, 440, 0.045, 0.022, "sine"]],
    swap: [[0, 659.25, 0.045, 0.024, "triangle"], [0.05, 880, 0.05, 0.024, "triangle"]],
    // Leave room for the final swap's 100 ms phrase before celebrating.
    complete: [[0.14, 783.99, 0.075, 0.028, "triangle"], [0.215, 987.77, 0.075, 0.028, "triangle"], [0.29, 1318.51, 0.13, 0.03, "triangle"]],
    result: [[0, 659.25, 0.09, 0.025, "triangle"], [0.08, 783.99, 0.09, 0.025, "triangle"], [0.16, 987.77, 0.09, 0.025, "triangle"], [0.24, 1318.51, 0.19, 0.028, "triangle"], [0.24, 987.77, 0.19, 0.018, "sine"]]
  };

  function attempt(operation) {
    try { return operation(); }
    catch (_) { return undefined; }
  }

  function createSoundEffects({ storage, windowObject, documentObject } = {}) {
    if (windowObject === undefined) windowObject = root.window || root;
    if (documentObject === undefined) documentObject = attempt(() => windowObject.document) || root.document;
    if (storage === undefined) storage = attempt(() => windowObject.localStorage);

    let enabled = attempt(() => storage.getItem(SOUND_STORAGE_KEY)) !== "false";
    const savedVolume = attempt(() => storage.getItem(VOLUME_STORAGE_KEY));
    let volumeLevel = savedVolume != null && String(savedVolume).trim() !== '' && Number.isFinite(Number(savedVolume)) && Number(savedVolume) >= 0 && Number(savedVolume) <= 1 ? Number(savedVolume) : 1;
    let context = null;
    let resumePending = false;
    let lastInteractionAt = -Infinity;
    let lastPlayed = {};
    const voices = new Set();

    function isHidden() {
      return Boolean(attempt(() => documentObject.hidden || documentObject.visibilityState === "hidden"));
    }

    function timeNow() {
      const time = attempt(() => context.currentTime);
      return Number.isFinite(time) && time >= 0 ? time : 0;
    }

    function releaseVoice(voice, cancel, now) {
      if (!voices.delete(voice)) return;
      attempt(() => { voice.oscillator.onended = null; });
      if (cancel) {
        attempt(() => voice.gain.gain.cancelScheduledValues(now));
        attempt(() => voice.gain.gain.setValueAtTime(0, now));
        attempt(() => voice.oscillator.stop(now));
      }
      attempt(() => voice.oscillator.disconnect());
      attempt(() => voice.gain.disconnect());
    }

    function stop() {
      const now = timeNow();
      for (const voice of voices) releaseVoice(voice, true, now);
      lastInteractionAt = -Infinity;
      lastPlayed = {};
    }

    function setVolume(value) {
      if (!Number.isFinite(value) || value < 0 || value > 1) return;
      volumeLevel = value;
      attempt(() => storage.setItem(VOLUME_STORAGE_KEY, String(value)));
      stop();
    }

    function setEnabled(value) {
      enabled = Boolean(value);
      attempt(() => storage.setItem(SOUND_STORAGE_KEY, String(enabled)));
      if (!enabled) stop();
      return enabled;
    }

    // Main calls this directly in its pointer/keyboard/click handler. In
    // particular, do not move resume() behind a promise, timeout or await.
    function unlock() {
      if (!enabled || volumeLevel === 0 || isHidden()) return false;
      try {
        if (context && context.state === "closed") {
          stop();
          context = null;
          resumePending = false;
        }
        if (!context) {
          const AudioContext = windowObject && (windowObject.AudioContext || windowObject.webkitAudioContext);
          if (typeof AudioContext !== "function") return false;
          context = new AudioContext();
          context.onstatechange = () => { if (context.state !== "running") stop(); };
        }
        if (context.state === "running") return true;
        if (resumePending || typeof context.resume !== "function") return false;
        const resumedContext = context;
        resumePending = true;
        const resumed = context.resume();
        // Coalesce this synchronous gesture only. Safari may leave resume()
        // pending forever; the next gesture must call it synchronously again.
        // Settlement never changes the gate or replays discarded sound effects.
        Promise.resolve(resumed).catch(() => {});
        Promise.resolve().then(() => {
          if (context === resumedContext) resumePending = false;
        });
        return context.state === "running";
      } catch (_) {
        resumePending = false;
        return false;
      }
    }

    function play(kind) {
      const addedVoices = [];
      try {
        if (!Object.prototype.hasOwnProperty.call(SOUNDS, kind) || !enabled || volumeLevel === 0 || !context || context.state !== "running" || isHidden()) return false;
        const now = context.currentTime;
        if (!Number.isFinite(now) || now < 0) return false;
        const spacing = INTERACTION_SPACING[kind];
        if (spacing && (now - lastInteractionAt < 0.018 || now - (lastPlayed[kind] ?? -Infinity) < spacing)) return false;

        for (const voice of voices) {
          if (voice.end <= now) releaseVoice(voice, false, now);
        }
        if (kind === "result") stop();
        const notes = SOUNDS[kind];
        while (voices.size + notes.length > MAX_VOICES) {
          releaseVoice(voices.values().next().value, true, now);
        }

        for (const [offset, frequency, duration, volume, type] of notes) {
          const start = now + offset;
          const end = start + duration;
          const voice = { oscillator: null, gain: null, end };
          voices.add(voice);
          addedVoices.push(voice);
          voice.oscillator = context.createOscillator();
          voice.gain = context.createGain();
          voice.oscillator.type = type;
          voice.oscillator.frequency.setValueAtTime(frequency, start);
          voice.gain.gain.setValueAtTime(0, start);
          voice.gain.gain.linearRampToValueAtTime(volume * volumeLevel, start + 0.004);
          voice.gain.gain.exponentialRampToValueAtTime(0.0001, end - 0.003);
          voice.gain.gain.linearRampToValueAtTime(0, end);
          voice.oscillator.connect(voice.gain);
          voice.gain.connect(context.destination);
          voice.oscillator.onended = () => releaseVoice(voice, false, end);
          voice.oscillator.start(start);
          voice.oscillator.stop(end);
        }
        if (spacing) {
          lastInteractionAt = now;
          lastPlayed[kind] = now;
        }
        return true;
      } catch (_) {
        const now = timeNow();
        for (const voice of addedVoices) releaseVoice(voice, true, now);
        return false;
      }
    }

    attempt(() => documentObject.addEventListener("visibilitychange", () => { if (isHidden()) stop(); }));
    attempt(() => windowObject.addEventListener("pagehide", stop));

    return { getVolume: () => volumeLevel, setVolume, isEnabled: () => enabled, setEnabled, unlock, play, stop };
  }

  const api = { createSoundEffects, SOUND_STORAGE_KEY, VOLUME_STORAGE_KEY };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.IronarabeSound = api;
}(typeof globalThis === "object" ? globalThis : this));
