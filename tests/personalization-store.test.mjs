import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  existsSync as fExists, mkdirSync as fMkdir, readFileSync as fRead, writeFileSync as fWrite,
  renameSync as fRename, unlinkSync as fUnlink, readdirSync as fReaddir, rmdirSync as fRmdir,
  statSync as fStat, statfsSync as fStatfs, copyFileSync as fCopy,
  openSync as fOpen, closeSync as fClose,
} from "node:fs";
import { createPersonalizationStore } from "../src/host/personalization/store.js";

const REAL_FS = {
  existsSync: fExists, mkdirSync: fMkdir, readFileSync: fRead, writeFileSync: fWrite,
  renameSync: fRename, unlinkSync: fUnlink, readdirSync: fReaddir, rmdirSync: fRmdir,
  statSync: fStat, statfsSync: fStatfs, copyFileSync: fCopy,
  openSync: fOpen, closeSync: fClose,
};

const NOW = 1_700_000_000_000;
const USER_ID_SHAPE = /^u_[0-9a-f]{32}$/;

function tempDir() {
  return mkdtempSync(join(tmpdir(), "dsh-skins-store-"));
}

function makeStore(dir, fsOverrides = {}) {
  return createPersonalizationStore({
    dataDir: dir,
    now: () => NOW,
    fs: { ...REAL_FS, ...fsOverrides },
  });
}

function pngBytes(width = 10, height = 10, padding = 0) {
  const header = Buffer.alloc(24);
  header.write("\x89PNG\r\n\x1a\n", 0, "latin1");
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "latin1");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return Buffer.concat([header, Buffer.alloc(padding)]);
}

function gifBytes(width, height) {
  const b = Buffer.alloc(10);
  b.write("GIF89a", 0, "latin1");
  b.writeUInt16LE(width, 6);
  b.writeUInt16LE(height, 8);
  return b;
}

function webpAnimated() {
  const b = Buffer.alloc(34);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(22, 4);
  b.write("WEBP", 8, "latin1");
  b.write("VP8X", 12, "latin1");
  b.writeUInt32LE(10, 16);
  b[20] = 0x12; // animation flag
  return b;
}

function setOverride(store, skinId, key, value) {
  return store.applyOperations({ operations: [{ op: "set", skinId, key, value }] });
}

test("first install on an empty directory creates initial state", async () => {
  const store = makeStore(tempDir());
  const snapshot = store.snapshot();
  assert.equal(snapshot.mode, "normal");
  assert.equal(snapshot.revision, 0);
  assert.deepEqual(snapshot.skins, {});
  assert.deepEqual(snapshot.library, []);
});

test("upload stores a sniffed asset and bumps the revision", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset, revision } = await store.uploadAsset(pngBytes(1920, 1080), {
    displayName: "灯笼.png",
    declaredMime: "image/png",
  });
  assert.match(asset.id, USER_ID_SHAPE);
  assert.equal(asset.mime, "image/png");
  assert.equal(asset.width, 1920);
  assert.equal(asset.displayName, "灯笼.png");
  assert.equal(revision, 1);
  assert.ok(existsSync(join(dir, "assets", `${asset.id}.png`)));
  const snapshot = store.snapshot();
  assert.equal(snapshot.library.length, 1);
  assert.equal(snapshot.quota.totalBytes, asset.byteLength);
});

test("upload rejects unrecognized bytes, animated WebP, mime mismatches and bad names", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(store.uploadAsset(Buffer.from("not an image"), { displayName: "x" }), (e) => e.code === "UNSUPPORTED_IMAGE");
  await assert.rejects(store.uploadAsset(webpAnimated(), { displayName: "x" }), (e) => e.code === "ANIMATION_UNSUPPORTED");
  await assert.rejects(
    store.uploadAsset(pngBytes(), { displayName: "x", declaredMime: "image/jpeg" }),
    (e) => e.code === "UNSUPPORTED_IMAGE",
  );
  await assert.rejects(store.uploadAsset(pngBytes(), { displayName: "" }), (e) => e.code === "FILENAME_INVALID");
  await assert.rejects(store.uploadAsset(pngBytes(), { displayName: null }), (e) => e.code === "FILENAME_INVALID");
  assert.equal(store.snapshot().revision, 0);
});

