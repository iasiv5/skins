import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPersonalizationStore } from "../src/host/personalization/store.js";
import { readStoreOnlyZip, writeStoreOnlyZip } from "../src/host/personalization/zip.js";

let clock = 1_700_000_000_000;

function pngBytes(width = 40, height = 30, padding = 8) {
  const header = Buffer.alloc(24);
  header.write("\x89PNG\r\n\x1a\n", 0, "latin1");
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "latin1");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return Buffer.concat([header, Buffer.alloc(padding)]);
}

function makeStore(dir) {
  return createPersonalizationStore({ dataDir: dir, now: () => clock });
}

async function seedWallpaper(store) {
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "灯.png" });
  await store.applyOperations({
    operations: [
      { op: "set", skinId: "tgcf", key: "wallpaper", value: asset.id },
      { op: "set", skinId: "tgcf", key: "blur", value: 20 },
    ],
  });
  return asset;
}

test("export → import roundtrip re-ids assets and applies fields on a fresh host", async () => {
  const sourceDir = mkdtempSync(join(tmpdir(), "dsh-skins-t-exp-"));
  const source = makeStore(sourceDir);
  const asset = await seedWallpaper(source);
  // A future-version field must NOT be exported (only known catalog fields).
  const statePath = join(sourceDir, "state.json");
  const raw = JSON.parse((await import("node:fs")).readFileSync(statePath, "utf8"));
  raw.skins.tgcf.futureKey = { any: "shape" };
  writeFileSync(statePath, JSON.stringify(raw));
  source.snapshot(); // no re-init needed; export reads state from disk? (store holds memory state)

  const pkg = source.exportTheme("tgcf");
  const parsed = readStoreOnlyZip(pkg.zip);
  const manifest = JSON.parse(parsed.manifest.toString("utf8"));
  assert.equal(manifest.skinId, "tgcf");
  assert.equal(manifest.fields.blur, 20);
  assert.equal(manifest.fields.wallpaper.$asset, `assets/${asset.id}.png`);
  assert.equal("futureKey" in manifest.fields, false, "unknown fields are not exported");

  const target = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-imp-")));
  const prepare = await target.prepareImport(pkg.zip);
  assert.equal(prepare.baseRevision, 0);
  assert.deepEqual(prepare.diff.setFields.sort(), ["blur", "wallpaper"]);
  assert.deepEqual(prepare.diff.removeFields, []);
  assert.deepEqual(prepare.diff.keepUnknown, []);

  const commit = await target.commitImport({
    importToken: prepare.importToken,
    baseRevision: prepare.baseRevision,
    confirm: true,
  });
  const snapshot = target.snapshot();
  const newId = snapshot.skins.tgcf.wallpaper;
  assert.match(newId, /^u_[0-9a-f]{32}$/);
  assert.notEqual(newId, asset.id, "imported assets are always re-id'd");
  assert.equal(commit.assetMapping[`assets/${asset.id}.png`], newId);
  assert.equal(snapshot.skins.tgcf.blur, 20);
  assert.equal(snapshot.library.length, 1);
  assert.equal(snapshot.quota.totalBytes, asset.byteLength);
});

test("hash dedup reuses an identical library entry instead of duplicating the blob", async () => {
  const source = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-d1-")));
  const asset = await seedWallpaper(source);
  const pkg = source.exportTheme("tgcf");

  const target = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-d2-")));
  const twin = await target.uploadAsset(pngBytes(), { displayName: "same-bytes.png" });
  const prepare = await target.prepareImport(pkg.zip);
  await target.commitImport({ importToken: prepare.importToken, baseRevision: prepare.baseRevision, confirm: true });
  const snapshot = target.snapshot();
  assert.equal(snapshot.library.length, 1, "identical bytes must not duplicate");
  assert.equal(snapshot.skins.tgcf.wallpaper, twin.asset.id);
});

test("unknown fields survive import by default and are removed with purgeUnknown", async () => {
  const source = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-p1-")));
  await seedWallpaper(source);
  const pkg = source.exportTheme("tgcf");

  const targetDir = mkdtempSync(join(tmpdir(), "dsh-skins-t-p2-"));
  const target = makeStore(targetDir);
  await target.applyOperations({ operations: [{ op: "set", skinId: "tgcf", key: "slogan", value: { zh: "旧", en: "Old" } }] });
  const statePath = join(targetDir, "state.json");
  const raw = JSON.parse((await import("node:fs")).readFileSync(statePath, "utf8"));
  raw.skins.tgcf.futureKey = "keep me";
  writeFileSync(statePath, JSON.stringify(raw));

  const keeper = makeStore(targetDir);
  const keepPrepare = await keeper.prepareImport(pkg.zip);
  assert.deepEqual(keepPrepare.diff.keepUnknown, ["futureKey"]);
  assert.equal(keepPrepare.warnings[0]?.code, "KEEP_UNKNOWN_FIELDS");
  await keeper.commitImport({ importToken: keepPrepare.importToken, baseRevision: keepPrepare.baseRevision, confirm: true });
  assert.equal(keeper.snapshot().skins.tgcf.futureKey, "keep me");
  assert.equal(keeper.snapshot().skins.tgcf.slogan, undefined, "known fields not in the package are replaced away");

  const purger = makeStore(targetDir);
  const purgePrepare = await purger.prepareImport(pkg.zip);
  await purger.commitImport({
    importToken: purgePrepare.importToken, baseRevision: purgePrepare.baseRevision, confirm: true, purgeUnknown: true,
  });
  assert.equal(purger.snapshot().skins.tgcf.futureKey, undefined);
});

