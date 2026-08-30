/**
 * 「天官赐福 · 百无禁忌」— fan-made, non-official skin.
 *
 * All artwork is original code-drawn SVG (no copyrighted assets); the
 * personalization contract lives in src/shared/personalization/catalog.js.
 * Effects are produced by `project()` (values → SkinEffects) and executed
 * by the generic runtime; this module never touches the DOM.
 */

const SCOPE = "body[data-dsh-tgcf-skin]";

function svgUrl(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s{2,}/g, " "))}`;
}

function lantern(x, y, scale, glow) {
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})">`
    + `<path d="M0 -66 q10 8 10 22 h-20 q0 -14 10 -22z" fill="#8E6B1F"/>`
    + `<ellipse cx="0" cy="0" rx="46" ry="60" fill="#C3272B"/>`
    + `<ellipse cx="0" cy="0" rx="46" ry="60" fill="url(#lantern-shade)"/>`
    + `<path d="M-44 -26 q44 -18 88 0 M-46 0 h92 M-44 26 q44 18 88 0" stroke="#E8B84B" stroke-width="2.5" fill="none" opacity=".8"/>`
    + `<rect x="-12" y="-66" width="24" height="10" rx="3" fill="#D4AF37"/>`
    + `<rect x="-12" y="56" width="24" height="9" rx="3" fill="#D4AF37"/>`
    + `<path d="M0 65 v34" stroke="#D4AF37" stroke-width="2.5"/>`
    + `<path d="M-7 100 l7 12 7 -12" fill="none" stroke="#D4AF37" stroke-width="2.5"/>`
    + (glow ? `<circle cx="0" cy="0" r="86" fill="url(#lantern-glow)"/>` : "")
    + `</g>`
  );
}

function goldCloud(x, y, scale, opacity) {
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="#D4AF37" stroke-width="3" stroke-linecap="round" opacity="${opacity}">`
    + `<path d="M0 0 q18 -22 44 -12 q10 -26 42 -20 q34 -6 44 18 q30 -2 34 24 q2 18 -18 24 h-128 q-24 -8 -18 -34z"/>`
    + `<path d="M70 34 q22 -12 40 0" opacity=".7"/>`
    + `</g>`
  );
}

const WALLPAPER_LANTERNS = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">`
  + `<defs>`
  + `<linearGradient id="ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#170c0e"/><stop offset=".55" stop-color="#241014"/><stop offset="1" stop-color="#2E1116"/></linearGradient>`
  + `<radialGradient id="lantern-glow"><stop offset="0" stop-color="#E0564A" stop-opacity=".28"/><stop offset="1" stop-color="#E0564A" stop-opacity="0"/></radialGradient>`
  + `<linearGradient id="lantern-shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>`
  + `</defs>`
  + `<rect width="1600" height="1000" fill="url(#ink)"/>`
  + `<g fill="#E8CCA0"><circle cx="180" cy="120" r="1.4"/><circle cx="520" cy="80" r="1.1"/><circle cx="980" cy="150" r="1.3"/><circle cx="1320" cy="90" r="1.1"/><circle cx="1480" cy="240" r="1.2"/><circle cx="260" cy="320" r="1"/><circle cx="1180" cy="420" r="1.2"/><circle cx="720" cy="60" r="1"/></g>`
  + goldCloud(980, 200, 1.15, 0.5)
  + goldCloud(240, 420, 0.85, 0.38)
  + goldCloud(1120, 760, 1.0, 0.3)
  + lantern(300, 260, 1.0, true)
  + lantern(760, 180, 1.35, true)
  + lantern(1240, 300, 0.9, true)
  + lantern(1010, 620, 0.7, false)
  + lantern(180, 740, 0.55, false)
  + `</svg>`,
);

function butterfly(x, y, scale, rotate, opacity) {
  return (
    `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})" opacity="${opacity}">`
    + `<path d="M0 0 C-14 -22 -40 -26 -44 -8 C-46 6 -24 12 0 6 C24 12 46 6 44 -8 C40 -26 14 -22 0 0z" fill="url(#wing)"/>`
    + `<path d="M0 0 C-10 12 -26 16 -28 6 C-29 -1 -14 -2 0 4 C14 -2 29 -1 28 6 C26 16 10 12 0 0z" fill="url(#wing)" opacity=".8"/>`
    + `<ellipse cx="0" cy="2" rx="2.2" ry="9" fill="#cfd6e4"/>`
    + `</g>`
  );
}