test("upload enforces global byte and per-format pixel caps", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    store.uploadAsset(pngBytes(10, 10, 21 * 1024 * 1024), { displayName: "big" }),
    (e) => e.code === "UPLOAD_TOO_LARGE",
  );
  await assert.rejects(
    store.uploadAsset(gifBytes(5000, 3000), { displayName: "gif" }), // 15MP > 12MP GIF cap
    (e) => e.code === "UPLOAD_TOO_LARGE",
  );
  await assert.rejects(
    store.uploadAsset(pngBytes(5001, 8000), { displayName: "png" }), // > 40MP
    (e) => e.code === "UPLOAD_TOO_LARGE",
  );
  // Exactly at the caps passes.
  const okGif = await store.uploadAsset(gifBytes(4000, 3000), { displayName: "gif" }); // 12MP
  assert.equal(okGif.asset.mime, "image/gif");
  const okPng = await store.uploadAsset(pngBytes(5000, 8000), { displayName: "png" }); // 40MP
  assert.equal(okPng.asset.width, 5000);
});

test("field operations set, delete and bump the revision atomically", async () => {
  const store = makeStore(tempDir());
  await setOverride(store, "tgcf", "slogan", { zh: "一", en: "One" });
  await setOverride(store, "tgcf", "panelOpacity", 55);
  let snapshot = store.snapshot();
  assert.deepEqual(snapshot.skins.tgcf.slogan, { zh: "一", en: "One" });
  assert.equal(snapshot.skins.tgcf.panelOpacity, 55);
  assert.equal(snapshot.revision, 2);

  await store.applyOperations({ operations: [{ op: "delete", skinId: "tgcf", key: "panelOpacity" }] });
  snapshot = store.snapshot();
  assert.equal(snapshot.skins.tgcf.panelOpacity, undefined);
  assert.equal(snapshot.skins.tgcf.slogan.zh, "一");
});

test("invalid operations reject the whole batch without touching state", async () => {
  const store = makeStore(tempDir());
  await setOverride(store, "tgcf", "panelOpacity", 55);
  await assert.rejects(store.applyOperations({
    operations: [
      { op: "set", skinId: "tgcf", key: "blur", value: 5 },
      { op: "set", skinId: "tgcf", key: "panelOpacity", value: 999 },
    ],
  }), (e) => e.code === "INVALID_CONFIG");
  const snapshot = store.snapshot();
  assert.equal(snapshot.skins.tgcf.blur, undefined);
  assert.equal(snapshot.skins.tgcf.panelOpacity, 55);
  assert.equal(snapshot.revision, 1);
});

test("unknown fields and unknown skins are rejected", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    store.applyOperations({ operations: [{ op: "set", skinId: "tgcf", key: "nope", value: 1 }] }),
    (e) => e.code === "INVALID_CONFIG",
  );
  await assert.rejects(
    store.applyOperations({ operations: [{ op: "set", skinId: "ghost", key: "blur", value: 1 }] }),
    (e) => e.code === "INVALID_CONFIG",
  );
});

test("unknown fields and orphan skin sections survive later commits", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await setOverride(store, "tgcf", "panelOpacity", 55);
  // Simulate a future-version field and a removed-skin section on disk.
  const statePath = join(dir, "state.json");
  const raw = JSON.parse(readFileSync(statePath, "utf8"));
  raw.skins.tgcf.futureField = { any: "shape" };
  raw.skins.removedSkin = { wallpaper: "u_0123456789abcdef0123456789abcdef" };
  writeFileSync(statePath, JSON.stringify(raw));
  // Re-open the store from disk.
  const reopened = makeStore(dir);
  await setOverride(reopened, "tgcf", "blur", 8);
  const snapshot = reopened.snapshot();
  assert.deepEqual(snapshot.skins.tgcf.futureField, { any: "shape" });
  assert.equal(snapshot.skins.removedSkin.wallpaper, "u_0123456789abcdef0123456789abcdef");
  assert.equal(snapshot.skins.tgcf.blur, 8);
});

test("image overrides validate against the live library (missing assets reject)", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    setOverride(store, "tgcf", "wallpaper", "u_0123456789abcdef0123456789abcdef"),
    (e) => e.code === "INVALID_CONFIG",
  );
  const { asset } = await store.uploadAsset(pngBytes(40, 40), { displayName: "ok" });
  await setOverride(store, "tgcf", "wallpaper", asset.id);
  assert.equal(store.snapshot().skins.tgcf.wallpaper, asset.id);
});

