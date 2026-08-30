import assert from "node:assert/strict";
import test from "node:test";
import { createConfigClient } from "../src/client/personalization/config-client.js";

/** Minimal Response stand-in (Node 22 has Response, but keep it explicit). */
function jsonResponse(status, value) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return value; },
    async arrayBuffer() { return new ArrayBuffer(0); },
  };
}

function snapshotBody(overrides = {}) {
  return jsonResponse(200, {
    configVersion: 1,
    revision: 7,
    mode: "normal",
    skins: {},
    library: [],
    references: {},
    quota: { count: 0, totalBytes: 0 },
    ...overrides,
  });
}

function makeFetch(handler) {
  const calls = [];
  const impl = (url, init = {}) => {
    calls.push({ url: String(url), init });
    return handler(calls.length, String(url), init);
  };
  impl.calls = calls;
  return impl;
}

function flushingClient(fetchImpl) {
  const client = createConfigClient({ fetchImpl, debounceMs: 1, timeoutMs: 50 });
  // No timers in some environments; flush synchronously in tests.
  return client;
}

test("boot transitions loading → synced and exposes the snapshot", async () => {
  const fetchImpl = makeFetch(() => snapshotBody({ skins: { tgcf: { blur: 5 } } }));
  const client = flushingClient(fetchImpl);
  assert.equal(client.getState().status, "loading");
  await client.boot();
  assert.equal(client.getState().status, "synced");
  assert.equal(client.getState().revision, 7);
  assert.deepEqual(client.getState().skins.tgcf, { blur: 5 });
  assert.equal(client.writeBlocked(), null);
  client.dispose();
});

test("failed boot lands in offline-failed and writes are gated", async () => {
  const fetchImpl = makeFetch(() => { throw new Error("network down"); });
  const client = flushingClient(fetchImpl);
  await client.boot();
  assert.equal(client.getState().status, "offline-failed");
  assert.equal(client.writeBlocked(), "offline");
  client.preview("tgcf", "blur", 3);
  const result = await client.flushNow();
  assert.deepEqual(result, { flushed: 0, blocked: "offline" });
  assert.equal(fetchImpl.calls.length, 1, "no PATCH was attempted while offline");
  client.dispose();
});

test("unsupported configVersion becomes read-only", async () => {
  const fetchImpl = makeFetch(() => snapshotBody({ mode: "unsupported" }));
  const client = flushingClient(fetchImpl);
  await client.boot();
  assert.equal(client.getState().status, "unsupported-readonly");
  assert.equal(client.writeBlocked(), "unsupported");
  client.dispose();
});

test("previews gate writes until flushed; effective overrides layer previews over the snapshot", async () => {
  const patches = [];
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") {
      patches.push(JSON.parse(init.body));
      return jsonResponse(200, { revision: 8 });
    }
    return snapshotBody({ skins: { tgcf: { blur: 5, panelOpacity: 70 } } });
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.preview("tgcf", "blur", 9);
  assert.equal(client.getState().dirtyCount, 1);
  // Preview layers over the synced snapshot without touching it.
  assert.deepEqual(client.effectiveOverrides("tgcf"), { blur: 9, panelOpacity: 70 });
  // Pending gate: status is synced so writes are allowed — flush explicitly.
  const result = await client.flushNow();
  assert.deepEqual(result, { flushed: 1 });
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0].operations, [{ op: "set", skinId: "tgcf", key: "blur", value: 9 }]);
  client.dispose();
});

test("a preview edited again mid-flight survives the flush of the older value", async () => {
  let releasePatch;
  const gate = new Promise((resolve) => { releasePatch = resolve; });
  const patches = [];
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") {
      patches.push(JSON.parse(init.body));
      if (patches.length === 1) return gate.then(() => jsonResponse(200, { revision: 8 }));
      return jsonResponse(200, { revision: 9 });
    }
    return snapshotBody({ revision: patches.length === 0 ? 7 : 8 });
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.preview("tgcf", "blur", 5);
  const flushing = client.flushNow();
  // The user keeps dragging the slider while the first value is in flight.
  client.preview("tgcf", "blur", 12);
  releasePatch();
  await flushing;
  assert.equal(client.getState().dirtyCount, 1, "newer preview survives");
  assert.deepEqual(client.effectiveOverrides("tgcf"), { blur: 12 });
  await client.flushNow();
  assert.deepEqual(patches[1].operations, [{ op: "set", skinId: "tgcf", key: "blur", value: 12 }]);
  client.dispose();
});