const WALLPAPER_BUTTERFLIES = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">`
  + `<defs>`
  + `<linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0912"/><stop offset="1" stop-color="#191021"/></linearGradient>`
  + `<linearGradient id="wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe6f2"/><stop offset=".5" stop-color="#aab6cf"/><stop offset="1" stop-color="#7f8cab"/></linearGradient>`
  + `</defs>`
  + `<rect width="1600" height="1000" fill="url(#night)"/>`
  + butterfly(260, 220, 2.2, -18, 0.95)
  + butterfly(680, 140, 1.4, 24, 0.6)
  + butterfly(1120, 320, 2.8, -8, 0.9)
  + butterfly(1420, 620, 1.8, 40, 0.55)
  + butterfly(420, 560, 1.1, 12, 0.4)
  + butterfly(860, 720, 2.0, -30, 0.7)
  + butterfly(180, 820, 1.3, 55, 0.35)
  + butterfly(1240, 840, 1.0, -45, 0.3)
  + `</svg>`,
);

const WALLPAPER_MOUNTAINS = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">`
  + `<defs><linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF7EE"/><stop offset="1" stop-color="#F1E9D8"/></linearGradient></defs>`
  + `<rect width="1600" height="1000" fill="url(#mist)"/>`
  + `<circle cx="1220" cy="250" r="90" fill="none" stroke="#C9A227" stroke-width="3" opacity=".8"/>`
  + `<circle cx="1220" cy="250" r="104" fill="none" stroke="#C9A227" stroke-width="1.5" opacity=".4"/>`
  + `<path d="M0 700 L180 560 L340 660 L520 480 L700 640 L860 540 L1040 680 L1600 500" fill="none" stroke="#B8860B" stroke-width="2" opacity=".35"/>`
  + `<path d="M0 780 L220 660 L430 760 L640 600 L880 740 L1100 620 L1320 730 L1600 620" fill="none" stroke="#C9A227" stroke-width="2.5" opacity=".6"/>`
  + `<path d="M0 860 L260 760 L520 850 L780 700 L1040 830 L1300 720 L1600 810 L1600 1000 L0 1000z" fill="#EFE5CE"/>`
  + `<path d="M640 600 l30 -52 30 52 M880 740 l26 -44 26 44 M220 660 l24 -40 24 40" fill="none" stroke="#C9A227" stroke-width="2" opacity=".5"/>`
  + `<path d="M100 520 q120 -36 260 0 M1100 420 q140 -30 300 6" stroke="#C9A227" stroke-width="1.5" fill="none" opacity=".28"/>`
  + `</svg>`,
);

function mapleLeaf(x, y, scale, rotate, opacity) {
  return (
    `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})" opacity="${opacity}">`
    + `<path d="M0 -30 C6 -20 14 -18 16 -10 C26 -14 32 -8 30 0 C38 4 36 14 26 16 C24 26 12 28 6 20 C4 28 -4 28 -6 20 C-12 28 -24 26 -26 16 C-36 14 -38 4 -30 0 C-32 -8 -26 -14 -16 -10 C-14 -18 -6 -20 0 -30z" fill="#D2453E"/>`
    + `<path d="M0 20 v14" stroke="#8E2A2F" stroke-width="2"/>`
    + `</g>`
  );
}

