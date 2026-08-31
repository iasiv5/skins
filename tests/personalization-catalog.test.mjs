import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSET_ID_PATTERN,
  BUILTIN_REF_PATTERN,
  GIF_MAX_PIXELS,
  GLOBAL_MAX_PIXELS,
  SKINS,
  defaultsFor,
  getField,
  getSkinSchema,
  listAssetFields,
  mergeValues,
  resolveImageRef,
  validateCatalogInvariants,
  validateOverride,
} from "../src/shared/personalization/catalog.js";

const USER_ID = "u_" + "0123456789abcdef0123456789abcdef";

test("catalog self-invariants hold for every shipped skin", () => {
  assert.deepEqual(validateCatalogInvariants(), []);
});

test("shipped skins are exactly tgcf, openbmc and uefi-harness", () => {
  assert.deepEqual(Object.keys(SKINS).sort(), ["openbmc", "tgcf", "uefi-harness"]);
});

test("asset id pattern accepts hyphenless 32-hex and rejects uuid/other shapes", () => {
  assert.ok(ASSET_ID_PATTERN.test(USER_ID));
  assert.ok(!ASSET_ID_PATTERN.test("u_550e8400-e29b-41d4-a716-446655440000"), "hyphenated UUID must not match");
  assert.ok(!ASSET_ID_PATTERN.test("u_0123456789abcdef0123456789abcdeg"), "non-hex rejected");
  assert.ok(!ASSET_ID_PATTERN.test("builtin:tgcf:crimson"));
  assert.ok(!ASSET_ID_PATTERN.test(""));
});

test("builtin ref pattern parses skin and asset key", () => {
  const match = BUILTIN_REF_PATTERN.exec("builtin:tgcf:lantern-favicon");
  assert.equal(match?.[1], "tgcf");
  assert.equal(match?.[2], "lantern-favicon");
  assert.equal(BUILTIN_REF_PATTERN.test("builtin:tgcf:"), false);
  assert.equal(BUILTIN_REF_PATTERN.test("builtin::lanterns"), false);
});

test("resolveImageRef classifies builtin, user and malformed refs", () => {
  assert.deepEqual(resolveImageRef("builtin:openbmc:art"), { kind: "builtin", skinId: "openbmc", assetKey: "art" });
  assert.deepEqual(resolveImageRef(USER_ID), { kind: "user", id: USER_ID });
  assert.equal(resolveImageRef("u_short"), null);
  assert.equal(resolveImageRef(42), null);
  assert.equal(resolveImageRef(""), null);
});

test("validateOverride: unknown skin fields are rejected", () => {
  assert.deepEqual(validateOverride("tgcf", "nope", "x"), { ok: false, code: "UNKNOWN_FIELD" });
  assert.deepEqual(validateOverride("unknown-skin", "slogan", "x"), { ok: false, code: "UNKNOWN_FIELD" });
});

test("titleBrand is no longer personalizable (v2.4.1 #5)", () => {
  assert.deepEqual(validateOverride("tgcf", "titleBrand", "天官赐福"), { ok: false, code: "UNKNOWN_FIELD" });
});

test("validateOverride: locale text requires complete {zh,en} objects", () => {
  assert.equal(validateOverride("tgcf", "slogan", { zh: "千灯", en: "Lights" }).ok, true);
  assert.deepEqual(validateOverride("tgcf", "slogan", { zh: "只有中文" }), { ok: false, code: "BAD_SHAPE" });
  assert.deepEqual(validateOverride("tgcf", "slogan", { zh: "a", en: "b".repeat(41) }), { ok: false, code: "BAD_SHAPE" });
  assert.deepEqual(validateOverride("tgcf", "slogan", "flat string"), { ok: false, code: "BAD_SHAPE" });
});