test("previewReset schedules a delete op; failed writes keep previews dirty for retry", async () => {
  let fail = false;
  const patches = [];
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") {
      patches.push(JSON.parse(init.body));
      if (fail) return jsonResponse(500, { error: "boom" });
      return jsonResponse(200, { revision: 8 });
    }
    return snapshotBody({ skins: { tgcf: { blur: 5 } } });
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.previewReset("tgcf", "blur");
  fail = true;
  assert.deepEqual(await client.flushNow(), { flushed: 0, blocked: "error" });
  assert.equal(client.getState().dirtyCount, 1, "preview kept dirty after failure");
  assert.deepEqual(client.effectiveOverrides("tgcf"), {}, "reset preview removes the override");

  fail = false;
  assert.deepEqual(await client.flushNow(), { flushed: 1 });
  assert.deepEqual(patches[0].operations, [{ op: "delete", skinId: "tgcf", key: "blur" }]);
  client.dispose();
});

test("late responses after dispose are dropped", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const fetchImpl = makeFetch(() => gate.then(() => snapshotBody()));
  const client = flushingClient(fetchImpl);
  const booting = client.boot();
  client.dispose();
  release();
  await booting;
  assert.equal(client.getState().status, "loading");
});

test("409 STORE_READONLY downgrades the client to read-only", async () => {
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") return jsonResponse(409, { code: "STORE_READONLY", error: "readonly" });
    return snapshotBody();
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.preview("tgcf", "blur", 3);
  assert.deepEqual(await client.flushNow(), { flushed: 0, blocked: "conflict" });
  assert.equal(client.getState().status, "unsupported-readonly");
  assert.equal(client.getState().dirtyCount, 1, "dirty state retained for the UI");
  client.dispose();
});

test("recovery snapshots surface mode and recovery metadata while staying synced", async () => {
  const fetchImpl = makeFetch(() => snapshotBody({
    mode: "recovery",
    skins: {},
    library: [],
    recovery: { configLost: true, quarantine: ["stray.png"], candidateLibrary: {} },
  }));
  const client = flushingClient(fetchImpl);
  await client.boot();
  const state = client.getState();
  assert.equal(state.status, "synced");
  assert.equal(state.mode, "recovery");
  assert.equal(state.recovery.configLost, true);
  client.dispose();
});

test("a stale GET response cannot roll back a newer snapshot", async () => {
  let releaseFirst;
  const gate = new Promise((resolve) => { releaseFirst = resolve; });
  let requestIndex = 0;
  const fetchImpl = makeFetch(() => {
    requestIndex += 1;
    if (requestIndex === 1) return gate.then(() => snapshotBody({ revision: 1 }));
    return snapshotBody({ revision: 2 });
  });
  const client = flushingClient(fetchImpl);
  const first = client.boot();       // will resolve LATE with revision 1
  await client.refetch();            // resolves first with revision 2
  assert.equal(client.getState().revision, 2);
  releaseFirst();
  await first;                       // stale response arrives now — dropped
  assert.equal(client.getState().revision, 2, "stale snapshot must not win");
  client.dispose();
});

test("a context switch (skin change) drops the in-flight snapshot", async () => {
  let active = "openbmc";
  const fetchImpl = makeFetch(() => snapshotBody({ revision: 9 }));
  const contextClient = createConfigClient({
    fetchImpl,
    debounceMs: 1,
    timeoutMs: 50,
    contextActive: () => active,
  });
  const booting = contextClient.boot();
  active = "tgcf"; // user switched skins while the fetch was in flight
  await booting;
  assert.equal(contextClient.getState().revision, 0, "response after a context switch is dropped");
  await contextClient.refetch(); // stable context applies
  assert.equal(contextClient.getState().revision, 9);
  contextClient.dispose();
});

test("HTTP 500 responses land in offline-failed, never synced", async () => {
  const fetchImpl = makeFetch(() => jsonResponse(500, { error: "boom" }));
  const client = flushingClient(fetchImpl);
  await client.boot();
  assert.equal(client.getState().status, "offline-failed");
  assert.equal(client.writeBlocked(), "offline");
  client.dispose();
});

test("a rejected PATCH never poisons the write chain — the next flush retries", async () => {
  let failNetwork = true;
  const patches = [];
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") {
      patches.push(init.body);
      if (failNetwork) return Promise.reject(new Error("network down"));
      return jsonResponse(200, { revision: 8 });
    }
    return snapshotBody();
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.preview("tgcf", "blur", 4);
  assert.deepEqual(await client.flushNow(), { flushed: 0, blocked: "error" });
  client.preview("tgcf", "blur", 6);
  failNetwork = false;
  assert.deepEqual(await client.flushNow(), { flushed: 1 });
  assert.equal(patches.length, 2, "the retry actually reached the wire");
  client.dispose();
});

test("queued writes are skipped after dispose (no post-dispose PATCH)", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const patches = [];
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") {
      patches.push(init.body);
      return gate.then(() => jsonResponse(200, { revision: 8 }));
    }
    return snapshotBody();
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.preview("tgcf", "blur", 4);
  const flushing = client.flushNow();
  client.dispose(); // the queued task must observe this before sending
  release();
  await flushing;
  assert.equal(patches.length, 0, "disposed client must not send writes");
});
