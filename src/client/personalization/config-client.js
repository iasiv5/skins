/**
 * Config client — the browser-side state machine for personalization
 * (design §7.1, explicit-save model per ADR-0001). Four states:
 *
 *   loading               initial fetch in flight (writes forbidden)
 *   synced                snapshot in hand; 保存 (flushNow) allowed
 *   offline-failed        fetch failed/timed out; retry offered; writes forbidden
 *   unsupported-readonly  Host runs a newer configVersion; view-only
 *
 * ADR-0003 (v2.5) — write-through auto-save: edits live in the preview
 * layer, project locally in real time, and persist automatically via a
 * 400ms debounce (one PATCH per quiet window). No save action exists.
 * Guards (all covered by tests):
 *   - fetch arrives after the user already switched skins → applied anyway
 *     (config is orthogonal to skin selection), but late responses after
 *     dispose() are dropped via the sequence counter;
 *   - dirty preview fields are never overwritten by a late fetch (R3);
 *   - writes are serialized in order; a stale write response cannot roll a
 *     newer local state back (sequence checked before applying results);
 *   - a revision-conflict 409 refetches the fresh snapshot (previews stay
 *     dirty) so the next 保存 retries on the new baseRevision; a
 *     STORE_READONLY 409 downgrades to read-only with no refetch;
 *   - writes emit `dsh-skins:config-changed` + a BroadcastChannel ping so
 *     other tabs refetch; window focus refetch is the fallback path;
 *   - a revision conflict auto-refetches and retries once; only a conflict
 *     that survives the retry (or a non-409 failure) lands in
 *     lastFlushError for the panel's warning strip;
 *   - every applied snapshot emits to local subscribers — including
 *     same-status refetches, whose silent swaps previously starved the UI.
 */

const CHANNEL = "dsh-skins";
const FETCH_TIMEOUT_MS = 3000;

function cloneSkins(skins) {
  return skins === undefined || skins === null ? {} : structuredClone(skins);
}

