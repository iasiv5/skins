import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEffects, projectSkin } from "../src/client/personalization/projector.js";
import { defaultsFor } from "../src/shared/personalization/catalog.js";

/** A tgcf-like fixture: custom projector mapping values → effects. */
function fixtureSkin() {
  return {
    id: "tgcf",
    bodyAttr: "dshTgcfSkin",
    project(values, assets) {
      return {
        bodyAttribute: "dshTgcfSkin",
        slogans: values.slogan,
        titleBrand: values.titleBrand,
        favicon: { href: assets.favicon?.url ?? "data:image/svg+xml,x", mime: assets.favicon?.mime ?? "image/svg+xml" },
        backdrop: {
          imageLight: `url("${assets.wallpaper?.url ?? "about:blank"}")`,
          imageDark: `url("${assets.wallpaper?.url ?? "about:blank"}")`,
          overlayLight: `rgba(0,0,0,${(values.scrim.light ?? 0) / 100})`,
          overlayDark: `rgba(0,0,0,${(values.scrim.dark ?? 0) / 100})`,
          blur: values.blur,
        },
        tokenOverrides: {
          "--dsw-alias-accent": values.accent,
          "--dsw-specific-bubble": values.bubbleColor,
        },
        cssVariables: {
          "--dsh-panel-alpha": { light: `${values.panelOpacity}%`, dark: `${values.panelOpacity}%` },
        },
        staticCss: "body[data-dsh-tgcf-skin] .x{color:red}",
        decorations: [{ key: "lanterns", css: "body[data-dsh-tgcf-skin]::after{opacity:.5}" }],
      };
    },
  };
}

function resolver(ref) {
  if (ref.kind === "builtin") return { url: `builtin://${ref.skinId}/${ref.assetKey}`, mime: "image/svg+xml" };
  return { url: `/dsh-skins/assets/${ref.id}.png`, mime: "image/png" };
}

/** A legacy openbmc-like fixture with baked properties and no project(). */
function legacySkin() {
  return {
    id: "openbmc",
    bodyAttr: "dshOpenbmcSkin",
    slogans: { zh: "察于未萌 · 治于未乱", en: "Govern before the storm" },
    title: "OpenBMC Harness",
    favicon: "data:image/png;base64,AAA",
    faviconMime: "image/png",
    css: "body[data-dsh-openbmc-skin]{background:#001}",
    art: "data:image/webp;base64,BBB",
    scrimLight: "url(data:image/webp;base64,BBB), linear-gradient(#fff,#eee)",
    scrimDark: "url(data:image/webp;base64,BBB), linear-gradient(#000,#111)",
    placeholderLight: "linear-gradient(#fff,#eee)",
    placeholderDark: "linear-gradient(#000,#111)",
  };
}

test("projection with overrides succeeds without degradation", () => {
  const result = projectSkin(fixtureSkin(), {
    slogan: { zh: "自定义", en: "Custom" },
    accent: { light: "#111111", dark: "#222222" },
    blur: 20,
  }, { assetResolver: resolver });
  assert.equal(result.degraded, "none");
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.effects.slogans, { zh: "自定义", en: "Custom" });
  assert.equal(result.effects.backdrop.blur, 20);
  assert.equal(result.effects.tokenOverrides["--dsw-alias-accent"].light, "#111111");
  assert.equal(result.effects.staticCss, "body[data-dsh-tgcf-skin] .x{color:red}");
  assert.equal(result.effects.decorations[0].key, "lanterns");
});

test("layer-1 field fallback keeps projection healthy with bad overrides", () => {
  const result = projectSkin(fixtureSkin(), {
    accent: { light: "#bad", dark: "#222222" }, // invalid member → field default
    blur: 999,                                  // out of range → field default
  }, { assetResolver: resolver });
  assert.equal(result.degraded, "none");
  assert.deepEqual(result.issues.map((issue) => issue.key).sort(), ["accent", "blur"]);
  assert.deepEqual(result.effects.tokenOverrides["--dsw-alias-accent"], { light: "#C3272B", dark: "#E0564A" });
  assert.equal(result.effects.backdrop.blur, 12); // catalog default
});