test("deleting a referenced asset clears overrides and reports affected skins", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  await setOverride(store, "tgcf", "wallpaper", asset.id);
  await setOverride(store, "tgcf", "slogan", { zh: "二", en: "Two" });
  const references = store.snapshot().references[asset.id];
  assert.deepEqual(references, [{ skinId: "tgcf", key: "wallpaper" }]);

  const result = await store.deleteAsset(asset.id);
  assert.deepEqual(result.affectedSkins, [{ skinId: "tgcf", key: "wallpaper" }]);
  const snapshot = store.snapshot();
  assert.equal(snapshot.skins.tgcf.wallpaper, undefined);
  assert.deepEqual(snapshot.skins.tgcf.slogan, { zh: "二", en: "Two" }); // untouched
  assert.deepEqual(snapshot.library, []);
  assert.equal(existsSync(join(dir, "assets", `${asset.id}.png`)), false);
  await assert.rejects(store.deleteAsset(asset.id), (e) => e.code === "ASSET_NOT_FOUND");
  await assert.rejects(store.deleteAsset("not-an-id"), (e) => e.code === "INVALID_ASSET_ID");
});

test("corrupt state with assets boots into recovery and keeps every blob", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dir, "state.json"), "{ this is not json");
  // A stray file whose bytes fail sniffing — recovery must register (not
  // delete) it while the valid asset becomes a library candidate.
  writeFileSync(join(dir, "assets", "u_ffffffffffffffffffffffffffffffff.png"), Buffer.from("junk-bytes"));

  const recovered = makeStore(dir);
  const snapshot = recovered.snapshot();
  assert.equal(snapshot.mode, "recovery");
  assert.equal(snapshot.recovery.configLost, true);
  assert.equal(snapshot.recovery.candidateLibrary[asset.id] !== undefined, true);
  assert.deepEqual(snapshot.recovery.quarantine, ["u_ffffffffffffffffffffffffffffffff.png"]);
  // No destructive GC: everything is still on disk.
  assert.equal(readdirSync(join(dir, "assets")).length, 2);
  // Mutations are refused until recovery is confirmed.
  await assert.rejects(setOverride(recovered, "tgcf", "blur", 1), (e) => e.code === "STORE_RECOVERY_REQUIRED");
});

test("missing state with assets boots into recovery, not first install", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await store.uploadAsset(pngBytes(), { displayName: "w" });
  const { unlinkSync } = await import("node:fs");
  unlinkSync(join(dir, "state.json"));
  const reopened = makeStore(dir);
  assert.equal(reopened.getMode(), "recovery");
});

test("confirmRecovery rebuilds the library, quarantines strays physically and archives the corrupt file", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dir, "state.json"), "broken");
  writeFileSync(join(dir, "assets", "u_ffffffffffffffffffffffffffffffff.png"), Buffer.from("junk-bytes"));

  const recovered = makeStore(dir);
  const { revision } = await recovered.confirmRecovery();
  assert.ok(revision >= 1);
  const snapshot = recovered.snapshot();
  assert.equal(snapshot.mode, "normal");
  assert.equal(snapshot.library.length, 1);
  assert.equal(snapshot.library[0].id, asset.id);
  // The stray blob was moved (not deleted) into quarantine/.
  assert.equal(existsSync(join(dir, "quarantine", "u_ffffffffffffffffffffffffffffffff.png")), true);
  assert.equal(readdirSync(join(dir, "assets")).length, 1);
  // A corrupt-state backup was archived.
  const backups = readdirSync(dir).filter((name) => name.startsWith("state.json.corrupt."));
  assert.equal(backups.length, 1);
  // The store is writable again.
  await setOverride(recovered, "tgcf", "blur", 3);
  assert.equal(recovered.snapshot().skins.tgcf.blur, 3);
});