test("commit rejects when the revision moved after prepare (409 → re-preview)", async () => {
  const source = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-c1-")));
  await seedWallpaper(source);
  const pkg = source.exportTheme("tgcf");

  const target = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-c2-")));
  const prepare = await target.prepareImport(pkg.zip);
  await target.applyOperations({ operations: [{ op: "set", skinId: "tgcf", key: "blur", value: 3 }] });
  await assert.rejects(target.commitImport({
    importToken: prepare.importToken, baseRevision: prepare.baseRevision, confirm: true,
  }), (e) => e.code === "IMPORT_CONFLICT");
});

test("committed tokens are idempotent for identical retries and conflict on different params", async () => {
  const source = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-i1-")));
  await seedWallpaper(source);
  const pkg = source.exportTheme("tgcf");

  const target = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-i2-")));
  const prepare = await target.prepareImport(pkg.zip);
  const params = { importToken: prepare.importToken, baseRevision: prepare.baseRevision, confirm: true };
  const first = await target.commitImport(params);
  const retry = await target.commitImport(params);
  assert.deepEqual(retry, first);
  await assert.rejects(target.commitImport({ ...params, purgeUnknown: true }), (e) => e.code === "IMPORT_CONFLICT");
});

test("expired tokens are rejected with IMPORT_EXPIRED", async () => {
  const source = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-e1-")));
  await seedWallpaper(source);
  const pkg = source.exportTheme("tgcf");

  const target = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-e2-")));
  const prepare = await target.prepareImport(pkg.zip);
  clock += 11 * 60 * 1000; // past the 10-minute TTL
  await assert.rejects(target.commitImport({
    importToken: prepare.importToken, baseRevision: prepare.baseRevision, confirm: true,
  }), (e) => e.code === "IMPORT_EXPIRED");
  clock -= 11 * 60 * 1000;
});

test("prepare rejects corrupt manifests, unlisted assets and raw user-id image fields", async () => {
  const target = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-r-")));
  const badManifest = writeStoreOnlyZip([{ name: "manifest.json", data: Buffer.from("not json") }]);
  await assert.rejects(() => target.prepareImport(badManifest), (e) => e.code === "IMPORT_INVALID");

  const assetEntry = { name: "assets/u_0123456789abcdef0123456789abcdef.png", data: pngBytes() };
  const unlisted = writeStoreOnlyZip([
    { name: "manifest.json", data: Buffer.from(JSON.stringify({
      formatVersion: 1, skinId: "tgcf", fields: {}, assets: [],
    })) },
    assetEntry,
  ]);
  await assert.rejects(() => target.prepareImport(unlisted), (e) => e.code === "IMPORT_INVALID");

  const rawRef = writeStoreOnlyZip([{ name: "manifest.json", data: Buffer.from(JSON.stringify({
    formatVersion: 1,
    skinId: "tgcf",
    fields: { wallpaper: "u_0123456789abcdef0123456789abcdef" },
    assets: [],
  })) }]);
  await assert.rejects(() => target.prepareImport(rawRef), (e) => e.code === "IMPORT_INVALID");
});

test("builtin refs travel as plain strings and need no asset entry", async () => {
  const source = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-b1-")));
  await source.applyOperations({
    operations: [
      { op: "set", skinId: "tgcf", key: "wallpaper", value: "builtin:tgcf:butterflies" },
      { op: "set", skinId: "tgcf", key: "accent", value: { light: "#111111", dark: "#222222" } },
    ],
  });
  const pkg = source.exportTheme("tgcf");
  const parsed = readStoreOnlyZip(pkg.zip);
  const manifest = JSON.parse(parsed.manifest.toString("utf8"));
  assert.equal(manifest.fields.wallpaper, "builtin:tgcf:butterflies");
  assert.equal(parsed.assets.size, 0);

  const target = makeStore(mkdtempSync(join(tmpdir(), "dsh-skins-t-b2-")));
  const prepare = await target.prepareImport(pkg.zip);
  await target.commitImport({ importToken: prepare.importToken, baseRevision: prepare.baseRevision, confirm: true });
  const section = target.snapshot().skins.tgcf;
  assert.equal(section.wallpaper, "builtin:tgcf:butterflies");
  assert.deepEqual(section.accent, { light: "#111111", dark: "#222222" });
});
