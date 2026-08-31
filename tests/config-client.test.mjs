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
  // Explicit-save model: no debounce timer exists; save === flushNow().
  return createConfigClient({ fetchImpl, timeoutMs: 50 });
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

test("a same-status refetch still notifies subscribers (field report: stale library grid)", async () => {
  const libraries = [
    [{ id: "u_a", displayName: "a.png", extension: "png" }],
    [
      { id: "u_a", displayName: "a.png", extension: "png" },
      { id: "u_b", displayName: "b.png", extension: "png" },
    ],
  ];
  const fetchImpl = makeFetch((n) => snapshotBody({ revision: 6 + n, library: libraries[n - 1] }));
  const client = flushingClient(fetchImpl);
  const seen = [];
  client.onStateChange((state) => seen.push({ revision: state.revision, count: state.library.length }));
  await client.boot();
  assert.deepEqual(seen.at(-1), { revision: 7, count: 1 }, "boot lands the first snapshot");
  const emissionsAfterBoot = seen.length;
  await client.refetch();
  assert.equal(client.getState().status, "synced", "precondition: the status never changed");
  assert.equal(seen.length, emissionsAfterBoot + 1, "exactly one notification for the same-status swap");
  assert.deepEqual(seen.at(-1), { revision: 8, count: 2 });
  client.dispose();
});

test("deleteImage: subscribers see the shrunken library after a successful DELETE", async () => {
  const remaining = [{ id: "u_a", displayName: "a.png", extension: "png" }];
  const deleted = { id: "u_b", displayName: "b.png", extension: "png" };
  const fetchImpl = makeFetch((n, url) => {
    if (n === 1) return snapshotBody({ library: [remaining[0], deleted] });
    if (url.includes("/library/u_b")) return jsonResponse(200, { affectedSkins: [], revision: 8 });
    return snapshotBody({ revision: 8, library: remaining });
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  const seen = [];
  client.onStateChange((state) => seen.push(state.library.map((a) => a.id)));
  const result = await client.deleteImage("u_b");
  assert.equal(result.error, undefined, "DELETE succeeded");
  assert.deepEqual(client.getState().library.map((a) => a.id), ["u_a"], "snapshot lost the asset");
  assert.ok(seen.some((ids) => !ids.includes("u_b")), "subscribers were told — the grid must follow");
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
  assert.deepEqual(await client.flushNow(), { flushed: 0, blocked: "error", errorMessage: "boom" });
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

test("409 STORE_READONLY downgrades the client to read-only WITHOUT a refetch", async () => {
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") return jsonResponse(409, { code: "STORE_READONLY", error: "readonly" });
    return snapshotBody();
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  const callsAfterBoot = fetchImpl.calls.length;
  client.preview("tgcf", "blur", 3);
  assert.deepEqual(await client.flushNow(), { flushed: 0, blocked: "conflict", errorMessage: "readonly" });
  assert.equal(client.getState().status, "unsupported-readonly");
  assert.equal(client.getState().dirtyCount, 1, "dirty state retained for the UI");
  assert.equal(fetchImpl.calls.length, callsAfterBoot + 1, "readonly downgrade performs no extra GET");
  client.dispose();
});

test("409 revision conflict auto-refetches and retries once (ADR-0003)", async () => {
  const patches = [];
  let revision = 7;
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") {
      patches.push(JSON.parse(init.body));
      if (patches.length === 1) return jsonResponse(409, { code: "IMPORT_CONFLICT", error: "stale" });
      return jsonResponse(200, { revision: 9 });
    }
    // Every GET after the conflict reports the moved-forward revision.
    if (fetchImpl.calls.filter((call) => call.init.method !== "PATCH").length > 1) revision = 8;
    return snapshotBody({ revision });
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.preview("tgcf", "blur", 3);
  const result = await client.flushNow();
  assert.deepEqual(result, { flushed: 1 }, "the conflict auto-retry lands the preview");
  assert.equal(patches.length, 2, "exactly one automatic retry — no user action");
  assert.equal(patches[0].baseRevision, 7, "first attempt rode the stale revision");
  assert.equal(patches[1].baseRevision, 8, "retry rides the fresh baseRevision");
  assert.equal(client.getState().dirtyCount, 0);
  client.dispose();
});

test("auto-save: the debounce window merges into ONE PATCH (ADR-0003)", async () => {
  const fetchImpl = makeFetch(() => snapshotBody());
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.preview("tgcf", "blur", 3);
  client.preview("tgcf", "scrim", 40);
  client.previewReset("tgcf", "slogan");
  assert.equal(client.getState().dirtyCount, 3);
  await new Promise((resolve) => setTimeout(resolve, 520)); // > 400ms debounce
  const patchCalls = fetchImpl.calls.filter((c) => c.init.method === "PATCH");
  assert.equal(patchCalls.length, 1, "the whole quiet window merges into one PATCH");
  const patchBody = JSON.parse(patchCalls[0].init.body);
  assert.deepEqual(patchBody.operations.map((o) => o.key), ["blur", "scrim", "slogan"]);
  assert.equal(client.getState().dirtyCount, 0, "auto-save cleared the preview layer");
  client.dispose();
});

test("lastFlushError: a failed auto-save surfaces, the next edit clears it (ADR-0003)", async () => {
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") return jsonResponse(400, { error: "tgcf.blur 校验失败（BAD_VALUE）" });
    return snapshotBody();
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.preview("tgcf", "blur", 9);
  await new Promise((resolve) => setTimeout(resolve, 520));
  assert.equal(client.getState().lastFlushError, "tgcf.blur 校验失败（BAD_VALUE）", "failure surfaced for the panel strip");
  client.preview("tgcf", "blur", 10); // a fresh edit always clears the strip
  assert.equal(client.getState().lastFlushError, null);
  client.dispose();
});

test("restore is gone from the client API (ADR-0003)", () => {
  const client = flushingClient(makeFetch(() => snapshotBody()));
  assert.equal("restore" in client, false, "no revert concept in the auto-save model");
  client.dispose();
});

test("theme package methods no longer exist on the client", () => {
  const client = flushingClient(makeFetch(() => snapshotBody()));
  assert.equal(typeof client.exportTheme, "undefined");
  assert.equal(typeof client.prepareThemeImport, "undefined");
  assert.equal(typeof client.commitThemeImport, "undefined");
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

test("a non-ok PATCH carries the server error message to the caller (field report)", async () => {
  const fetchImpl = makeFetch((index, url, init) => {
    if (init.method === "PATCH") return jsonResponse(400, { error: "tgcf.scrim 校验失败（BAD_SHAPE）", code: "INVALID_CONFIG" });
    return snapshotBody();
  });
  const client = flushingClient(fetchImpl);
  await client.boot();
  client.preview("tgcf", "scrim", 0);
  const result = await client.flushNow();
  assert.equal(result.blocked, "error");
  assert.equal(result.errorMessage, "tgcf.scrim 校验失败（BAD_SHAPE）");
  assert.equal(client.getState().dirtyCount, 1, "previews stay dirty for retry");
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