test("validateOverride: colors need 6-digit hex in both schemes", () => {
  // The simplification removed every shipped color field; the generic
  // color validation stays covered through the catalog type machinery.
  assert.equal(getField("tgcf", "accent"), null);
  assert.equal(getField("tgcf", "gold"), null);
  assert.equal(getField("tgcf", "bubbleColor"), null);
  assert.deepEqual(validateOverride("tgcf", "accent", { light: "#C3272B", dark: "#E0564A" }), { ok: false, code: "UNKNOWN_FIELD" });
});

test("validateOverride: ranges clamp to min/max in single scopes", () => {
  assert.equal(validateOverride("tgcf", "panelOpacity", 82).ok, true);
  assert.deepEqual(validateOverride("tgcf", "panelOpacity", 101), { ok: false, code: "BAD_VALUE" });
  assert.deepEqual(validateOverride("tgcf", "panelOpacity", 29), { ok: false, code: "BAD_VALUE" });
  assert.deepEqual(validateOverride("tgcf", "panelOpacity", "82"), { ok: false, code: "BAD_VALUE" });
  assert.equal(validateOverride("tgcf", "scrim", 30).ok, true, "scrim is a single-value field since the simplification");
  assert.deepEqual(validateOverride("tgcf", "scrim", { light: 0, dark: 100 }), { ok: false, code: "BAD_VALUE" }, "legacy light/dark pair shape is gone");
});

test("validateOverride: image builtin refs must belong to the owning skin", () => {
  assert.equal(validateOverride("tgcf", "wallpaper", "builtin:tgcf:crimson").ok, true);
  assert.deepEqual(validateOverride("tgcf", "wallpaper", "builtin:tgcf:lanterns"), { ok: false, code: "BAD_ASSET" }, "retired motif refs are rejected (v2.4.1 #6)");
  assert.deepEqual(validateOverride("tgcf", "wallpaper", "builtin:openbmc:art"), { ok: false, code: "BAD_ASSET" });
  assert.deepEqual(validateOverride("tgcf", "wallpaper", "builtin:tgcf:missing"), { ok: false, code: "BAD_ASSET" });
  assert.deepEqual(validateOverride("openbmc", "wallpaper", "builtin:openbmc:art").ok, true);
});

test("validateOverride: user refs skip asset checks without a metadata provider", () => {
  assert.equal(validateOverride("tgcf", "wallpaper", USER_ID).ok, true);
});

test("validateOverride: provider metadata enforces existence, mime, bytes and pixels", () => {
  const okWallpaper = { mime: "image/png", byteLength: 1024, width: 1000, height: 1000 };
  assert.equal(validateOverride("tgcf", "wallpaper", USER_ID, () => okWallpaper).ok, true);
  assert.deepEqual(validateOverride("tgcf", "wallpaper", USER_ID, () => null), { ok: false, code: "MISSING_ASSET" });
  // SVG never enters the user library, but the validator must still reject it.
  assert.deepEqual(
    validateOverride("tgcf", "wallpaper", USER_ID, () => ({ ...okWallpaper, mime: "image/svg+xml" })),
    { ok: false, code: "BAD_ASSET" },
  );
  // Favicon field removed by the simplification: its id is now unknown.
  assert.deepEqual(
    validateOverride("tgcf", "favicon", USER_ID, () => ({ mime: "image/png", byteLength: 1024, width: 64, height: 64 })),
    { ok: false, code: "UNKNOWN_FIELD" },
  );
  // GIF pixels are tightened to GIF_MAX_PIXELS even below the field cap.
  const gifWide = { mime: "image/gif", byteLength: 1024, width: 5000, height: 3000 }; // 15MP > 12MP
  assert.deepEqual(validateOverride("tgcf", "wallpaper", USER_ID, () => gifWide), { ok: false, code: "BAD_ASSET" });
  const pngWide = { mime: "image/png", byteLength: 1024, width: 5000, height: 8000 }; // 40MP == global cap
  assert.equal(validateOverride("tgcf", "wallpaper", USER_ID, () => pngWide).ok, true);
  const pngOver = { mime: "image/png", byteLength: 1024, width: 5001, height: 8000 }; // > 40MP
  assert.deepEqual(validateOverride("tgcf", "wallpaper", USER_ID, () => pngOver), { ok: false, code: "BAD_ASSET" });
});