test("a crashing projector triggers the defaults-only retry (layer 2)", () => {
  const skin = fixtureSkin();
  // Crash only when the override is present; defaults project cleanly.
  skin.project = (values) => {
    if (values.blur === 20) throw new Error("boom");
    return {
      bodyAttribute: "dshTgcfSkin",
      slogans: defaultsFor("tgcf").slogan,
      titleBrand: defaultsFor("tgcf").titleBrand,
      backdrop: null,
    };
  };
  const result = projectSkin(skin, { blur: 20 }, { assetResolver: resolver });
  assert.equal(result.degraded, "defaults");
  assert.deepEqual(result.effects.slogans, defaultsFor("tgcf").slogan);
  assert.equal(result.effects.backdrop, null);
});

test("a projector that always fails degrades to fail-closed (layer 3)", () => {
  const skin = fixtureSkin();
  skin.project = () => {
    throw new Error("always broken");
  };
  const result = projectSkin(skin, {}, { assetResolver: resolver });
  assert.equal(result.degraded, "failed");
  assert.equal(result.effects, null);
});

test("malformed effects shapes are rejected by normalizeEffects", () => {
  assert.equal(normalizeEffects(null), null);
  assert.equal(normalizeEffects("nope"), null);
  assert.equal(normalizeEffects({ bodyAttribute: "data-skin-tgcf" }), null, "dashed dataset key is invalid");
  assert.equal(normalizeEffects({ bodyAttribute: "ok", backdrop: { blur: 99 } }), null, "blur out of range");
  assert.equal(normalizeEffects({
    bodyAttribute: "ok",
    tokenOverrides: { accent: { light: "#fff" } }, // missing dark
  }), null);
  assert.equal(normalizeEffects({
    bodyAttribute: "ok",
    decorations: [{ key: "", css: "x" }], // empty key
  }), null);
  const clean = normalizeEffects({ bodyAttribute: "ok" });
  assert.deepEqual(clean, {
    bodyAttribute: "ok", slogans: null, titleBrand: null, favicon: null,
    backdrop: null, tokenOverrides: null, cssVariables: null, staticCss: null, decorations: null,
  });
});

test("legacy skins project byte-equivalent defaults without a project function", () => {
  const result = projectSkin(legacySkin(), {}, { assetResolver: resolver });
  assert.equal(result.degraded, "none");
  const effects = result.effects;
  assert.equal(effects.bodyAttribute, "dshOpenbmcSkin");
  assert.deepEqual(effects.slogans, { zh: "察于未萌 · 治于未乱", en: "Govern before the storm" });
  assert.equal(effects.titleBrand, "OpenBMC Harness");
  assert.deepEqual(effects.favicon, { href: "data:image/png;base64,AAA", mime: "image/png" });
  // Exact baked strings, byte-for-byte (design: 0.6.0 equivalence).
  assert.equal(effects.backdrop.imageLight, "url(data:image/webp;base64,BBB), linear-gradient(#fff,#eee)");
  assert.equal(effects.backdrop.imageDark, "url(data:image/webp;base64,BBB), linear-gradient(#000,#111)");
  assert.equal(effects.backdrop.blur, 0);
  assert.equal(effects.staticCss, "body[data-dsh-openbmc-skin]{background:#001}");
});

test("legacy skins swap the backdrop only for user wallpapers", () => {
  const overrides = { wallpaper: "u_0123456789abcdef0123456789abcdef" };
  const result = projectSkin(legacySkin(), overrides, { assetResolver: resolver });
  assert.equal(result.degraded, "none");
  assert.equal(result.effects.backdrop.imageLight, 'url("/dsh-skins/assets/u_0123456789abcdef0123456789abcdef.png")');
  assert.equal(result.effects.backdrop.imageDark, 'url("/dsh-skins/assets/u_0123456789abcdef0123456789abcdef.png")');
  // The default builtin ref keeps legacy visuals even when resolved.
  const builtinDefault = projectSkin(legacySkin(), { wallpaper: "builtin:openbmc:art" }, { assetResolver: resolver });
  assert.equal(
    builtinDefault.effects.backdrop.imageLight,
    "url(data:image/webp;base64,BBB), linear-gradient(#fff,#eee)",
  );
});

test("placeholder path applies when a legacy skin has no art", () => {
  const skin = legacySkin();
  skin.art = "";
  const result = projectSkin(skin, {}, { assetResolver: resolver });
  assert.equal(result.effects.backdrop.imageLight, "linear-gradient(#fff,#eee)");
  assert.equal(result.effects.backdrop.imageDark, "linear-gradient(#000,#111)");
});

test("skins outside the catalog fail closed with no effects", () => {
  const result = projectSkin({ id: "mystery", project: () => ({ bodyAttribute: "x" }) }, {}, {});
  assert.equal(result.degraded, "failed");
  assert.equal(result.effects, null);
});