test("future configVersion boots read-only with zero writes and zero GC", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await store.uploadAsset(pngBytes(), { displayName: "w" });
  const statePath = join(dir, "state.json");
  const raw = JSON.parse(readFileSync(statePath, "utf8"));
  raw.configVersion = 99;
  writeFileSync(statePath, JSON.stringify(raw));
  writeFileSync(join(dir, "assets", "u_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png"), pngBytes(5, 5));

  const old = makeStore(dir);
  const snapshot = old.snapshot();
  assert.equal(snapshot.mode, "unsupported");
  assert.equal(snapshot.library.length, 1);
  // Old version still sees the newer skin section it doesn't understand.
  await assert.rejects(setOverride(old, "tgcf", "blur", 1), (e) => e.code === "STORE_READONLY");
  await assert.rejects(old.uploadAsset(pngBytes(), { displayName: "x" }), (e) => e.code === "STORE_READONLY");
  await assert.rejects(old.confirmRecovery(), (e) => e.code === "STORE_NOT_RECOVERING");
  // Zero writes / zero GC: both blobs survive untouched.
  assert.equal(readdirSync(join(dir, "assets")).length, 2);
  assert.equal(JSON.parse(readFileSync(statePath, "utf8")).configVersion, 99);
});

test("GC removes stray blobs on the next commit but never library members", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dir, "assets", "u_abababababababababababababababab.png"), pngBytes(3, 3));
  await setOverride(store, "tgcf", "blur", 1); // triggers post-commit GC
  const names = readdirSync(join(dir, "assets"));
  assert.deepEqual(names, [`${asset.id}.png`]);
});

test("fault injection: a failed blob create leaves no library entry and no state change", async () => {
  const dir = tempDir();
  let blobCreates = 0;
  const store = makeStore(dir, {
    openSync: (file, flags) => {
      // Fail only the first exclusive blob create, never the state writer
      // (which never opens files with "wx").
      if (flags === "wx" && String(file).includes("/assets/")) {
        blobCreates += 1;
        if (blobCreates === 1) throw new Error("simulated crash before commit");
      }
      return fOpen(file, flags);
    },
  });
  await assert.rejects(store.uploadAsset(pngBytes(), { displayName: "w" }), /simulated crash/);
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.library, []);
  assert.equal(snapshot.revision, 0);
  // The next upload still works.
  const result = await store.uploadAsset(pngBytes(), { displayName: "w2" });
  assert.equal(result.revision, 1);
});

test("fault injection: a failed state commit after a successful blob write reclaims the blob", async () => {
  const dir = tempDir();
  let stateWrites = 0;
  const store = makeStore(dir, {
    writeFileSync: (file, data) => {
      if (String(file).includes("state.json")) {
        stateWrites += 1;
        // Allow the initial first-install state write; fail the upload's
        // state commit (the second one).
        if (stateWrites > 1) throw new Error("simulated state commit crash");
      }
      return fWrite(file, data);
    },
  });
  await assert.rejects(store.uploadAsset(pngBytes(), { displayName: "w" }), /simulated state commit crash/);
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.library, []);
  assert.equal(readdirSync(join(dir, "assets")).length, 0, "orphan blob reclaimed");
});

test("interleaved mutations from two clients never lose each other's fields", async () => {
  const store = makeStore(tempDir());
  const first = setOverride(store, "tgcf", "slogan", { zh: "一", en: "One" });
  const second = setOverride(store, "openbmc", "wallpaper", "builtin:openbmc:art");
  await Promise.all([first, second]);
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.skins.tgcf.slogan, { zh: "一", en: "One" });
  assert.equal(snapshot.skins.openbmc.wallpaper, "builtin:openbmc:art");
  assert.equal(snapshot.revision, 2);
});

// ---- review-round regressions (data safety, concurrency, crash windows) ----

test("R1: a semantically corrupt library boots into recovery and keeps every blob", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  const statePath = join(dir, "state.json");
  const raw = JSON.parse(readFileSync(statePath, "utf8"));
  raw.library.bogus = {}; // id-shape violation must not pass as normal
  writeFileSync(statePath, JSON.stringify(raw));

  const reopened = makeStore(dir);
  const snapshot = reopened.snapshot();
  assert.equal(snapshot.mode, "recovery");
  // The real blob survived: the unvalidated state never fed the GC.
  assert.equal(readdirSync(join(dir, "assets")).length, 1);
  assert.equal(snapshot.recovery.candidateLibrary[asset.id] !== undefined, true);
  assert.ok(snapshot.recovery.quarantine.length >= 0);
});

test("R1: unsupported configVersion boots without creating any directory", async () => {
  const dir = tempDir();
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    configVersion: 99, revision: 1, skins: {}, library: {},
  }));
  const store = makeStore(dir);
  assert.equal(store.getMode(), "unsupported");
  assert.equal(existsSync(join(dir, "assets")), false, "assets/ must not be created");
  assert.equal(existsSync(join(dir, "staging")), false, "staging/ must not be created");
});

