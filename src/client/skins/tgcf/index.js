/**
 * 「天官赐福 · 百无禁忌」— fan-made, non-official skin.
 *
 * The factory wallpaper is bundled AI-generated fan art (wallpapers.js,
 * 豆包AI origin — see §18/§19); favicon and butterfly sprite remain
 * original code-drawn SVG. The
 * personalization contract lives in src/shared/personalization/catalog.js.
 * Effects are produced by `project()` (values → SkinEffects) and executed
 * by the generic runtime; this module never touches the DOM.
 */

import { WALLPAPER_CRIMSON, WALLPAPER_PALE } from "./wallpapers.js";

const SCOPE = "body[data-dsh-tgcf-skin]";

function svgUrl(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s{2,}/g, " "))}`;
}


const FAVICON_LANTERN = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<rect x="22" y="4" width="20" height="7" rx="2.5" fill="#D4AF37"/>`
  + `<path d="M32 11 c-13 3 -15 14 -15 21 c0 8 7 14 15 14 c8 0 15 -6 15 -14 c0 -7 -2 -18 -15 -21z" fill="#C3272B"/>`
  + `<path d="M18 22 h28 M17 32 h30 M18 42 h28" stroke="#E8B84B" stroke-width="2.5" opacity=".85"/>`
  + `<rect x="22" y="47" width="20" height="6" rx="2.5" fill="#D4AF37"/>`
  + `<path d="M32 53 v7" stroke="#D4AF37" stroke-width="3"/>`
  + `</svg>`,
);

const BUTTERFLY_SPRITE = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<path d="M32 30 C24 12 8 10 6 22 C5 32 20 36 32 33 C44 36 59 32 58 22 C56 10 40 12 32 30z" fill="#cfd8ea" opacity=".9"/>`
  + `<path d="M32 33 C26 44 14 46 13 39 C13 33 24 32 32 36 C40 32 51 33 51 39 C50 46 38 44 32 33z" fill="#aab6cf" opacity=".8"/>`
  + `<ellipse cx="32" cy="34" rx="2.5" ry="11" fill="#8d99b5"/>`
  + `</svg>`,
);

const CSS = [
  // Panel glass: the app shell frosts whatever sits behind it (the runtime
  // backdrop pseudo layers). Ruling #14: the frost strength rides the same
  // translucency curve as the wallpaper blur (var fed from project() below),
  // so P=0 is unfrosted pure wallpaper; 12px at the historical default P=82.
  `${SCOPE} #root{backdrop-filter:blur(var(--dsh-tgcf-glass-blur,12px))}`,
  // Ambient motion (always-on, design Q6): a slow lantern breath on the
  // wallpaper layer and two silver butterflies drifting between the
  // wallpaper and the frosted shell.
  `@keyframes dsh-tgcf-breathe{0%,100%{opacity:.94}50%{opacity:1}}`,
  `${SCOPE}::before{animation:dsh-tgcf-breathe 26s ease-in-out infinite}`,
  `@keyframes dsh-tgcf-drift-a{0%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(46px,-30px) rotate(10deg)}100%{transform:translate(0,0) rotate(-8deg)}}`,
  `@keyframes dsh-tgcf-drift-b{0%{transform:translate(0,0) rotate(14deg)}50%{transform:translate(-38px,26px) rotate(-12deg)}100%{transform:translate(0,0) rotate(14deg)}}`,
  `${SCOPE} #root::before{content:"";position:fixed;left:8%;top:14%;width:56px;height:56px;z-index:-1;`
  + `background:url("${BUTTERFLY_SPRITE}") center/contain no-repeat;opacity:.22;animation:dsh-tgcf-drift-a 34s ease-in-out infinite;pointer-events:none}`,
  `${SCOPE} #root::after{content:"";position:fixed;right:11%;bottom:18%;width:40px;height:40px;z-index:-1;`
  + `background:url("${BUTTERFLY_SPRITE}") center/contain no-repeat;opacity:.16;animation:dsh-tgcf-drift-b 41s ease-in-out infinite;pointer-events:none}`,
  `@media (prefers-reduced-motion:reduce){${SCOPE}::before,${SCOPE} #root::before,${SCOPE} #root::after{animation:none}}`,
].join("\n");

