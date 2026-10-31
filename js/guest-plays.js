(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.IronarabeGuests = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';

  const GUEST_PENDING_PREFIX = 'ironarabe.guestPlay.v1.';
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const VERSION_PATTERN = /^ironarabe-web-1\.4\.1-stagepack001-v2-(sunset|aurora|ocean|leaf|amber|wisteria|coral|nebula|breeze|autumn)-r[0-3]$/;

  function attempt(operation) {
    try { return operation(); }
    catch (_) { return undefined; }
  }

  function validUUID(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value);
  }

  function normalizeVersion(value) {
    if (typeof value !== 'string') return null;
    const version = value.trim();
    return version.length <= 80 && VERSION_PATTERN.test(version) ? version : null;
  }

  function cryptographicUUID() {
    const crypto = attempt(() => root.crypto);
    const native = attempt(() => crypto.randomUUID());
    if (validUUID(native)) return native;
    return attempt(() => {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    });
  }

  function validAcknowledgement(response, row) {
    return response !== null && typeof response === 'object' && !Array.isArray(response)
      && response.accepted === true && response.start_id === row.startId
      && response.game_slug === 'ironarabe' && validUUID(response.play_id)
      && response.client_version === row.clientVersion;
  }

  function createGuestPlayCounter({ storage, send, randomUUID, onChange } = {}) {
    if (storage === undefined) storage = attempt(() => root.localStorage);
    if (randomUUID === undefined) randomUUID = cryptographicUUID;
    const pending = [];
    const seen = new Set();
    let inFlight = null;
    let followUpRequested = false;

    function mergeStored() {
      const keys = attempt(() => {
        const length = storage.length;
        if (!Number.isSafeInteger(length) || length < 0) return [];
        return Array.from({ length }, (_, index) => storage.key(index));
      }) || [];
      let added = false;
      for (const key of keys) {
        if (typeof key !== 'string' || !key.startsWith(GUEST_PENDING_PREFIX)) continue;
        const startId = key.slice(GUEST_PENDING_PREFIX.length);
        if (!validUUID(startId) || seen.has(startId.toLowerCase())) continue;
        const saved = attempt(() => JSON.parse(storage.getItem(key)));
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)
          || Object.keys(saved).length !== 2 || saved.startId !== startId) continue;
        const clientVersion = normalizeVersion(saved.clientVersion);
        if (clientVersion === null) continue;
        pending.push({ startId, clientVersion });
        seen.add(startId.toLowerCase());
        added = true;
      }
      return added;
    }

    function notify(row, status) {
      if (row.status === status) return;
      row.status = status;
      attempt(() => { if (onChange) onChange(row.startId, status); });
    }

    function retry({ recover = false } = {}) {
      const merged = mergeStored();
      if (inFlight) {
        if (merged || recover) followUpRequested = true;
        return inFlight;
      }
      if (!pending.length) return Promise.resolve();
      followUpRequested = false;
      inFlight = Promise.resolve().then(async () => {
        let followedUp = false;
        try {
          while (pending.length) {
            const row = pending[0];
            notify(row, 'pending');
            try {
              const response = await send({ p_start_id: row.startId, p_game_slug: 'ironarabe', p_client_version: row.clientVersion });
              if (!validAcknowledgement(response, row)) throw new Error('Invalid guest start acknowledgement');
            } catch (_) {
              notify(row, 'failed');
              // A newly queued game can request one follow-up, never an offline loop.
              if (!followedUp && followUpRequested) {
                followedUp = true;
                followUpRequested = false;
                continue;
              }
              // Every queued game is waiting on this failed drain, including the
              // current replay whose own RPC has not started yet.
              for (const waiting of pending) notify(waiting, 'failed');
              return;
            }
            pending.shift();
            attempt(() => storage.removeItem(GUEST_PENDING_PREFIX + row.startId));
            notify(row, 'success');
          }
        } finally {
          inFlight = null;
          followUpRequested = false;
        }
      });
      return inFlight;
    }

    function record(clientVersion) {
      clientVersion = normalizeVersion(clientVersion);
      if (clientVersion === null) return null;
      mergeStored();
      const generated = attempt(() => randomUUID());
      if (!validUUID(generated)) return null;
      const startId = generated.toLowerCase();
      if (seen.has(startId)) return null;
      const row = { startId, clientVersion };
      pending.push(row);
      seen.add(startId);
      attempt(() => storage.setItem(GUEST_PENDING_PREFIX + row.startId, JSON.stringify(row)));
      if (inFlight) followUpRequested = true;
      notify(row, 'pending');
      void retry();
      return row.startId;
    }

    return { record, retry };
  }

  return { createGuestPlayCounter, GUEST_PENDING_PREFIX };
});