const WALLPAPER_MAPLES = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">`
  + `<defs><linearGradient id="mbleed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6E1120"/><stop offset=".6" stop-color="#A22230"/><stop offset="1" stop-color="#C23B2B"/></linearGradient></defs>`
  + `<rect width="1600" height="1000" fill="url(#mbleed)"/>`
  + mapleLeaf(220, 180, 1.6, 20, 0.9)
  + mapleLeaf(540, 340, 1.1, -35, 0.6)
  + mapleLeaf(880, 140, 2.0, 50, 0.85)
  + mapleLeaf(1240, 300, 1.3, -15, 0.7)
  + mapleLeaf(360, 620, 1.8, 65, 0.75)
  + mapleLeaf(760, 760, 1.0, 10, 0.5)
  + mapleLeaf(1080, 560, 2.2, -50, 0.8)
  + mapleLeaf(1420, 700, 1.2, 30, 0.55)
  + mapleLeaf(150, 860, 0.9, -20, 0.4)
  + mapleLeaf(1320, 880, 1.5, 40, 0.6)
  + `</svg>`,
);

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
  // backdrop pseudo layers) — fixed 12px per design §5.
  `${SCOPE} #root{backdrop-filter:blur(12px)}`,
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
    lanterns: { mime: "image/svg+xml", url: WALLPAPER_LANTERNS },
    butterflies: { mime: "image/svg+xml", url: WALLPAPER_BUTTERFLIES },
    mountains: { mime: "image/svg+xml", url: WALLPAPER_MOUNTAINS },
    maples: { mime: "image/svg+xml", url: WALLPAPER_MAPLES },
    "lantern-favicon": { mime: "image/svg+xml", url: FAVICON_LANTERN },
  };

  function project(values, assets) {
    const alpha = Math.min(1, Math.max(0.3, values.panelOpacity / 100));
    // Single-value scrim (Q35): one alpha drives both theme overlays; the
    // base tint stays per-theme (warm white veil / ink veil).
    const scrimAlpha = (values.scrim / 100).toFixed(3);
    const scrimLight = `linear-gradient(rgba(255,246,234,${scrimAlpha}),rgba(255,246,234,${scrimAlpha}))`;
    const scrimDark = `linear-gradient(rgba(14,7,8,${scrimAlpha}),rgba(14,7,8,${scrimAlpha}))`;
    const wallpaperUrl = assets.wallpaper?.url ?? null;
    // The favicon field is gone (Q35): the lantern icon is a static skin asset.
    const faviconAsset = builtinAssets["lantern-favicon"];
    return {
      bodyAttribute: "dshTgcfSkin",
      slogans: values.slogan ?? null,
      titleBrand: values.titleBrand ?? null,
      favicon: { href: faviconAsset.url, mime: faviconAsset.mime },
      backdrop: {
        imageLight: wallpaperUrl === null ? null : `url("${wallpaperUrl}")`,
        imageDark: wallpaperUrl === null ? null : `url("${wallpaperUrl}")`,
        overlayLight: scrimLight,
        overlayDark: scrimDark,
        blur: values.blur,
      },
      tokenOverrides: {
        "--dsw-alias-brand-primary": PALETTE.accent,
        "--dsw-alias-brand-text": PALETTE.gold,
        "--dsw-alias-button-primary-fill": PALETTE.accent,
        "--dsw-alias-button-primary-hover": PALETTE.gold,
        "--dsw-alias-bg-base": { light: panelBase(true, alpha), dark: panelBase(false, alpha) },
        "--dsw-specific-sidebar-fill": { light: panelBase(true, alpha), dark: panelBase(false, alpha) },
        "--dsw-specific-bubble": PALETTE.bubble,
      },
      cssVariables: null,
      staticCss: CSS,
      decorations: null,
    };
  }

  return {
    id: "tgcf",
    label: { zh: "天官赐福 · 百无禁忌", en: "Heaven Official's Blessing" },
    description: {
      zh: "千灯引路 · 朱红鎏金 · 长夜同明（非官方粉丝作品）",
      en: "A thousand lights · vermilion & gold (unofficial fan work)",
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
    scrimLight: `url("${WALLPAPER_LANTERNS}")`,
    scrimDark: `url("${WALLPAPER_LANTERNS}")`,
    placeholderLight: `url("${WALLPAPER_LANTERNS}")`,
    placeholderDark: `url("${WALLPAPER_LANTERNS}")`,
    slogans: { zh: "千灯引路 · 长夜同明", en: "A thousand lights before the dawn" },
    builtinAssets,
    project,
  };
}