/** Default panel glass colours (素白 / 墨黑) derived from the palette. */
function panelBase(lightMode, alpha) {
  return lightMode ? `rgba(255,252,246,${alpha})` : `rgba(24,16,16,${alpha})`;
}

/**
 * Sidebar presence above the content base (ruling #15), mirroring the
 * reference skins' deltas: openbmc and uefi both sit their sidebar fill at
 * bg-base +0.05 in the light theme and +0.17 in the dark theme, so the menu
 * column keeps readable contrast while the content area stays translucent.
 */
const SIDEBAR_DELTA = { light: 0.05, dark: 0.17 };

/**
 * Static identity palette since the personalization simplification (Q35):
 * accent/gold/bubbleColour stopped being editable fields, but the skin's
 * visual identity keeps the exact values that used to be catalog defaults.
 */
const PALETTE = {
  accent: { light: "#C3272B", dark: "#E0564A" },
  gold: { light: "#C9A227", dark: "#D4AF37" },
  bubble: { light: "#C3272B", dark: "#8E2A2F" },
};

export function createTgcfSkin(jsxRuntime) {
  const { jsx } = jsxRuntime;

  function TgcfMark({ size = 24 }) {
    return jsx("svg", {
      width: size, height: size, viewBox: "0 0 64 64", fill: "none",
      xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true",
      children: [
        jsx("rect", { x: "24", y: "6", width: "16", height: "6", rx: "2", fill: "#D4AF37" }),
        jsx("path", { d: "M32 12c-11 3-13 12-13 18 0 7 6 12 13 12s13-5 13-12c0-6-2-15-13-18z", fill: "#C3272B" }),
        jsx("path", { d: "M20 22h24M19 31h26M20 40h24", stroke: "#E8B84B", strokeWidth: "2", opacity: ".85" }),
        jsx("rect", { x: "24", y: "43", width: "16", height: "5", rx: "2", fill: "#D4AF37" }),
        jsx("path", { d: "M32 48v8", stroke: "#D4AF37", strokeWidth: "2.5" }),
      ],
    });
  }

  function TgcfName() {
    return jsx("span", {
      style: {
        fontWeight: 700,
        letterSpacing: "0.02em",
        background: "linear-gradient(120deg,#C9A227,#E8C56A 45%,#C3272B)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      },
      children: "天官赐福",
    });
  }

  const builtinAssets = {
    crimson: { mime: "image/webp", url: WALLPAPER_CRIMSON },
    pale: { mime: "image/webp", url: WALLPAPER_PALE },
    "lantern-favicon": { mime: "image/svg+xml", url: FAVICON_LANTERN },
  };

  function project(values, assets) {
    // Ruling #14: one translucency knob drives the panel tint, the wallpaper
    // scrim and the blur. Ruling #15 amendment — the knob's CONTRACT is the
    // full visual range: P=0 pure wallpaper, P=100 wallpaper fully hidden.
    // The scrim/blur therefore grow QUADRATICALLY (12·(P/100)² and
    // 30·(P/100)²): linear growth saturated the perceived effect by ~50%,
    // leaving the upper half of the slider feeling dead. Panel tint alpha
    // stays linear (it IS the requested percentage).
    const t = Math.min(1, Math.max(0, values.panelOpacity / 100));
    const alpha = t;
    // Sidebar fill rides ABOVE the content base by the reference-skin delta
    // (ruling #15): menu column stays readable, content stays translucent.
    // Rounded to points — 0.1 + 0.05 must never print as 0.15000000000000002.
    const sidebarAlpha = {
      light: Math.min(1, Math.round((alpha + SIDEBAR_DELTA.light) * 100) / 100),
      dark: Math.min(1, Math.round((alpha + SIDEBAR_DELTA.dark) * 100) / 100),
    };
    // Single-value scrim (Q35): one alpha drives both theme overlays; the
    // base tint stays per-theme (warm white veil / ink veil).
    const scrimAlpha = (Math.round(30 * t * t) / 100).toFixed(3);
    const blurPx = Math.round(12 * t * t);
    const scrimLight = `linear-gradient(rgba(255,246,234,${scrimAlpha}),rgba(255,246,234,${scrimAlpha}))`;
    const scrimDark = `linear-gradient(rgba(14,7,8,${scrimAlpha}),rgba(14,7,8,${scrimAlpha}))`;
    const wallpaperUrl = assets.wallpaper?.url ?? null;
    // The favicon field is gone (Q35): the lantern icon is a static skin asset.
    const faviconAsset = builtinAssets["lantern-favicon"];
    return {
      bodyAttribute: "dshTgcfSkin",
      slogans: values.slogan ?? null,
      titleBrand: "天官赐福", // static brand segment — the field was removed (v2.4.1 #5)
      favicon: { href: faviconAsset.url, mime: faviconAsset.mime },
      backdrop: {
        imageLight: wallpaperUrl === null ? null : `url("${wallpaperUrl}")`,
        imageDark: wallpaperUrl === null ? null : `url("${wallpaperUrl}")`,
        overlayLight: scrimLight,
        overlayDark: scrimDark,
        blur: blurPx,
      },
      tokenOverrides: {
        "--dsw-alias-brand-primary": PALETTE.accent,
        "--dsw-alias-brand-text": PALETTE.gold,
        "--dsw-alias-button-primary-fill": PALETTE.accent,
        "--dsw-alias-button-primary-hover": PALETTE.gold,
        "--dsw-alias-bg-base": { light: panelBase(true, alpha), dark: panelBase(false, alpha) },
        "--dsw-specific-sidebar-fill": { light: panelBase(true, sidebarAlpha.light), dark: panelBase(false, sidebarAlpha.dark) },
        // Floating layers (the switcher pop, menus) stay 较实 regardless of P,
        // but tinted with the skin family - 素白 light / 墨黑 dark - instead of
        // the host's neutral gray (ruling #16).
        "--dsw-alias-bg-overlay": { light: panelBase(true, 0.82), dark: panelBase(false, 0.88) },
        // Control states tint with the 朱红 family (ruling #16, mirroring the
        // openbmc/uefi alphas 0.08/0.14): hovers and the trigger chip stop
        // falling back to the host's neutral blue-gray.
        "--dsw-alias-interactive-bg-hover": { light: "rgba(195,39,43,0.08)", dark: "rgba(224,86,74,0.14)" },
        "--dsw-alias-interactive-bg-active": { light: "rgba(195,39,43,0.14)", dark: "rgba(224,86,74,0.20)" },
        "--dsw-alias-bg-module-platform": { light: "rgba(255,252,246,0.92)", dark: "rgba(24,16,16,0.92)" },
        "--dsw-specific-sidebar-nav-item-hover": { light: "rgba(255,252,246,0.6)", dark: "rgba(24,16,16,0.6)" },
        "--dsw-specific-sidebar-nav-item-active": { light: "rgba(255,252,246,0.9)", dark: "rgba(24,16,16,0.9)" },
        "--dsw-specific-bubble": PALETTE.bubble,
      },
      cssVariables: {
        // The panel-glass frost (static CSS consumes the var) rides the same
        // curve; same value both themes — frost is a translucency effect.
        "--dsh-tgcf-glass-blur": { light: `${blurPx}px`, dark: `${blurPx}px` },
      },
      staticCss: CSS,
      decorations: null,
    };
  }

  return {
    id: "tgcf",
    label: { zh: "天官赐福", en: "Heaven Official's Blessing" },
    description: {
      zh: "千灯引路 · 朱红鎏金 · 长夜同明",
      en: "A thousand lights · vermilion & gold",
    },
    bodyAttr: "dshTgcfSkin",
    Mark: TgcfMark,
    Name: TgcfName,
    favicon: FAVICON_LANTERN,
    faviconMime: "image/svg+xml",
    title: "天官赐福",
    css: CSS,
    // Legacy fallback path (projector layer-3 safety net) stays coherent:
    art: "",
    scrimLight: `url("${WALLPAPER_CRIMSON}")`,
    scrimDark: `url("${WALLPAPER_CRIMSON}")`,
    placeholderLight: `url("${WALLPAPER_CRIMSON}")`,
    placeholderDark: `url("${WALLPAPER_CRIMSON}")`,
    slogans: { zh: "百无禁忌", en: "No Taboos" },
    builtinAssets,
    project,
  };
}