export function createConfigClient(options = {}) {
  const fetchImpl = options.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  const baseUrl = options.baseUrl ?? "/dsh-skins";
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;

  if (typeof fetchImpl !== "function") throw new Error("config client requires a fetch implementation");

  let status = "loading";
  let snapshot = { skins: {}, library: [], references: {}, revision: 0, mode: "normal" };
  const previews = new Map(); // `${skinId} ${key}` → value (dirty, unsaved)
  const listeners = new Set();
  let fetchGeneration = 0;
  let disposed = false;
  let writeChain = Promise.resolve();
  let lastFlushError = null; // surfaced via publicState; cleared by the next edit or successful flush
  let channel = null;

  // -- plumbing --------------------------------------------------------------

  function emit() {
    for (const listener of [...listeners]) {
      try { listener(publicState()); } catch {}
    }
  }

  function publicState() {
    return {
      status,
      revision: snapshot.revision,
      mode: snapshot.mode,
      skins: cloneSkins(snapshot.skins),
      library: snapshot.library,
      references: snapshot.references ?? {},
      recovery: snapshot.recovery,
      quota: snapshot.quota,
      lastFlushError,
      dirtyCount: previews.size,
    };
  }

  async function request(path, init = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      signal: init.signal ?? (typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined),
    });
    return response;
  }

  function setStatus(next) {
    if (status === next) return;
    status = next;
    emit();
  }

  // -- reads -----------------------------------------------------------------

  async function refetch() {
    if (disposed) return publicState();
    // Stale-response guards (design §7.1): only the newest fetch may land,
    // and a response arriving after a skin switch is dropped.
    const generation = ++fetchGeneration;
    const contextAtStart = options.contextActive?.();
    try {
      const response = await request("/config");
      if (disposed || generation !== fetchGeneration) return publicState();
      if (contextAtStart !== undefined && options.contextActive?.() !== contextAtStart) {
        void refetch(); // the world moved on — drop the stale snapshot and pull for the new one
        return publicState();
      }
      if (response.status === 404 || response.status === 501) {
        // Host older than the client (no personalization routes yet).
        setStatus("offline-failed");
        return publicState();
      }
      if (!response.ok) {
        setStatus("offline-failed");
        return publicState();
      }
      const body = await response.json();
      if (disposed || generation !== fetchGeneration) return publicState();
      if (contextAtStart !== undefined && options.contextActive?.() !== contextAtStart) {
        void refetch(); // pull a snapshot for the context that replaced this one
        return publicState();
      }
      if (body?.mode === "unsupported") {
        snapshot = { ...body, references: {} };
        setStatus("unsupported-readonly");
        emit(); // same-status swaps must still notify (field report: stale library grid)
        return publicState();
      }
      if (body?.mode === "recovery") {
        snapshot = { ...body };
        setStatus("synced"); // read-only until confirmed; panel offers recovery
        emit();
        return publicState();
      }
      snapshot = { ...body };
      setStatus("synced");
      // setStatus only emits on a status TRANSITION — an already-synced
      // refetch would otherwise swap the snapshot silently and starve every
      // subscriber (field report: deleted image kept showing in the grid).
      emit();
      return publicState();
    } catch {
      if (!disposed) setStatus("offline-failed");
      return publicState();
    }
  }

  // -- writes (serialized; gated by state machine) ---------------------------
  // ADR-0003 (v2.5): write-through auto-save. preview/previewReset arm a
  // 400ms debounce; the flush merges the window's edits into one PATCH and
  // retries a revision conflict once on the fresh baseRevision — no user
  // action anywhere. The client is a session-global singleton, so an
  // in-flight debounce completes regardless of the shell's lifecycle.

  const FLUSH_DEBOUNCE_MS = 400;
  let flushTimer = null;

  function gateWrites() {
    if (status === "synced") return null;
    if (status === "loading") return "loading";
    if (status === "unsupported-readonly") return "unsupported";
    return "offline";
  }

  function scheduleFlush() {
    if (flushTimer !== null) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushNow();
    }, FLUSH_DEBOUNCE_MS);
  }

  function flushNow() {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (previews.size === 0) return Promise.resolve({ flushed: 0 });
    // Snapshot the dirty layer; previews captured here are the flush intent.
    const intent = [...previews.entries()];
    const buildOperations = () => intent.map(([composite, value]) => {
      const [skinId, key] = composite.split(" ");
      return value === null ? { op: "delete", skinId, key } : { op: "set", skinId, key, value };
    });
    const count = buildOperations().length;
    writeChain = writeChain.then(async () => {
      try {
        if (disposed) return { flushed: 0, blocked: "disposed" };
        const blocked = gateWrites();
        if (blocked !== null) return { flushed: 0, blocked };
        // ADR-0003: a revision conflict auto-resolves — refetch the fresh
        // snapshot and retry once on the new baseRevision. Only a conflict
        // that survives the retry surfaces to the user.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const response = await request("/config", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ baseRevision: snapshot.revision, operations: buildOperations() }),
          });
          if (disposed) return { flushed: 0 };
          if (response.status === 409) {
            const conflictBody = await response.json().catch(() => null);
            if (conflictBody?.code === "STORE_READONLY") {
              setStatus("unsupported-readonly");
              return { flushed: 0, blocked: "conflict", errorMessage: conflictBody.error ?? "" };
            }
            await refetch(); // fresh baseRevision; previews stay dirty
            continue;
          }
          if (!response.ok) {
            // Keep the previews dirty so a later edit can retry — and NAME
            // the failure: a silent 400 reads as "did it save?" (field
            // report: the stale-host BAD_SHAPE stayed invisible for days).
            const errorBody = await response.json().catch(() => null);
            const errorMessage = errorBody?.error ?? `HTTP ${response.status}`;
            lastFlushError = errorMessage;
            emit();
            return { flushed: 0, blocked: "error", errorMessage };
          }
          await response.json().catch(() => null); // drained; resync happens in refetch()
          // Clear only previews the user has not superseded during the flight.
          for (const [composite, value] of intent) {
            if (previews.get(composite) === value) previews.delete(composite);
          }
          lastFlushError = null;
          // Resync from the Host rather than trusting a racing local snapshot:
          // a refetch issued mid-flight may otherwise resurrect pre-write state.
          await refetch();
          announce();
          return { flushed: count };
        }
        return { flushed: 0, blocked: "conflict" };
      } catch {
        // The chain itself must stay fulfilled: one network failure may
        // never poison subsequent flushes (previews stay dirty for retry).
        return { flushed: 0, blocked: "error" };
      }
    });
    return writeChain;
  }

  function announce() {
    try {
      if (typeof window !== "undefined" && typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("dsh-skins:config-changed"));
      }
    } catch {}
    try {
      if (channel === null && typeof BroadcastChannel === "function") channel = new BroadcastChannel(CHANNEL);
      channel?.postMessage({ kind: "config-changed" });
    } catch {}
  }

  // -- public API ------------------------------------------------------------

  /** Record an unsaved edit: projects locally, persists nothing (ADR-0001). */
  function preview(skinId, key, value) {
    previews.set(`${skinId} ${key}`, value);
    lastFlushError = null; // a fresh edit always clears the failure strip
    scheduleFlush();
    emit();
  }

  /** Record an unsaved reset-to-default (a delete op) for the field. */
  function previewReset(skinId, key) {
    previews.set(`${skinId} ${key}`, null);
    lastFlushError = null;
    scheduleFlush();
    emit();
  }

  function effectiveOverrides(skinId) {
    const merged = cloneSkins(snapshot.skins[skinId] ?? {});
    for (const [composite, value] of previews) {
      const [owner, key] = composite.split(" ");
      if (owner !== skinId) continue;
      if (value === null) delete merged[key];
      else merged[key] = value;
    }
    return merged;
  }

  function retry() {
    if (status !== "offline-failed" && status !== "synced") return refetch();
    return refetch();
  }

  // -- asset operations (library management for the panel) -------------------

  async function uploadImage(file, displayName) {
    const blocked = gateWrites();
    if (blocked !== null) return { error: blocked };
    const bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
    const response = await request("/library", {
      method: "POST",
      headers: {
        "content-type": typeof file?.type === "string" && file.type !== "" ? file.type : "application/octet-stream",
        "x-filename": encodeURIComponent(displayName ?? file?.name ?? "wallpaper"),
      },
      body: bytes,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.code ?? `HTTP ${response.status}` };
    }
    const body = await response.json();
    await refetch();
    announce();
    return { asset: body.asset };
  }

  async function deleteImage(id) {
    const blocked = gateWrites();
    if (blocked !== null) return { error: blocked };
    const response = await request(`/library/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.code ?? `HTTP ${response.status}` };
    }
    const body = await response.json();
    await refetch();
    announce();
    return { affectedSkins: body.affectedSkins ?? [], revision: body.revision };
  }

  async function confirmRecovery() {
    const response = await request("/recovery", { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.code ?? `HTTP ${response.status}` };
    }
    await refetch();
    return { ok: true };
  }

  function assetUrl(meta) {
    if (meta === null || meta === undefined || typeof meta.id !== "string") return null;
    return `${baseUrl}/assets/${meta.id}.${meta.extension}`;
  }

  const api = {
    boot: refetch,
    refetch,
    retry,
    flushNow,
    preview,
    previewReset,
    effectiveOverrides,
    uploadImage,
    deleteImage,
    confirmRecovery,
    assetUrl,
    getState: publicState,
    writeBlocked: gateWrites,
    onStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      if (flushTimer !== null) clearTimeout(flushTimer);
      fetchGeneration += 1; // invalidate any in-flight response
      try { channel?.close(); } catch {}
      try {
        if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
      } catch {}
      listeners.clear();
    },
  };

  // Cross-tab sync: BroadcastChannel pings + focus refetch fallback.
  function onCrossTabMessage(event) {
    if (event?.data?.kind === "config-changed") refetch();
  }
  function onFocus() {
    refetch();
  }
  try {
    if (typeof BroadcastChannel === "function") {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = onCrossTabMessage;
      // Node keeps the event loop alive for open BroadcastChannels; release
      // that hold so test harnesses and SSR-ish environments can exit.
      if (typeof channel.unref === "function") channel.unref();
    }
  } catch {}
  try {
    if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
  } catch {}

  return api;
}