test("R2: a failing recovery commit moves nothing and can be retried", async () => {
  const dir = tempDir();
  const seed = makeStore(dir);
  const { asset } = await seed.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dir, "state.json"), "broken");
  writeFileSync(join(dir, "assets", "u_ffffffffffffffffffffffffffffffff.png"), Buffer.from("junk"));

  let failCommits = false;
  let stateWrites = 0;
  const store = makeStore(dir, {
    writeFileSync: (file, data) => {
      if (String(file).includes("state.json")) {
        stateWrites += 1;
        if (failCommits && stateWrites >= 1) throw new Error("simulated recovery commit crash");
      }
      return fWrite(file, data);
    },
  });
  assert.equal(store.snapshot().mode, "recovery");
  failCommits = true;
  await assert.rejects(store.confirmRecovery(), /simulated recovery commit crash/);
  // Nothing moved: the junk file is still in assets/ and the corrupt state
  // file is still in place (only a backup COPY may exist).
  assert.equal(existsSync(join(dir, "assets", "u_ffffffffffffffffffffffffffffffff.png")), true);
  assert.equal(existsSync(join(dir, "state.json")), true);
  assert.equal(existsSync(join(dir, "quarantine")), false, "no quarantine dir before commit");

  // Retry after the fault clears: recovery completes deterministically.
  failCommits = false;
  const store2 = makeStore(dir);
  await store2.confirmRecovery();
  const snapshot = store2.snapshot();
  assert.equal(snapshot.mode, "normal");
  assert.equal(snapshot.library.length, 1);
  assert.equal(snapshot.library[0].id, asset.id);
  assert.equal(existsSync(join(dir, "quarantine", "u_ffffffffffffffffffffffffffffffff.png")), true);
});
test("Y5: recovery quarantines files whose extension contradicts the magic bytes", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  void asset;
  // PNG bytes under a .jpg name: sniff says png, name says jpg.
  const png = pngBytes();
  const id = "u_11111111111111111111111111111111";
  writeFileSync(join(dir, "state.json"), "broken");
  writeFileSync(join(dir, "assets", `${id}.jpg`), png);
  const recovered = makeStore(dir);
  const snapshot = recovered.snapshot();
  assert.equal(snapshot.mode, "recovery");
  assert.deepEqual(snapshot.recovery.quarantine, [`${id}.jpg`]);
  await recovered.confirmRecovery();
  assert.equal(existsSync(join(dir, "quarantine", `${id}.jpg`)), true);
  assert.equal(reopenedLibraryHasOnlyValid(recovered), true);
  function reopenedLibraryHasOnlyValid(s) {
    return s.snapshot().library.every((meta) => meta.extension === "png");
  }
});

test("N2: a future-version state with a CHANGED shape boots unsupported with zero writes", () => {
  const dir = tempDir();
  // Future versions may rename/restructure the skeleton — that is exactly
  // what a configVersion bump licenses. It must never read as "corrupt".
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    configVersion: 99, revision: 3, skinsFuture: {}, libraryV2: {},
  }));
  const store = makeStore(dir);
  assert.equal(store.getMode(), "unsupported");
  assert.equal(existsSync(join(dir, "assets")), false, "no directories may be created");
  assert.equal(existsSync(join(dir, "staging")), false);
  assert.equal(existsSync(join(dir, "quarantine")), false);
});

test("N3: shape-changed future states serve a usable read-only snapshot", () => {
  const dir = tempDir();
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    configVersion: 99, revision: 3, skinsFuture: {}, libraryV2: {},
  }));
  const store = makeStore(dir);
  assert.equal(store.getMode(), "unsupported");
  const snapshot = store.snapshot();
  assert.equal(snapshot.mode, "unsupported");
  assert.equal(snapshot.configVersion, 99);
  assert.equal(snapshot.revision, 3);
  assert.deepEqual(snapshot.library, []);
  assert.deepEqual(snapshot.quota, { count: 0, totalBytes: 0 });
  // The read-only asset route degrades to 404 semantics, never a TypeError.
  assert.equal(store.serveAsset("/dsh-skins/assets/u_0123456789abcdef0123456789abcdef.png"), null);
});