test("mergeValues: defaults fill untouched fields, overrides win when valid", () => {
  const { values, issues } = mergeValues("tgcf", {
    slogan: { zh: "改", en: "Changed" },
    panelOpacity: 60,
  });
  assert.deepEqual(issues, []);
  assert.deepEqual(values.slogan, { zh: "改", en: "Changed" });
  assert.equal(values.panelOpacity, 60);
  assert.equal(values.wallpaper, "builtin:tgcf:crimson");
  assert.equal(values.scrim, 30);
});

test("mergeValues: layer-1 fallback swaps invalid overrides for defaults and reports issues", () => {
  const { values, issues } = mergeValues("tgcf", {
    panelOpacity: 500,
    scrim: 142,
    unknownFutureKey: { any: "shape" },
  });
  assert.equal(values.panelOpacity, 82);
  assert.equal(values.scrim, 30);
  assert.deepEqual(issues.map((issue) => issue.key).sort(), ["panelOpacity", "scrim"]);
  // Unknown keys are ignored by projection (the store normalizes them away at load).
  assert.equal("unknownFutureKey" in values, false);
});

test("mergeValues: image overrides validate against trusted metadata when provided", () => {
  const meta = { [USER_ID]: { mime: "image/png", byteLength: 10, width: 10, height: 10 } };
  const ok = mergeValues("tgcf", { wallpaper: USER_ID }, (id) => meta[id] ?? null);
  assert.equal(ok.values.wallpaper, USER_ID);
  assert.deepEqual(ok.issues, []);

  const missing = mergeValues("tgcf", { wallpaper: USER_ID }, () => null);
  assert.equal(missing.values.wallpaper, "builtin:tgcf:crimson");
  assert.deepEqual(missing.issues, [{ key: "wallpaper", code: "MISSING_ASSET" }]);
});

test("mergeValues: unknown skin yields empty values without throwing", () => {
  assert.deepEqual(mergeValues("nope", { a: 1 }), { values: {}, issues: [] });
});

test("accessors expose schema, fields, asset fields and defaults", () => {
  const schema = getSkinSchema("tgcf");
  assert.equal(schema.fields.length, 5);
  assert.deepEqual(schema.fields.map((field) => field.key), ["wallpaper", "slogan", "panelOpacity", "blur", "scrim"]);
  assert.equal(getField("tgcf", "blur").max, 24);
  assert.deepEqual(listAssetFields("tgcf").map((field) => field.key), ["wallpaper"]);
  assert.deepEqual(listAssetFields("openbmc").map((field) => field.key), ["wallpaper"]);
  assert.equal(defaultsFor("tgcf").titleBrand, undefined);
  assert.equal(defaultsFor("uefi-harness").wallpaper, "builtin:uefi-harness:art");
});

test("pixel budgets stay coherent with the design contract", () => {
  assert.equal(GLOBAL_MAX_PIXELS, 40_000_000);
  assert.equal(GIF_MAX_PIXELS, 12_000_000);
});

test("range values must sit on the declared step grid", () => {
  assert.equal(validateOverride("tgcf", "blur", 5).ok, true);
  assert.deepEqual(validateOverride("tgcf", "blur", 5.5), { ok: false, code: "BAD_VALUE" });
  assert.equal(validateOverride("tgcf", "scrim", 18.5).ok, false);
});

test("scope objects must carry exactly their canonical keys", () => {
  assert.deepEqual(validateOverride("tgcf", "slogan", { zh: "一", en: "One", fr: "Un" }), { ok: false, code: "BAD_SHAPE" });
});
