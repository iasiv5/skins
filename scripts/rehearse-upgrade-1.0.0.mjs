/**
 * 0.6.0 → 1.0.0 upgrade rehearsal (release checklist, manual-acceptance items),
 * executed against the REAL store module in sandbox data dirs.
 *
 *   A  0.6.0 footprint (update-cache.json only, no personalization state)
 *      → 1.0.0 first boot creates state.json at revision 0, no recovery.
 *   B  a "1.0.0-dev intermediate" state (valid overrides + retired-field
 *      overrides + unknown skin section + dangling refs) → 1.0.0 load-time
 *      normalization drops the junk, bumps revision by exactly 1, keeps the
 *      library and every valid override.
 *
 * Usage: node scripts/rehearse-upgrade-1.0.0.mjs
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPersonalizationStore } from "../src/host/personalization/store.js";

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures.push(label);
};
const tempDir = () => mkdtempSync(join(tmpdir(), "dsh-skins-rehearsal-"));

// ---------------------------------------------------------------- stage A --
console.log("== A: 0.6.0 footprint (update-cache.json only) → 1.0.0 first boot ==");
{
  const dir = tempDir();
  // The only data a real 0.6.0 install leaves behind: the updater's cache.
  writeFileSync(join(dir, "update-cache.json"), JSON.stringify({
    schemaVersion: 1,
    currentVersion: "0.6.0",
    checkedAt: 1788000000000,
    release: {
      version: "0.6.0",
      tag: "v0.6.0",
      htmlUrl: "https://github.com/iasiv5/skins/releases/tag/v0.6.0",
      name: "v0.6.0 — UEFI 品牌化 / gilded UEFI branding",
    },
  }, null, 2));

  const store = createPersonalizationStore({ dataDir: dir });
  const snap = store.snapshot();
  check(store.getMode() === "normal", `boots in normal mode (got ${store.getMode()}) — no recovery false positive`);
  check(snap.revision === 0, `initial revision is 0 (got ${snap.revision})`);
  check(snap.configVersion === 1, `configVersion stamped 1 (got ${snap.configVersion})`);
  const created = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  check(created.revision === 0 && created.configVersion === 1, "state.json created on disk at revision 0");
  check(existsSync(join(dir, "update-cache.json")), "0.6.0 update-cache.json left untouched");
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------- stage B --
console.log("== B: 1.0.0-dev intermediate state → 1.0.0 load-time normalization ==");
{
  const dir = tempDir();

  // 1. The "intermediate build" writes a healthy state: one uploaded asset
  //    plus a valid slogan override.
  const writer = createPersonalizationStore({ dataDir: dir });
  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  await writer.uploadAsset(png1x1, { displayName: "演练壁纸", declaredMime: "image/png" });
  await writer.applyOperations({
    baseRevision: writer.snapshot().revision,
    operations: [{ op: "set", skinId: "tgcf", key: "slogan", value: { zh: "实验标语", en: "Rehearsal slogan" } }],
  });
  const before = writer.snapshot();
  // snapshot().library is the client-facing array; the blob filename follows
  // the asset id (u_<32hex>) from the on-disk state.
  const diskBefore = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  const assetId = Object.keys(diskBefore.library)[0];
  const blobName = join(dir, "assets", `${assetId}.png`);
  const libraryCountBefore = before.library.length;

  // 2. Hand the state file the kind of junk an intermediate build can leave:
  //    retired fields, an unknown skin section, a dangling wallpaper ref,
  //    and an override equal to the factory default.
  const onDisk = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  onDisk.revision = 1000;
  onDisk.skins["tgcf"]["wallpaper"] = "u:deadbeefdeadbeefdeadbeefdeadbeef"; // dangling user ref
  onDisk.skins["openbmc"] = {
    scrim: 30,                       // retired field (pre-collapse)
    blur: 12,                        // retired field (pre-collapse)
    slogan: { zh: "察于未萌 · 治于未乱", en: "Govern before the storm" }, // equal to factory → not an override
  };
  onDisk.skins["old-skin"] = { slogan: { zh: "卸载残留", en: "uninstalled leftover" } };
  writeFileSync(join(dir, "state.json"), JSON.stringify(onDisk, null, 2));

  // 3. The new build boots over the polluted state.
  const reader = createPersonalizationStore({ dataDir: dir });
  const snap = reader.snapshot();
  const after = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));

  check(reader.getMode() === "normal", `boots in normal mode (got ${reader.getMode()})`);
  check(snap.skins.tgcf?.slogan?.zh === "实验标语", "valid slogan override preserved");
  check(snap.skins.tgcf?.wallpaper === undefined, "dangling wallpaper ref dropped");
  check(snap.skins.openbmc === undefined || Object.keys(snap.skins.openbmc).length === 0,
    "retired openbmc fields (scrim/blur) and factory-equal slogan all dropped");
  check(snap.skins["old-skin"] === undefined, "uninstalled skin section removed");
  check(after.revision === 1001, `revision bumped by exactly 1: 1000 → ${after.revision}`);
  check(Object.keys(snap.library).length === libraryCountBefore, `library entry survived (${libraryCountBefore})`);
  check(existsSync(blobName), "asset blob file still on disk");
  check(after.skins["tgcf"] !== undefined, "state persisted back to disk (落盘)");

  rmSync(dir, { recursive: true, force: true });
}

console.log(failures.length === 0 ? "REHEARSAL PASSED" : `REHEARSAL FAILED: ${failures.length} assertion(s)`);
process.exit(failures.length === 0 ? 0 : 1);
