/**
 * 「凡人修仙传 · 美人志」— fan-made, non-official skin (factory-default skin
 * since its introduction; registered FIRST, see src/client/index.js).
 *
 * The 12 bundled wallpapers (4 group + 8 solo, generated
 * by scripts/build-meirenzhi-wallpapers.mjs) are AI-generated fan art the
 * product owner supplied for bundling — NOT official《凡人修仙传》material.
 * The 掌天瓶 (mysterious little bottle) brand mark/favicon is an original
 * code-drawn SVG; the 美人志 badge is rendered with HTML/CSS and the
 * fireflies with CSS pseudo-elements + radial gradients. The personalization
 * contract lives in src/shared/personalization/catalog.js. Effects are
 * produced by `project()` (values → SkinEffects) and executed by the generic
 * runtime; this module never touches the DOM.
 */

import {
  WALLPAPER_MEINING,
  WALLPAPER_MUPEILING,
  WALLPAPER_NANGONGQUE,
  WALLPAPER_NANGONGWAN,
  WALLPAPER_SONGYU,
  WALLPAPER_TAOYUAN,
  WALLPAPER_YANRUYAN,
  WALLPAPER_YINYUE,
  WALLPAPER_YUANFENG,
  WALLPAPER_YUEYE,
  WALLPAPER_YUNTAI,
  WALLPAPER_ZILING,
} from "./wallpapers.js";

const SCOPE = "body[data-dsh-meirenzhi-skin]";

// 掌天瓶配色基准（产品主人提供的绿瓶图）：深绿描边 + 玉绿渐变瓶身 +
// 浅绿叶脉纹 + 底部一点鎏金反光；背景金色光线不入画（24px 噪声）。
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<defs><linearGradient id="dsh-mrz-jade" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#BFE3A8"/><stop offset="1" stop-color="#6FAF7C"/>`
  + `</linearGradient></defs>`
  + `<rect x="26.5" y="5" width="11" height="7" rx="2.4" fill="#8C6B3F" stroke="#2E6B3E" stroke-width="1.4"/>`
  + `<path d="M27 12 h10 l1.2 7.2 c6.4 2.6 10.8 8.8 10.8 16 C49 44.6 41.4 52 32 52 s-17-7.4-17-16.8 c0-7.2 4.4-13.4 10.8-16 L27 12 Z" fill="url(#dsh-mrz-jade)" stroke="#2E6B3E" stroke-width="2" stroke-linejoin="round"/>`
  + `<path d="M32 20 c-4.2 4.2 -6.2 8.4 -6.2 13.6 M32 20 c4.2 4.2 6.2 8.4 6.2 13.6 M32 20 v20" fill="none" stroke="#DFF2D0" stroke-width="1.6" stroke-linecap="round"/>`
  + `<path d="M24.5 52 h15" stroke="#2E6B3E" stroke-width="2" stroke-linecap="round"/>`
  + `<path d="M23 46.5 c2.9 1.9 5.9 2.8 9 2.8 s6.1-0.9 9-2.8" fill="none" stroke="#D9B45C" stroke-width="1.6" stroke-linecap="round"/>`
  + `</svg>`;
const MARK_URL = "data:image/svg+xml," + encodeURIComponent(MARK_SVG);

const CSS = [
  // 反色徽章（official HARNESS 反色语言，tgcf badge 同构）：亮=玄夜底雾白字，
  // 暗=雾白底玄夜字。#12121A/#FAF9F6 与面板底色族同源。
  `${SCOPE} .dsh-mrz-badge{display:inline-flex;align-items:center;background:#12121A;border-radius:4px;padding:0 5px;font-size:10px;line-height:16px;font-weight:600;letter-spacing:.08em;color:#FAF9F6}`,
  `body[data-dsh-meirenzhi-skin][data-ds-dark-theme] .dsh-mrz-badge{background:#FAF9F6;color:#12121A}`,
  // Ambient motion: a slow glow-breath riding the runtime's wallpaper ::before
  // layer + two drifting fireflies on the #root pseudo budget (same shape and
  // cost as the tgcf butterflies); prefers-reduced-motion kills all of it.
  `@keyframes dsh-mrz-breathe{0%,100%{opacity:.94}50%{opacity:1}}`,
  `${SCOPE}::before{animation:dsh-mrz-breathe 26s ease-in-out infinite}`,
  `@keyframes dsh-mrz-drift-a{0%{transform:translate(0,0)}50%{transform:translate(42px,-34px)}100%{transform:translate(0,0)}}`,
  `@keyframes dsh-mrz-drift-b{0%{transform:translate(0,0)}50%{transform:translate(-46px,28px)}100%{transform:translate(0,0)}}`,
  `${SCOPE} #root::before{content:"";position:fixed;left:13%;top:19%;width:9px;height:9px;z-index:-1;`
    + `background:radial-gradient(circle, rgba(217,180,92,.95) 0%, rgba(217,180,92,0) 70%);opacity:.16;animation:dsh-mrz-drift-a 38s ease-in-out infinite;pointer-events:none}`,
  `${SCOPE} #root::after{content:"";position:fixed;right:17%;bottom:23%;width:14px;height:14px;z-index:-1;`
    + `background:radial-gradient(circle, rgba(250,249,246,.9) 0%, rgba(250,249,246,0) 70%);opacity:.12;animation:dsh-mrz-drift-b 47s ease-in-out infinite;pointer-events:none}`,
  `@media (prefers-reduced-motion:reduce){${SCOPE}::before,${SCOPE} #root::before,${SCOPE} #root::after{animation:none}}`,
].join("\n");

/** Panel glass: warm mist white (light) / deep night blue-violet (dark). */
function panelBase(mode, alpha) {
  return mode === "light" ? `rgba(250, 249, 246, ${alpha})` : `rgba(18, 18, 26, ${alpha})`;
}

// 随动族 rgb（面板底 / 纱 / 浮层），固定两位小数 alpha 由 project() 计算。
const BASE_RGB = { light: "250, 249, 246", dark: "18, 18, 26" };

const GLASS_RULE = `${SCOPE} [id="root"]{backdrop-filter:blur(var(--dsh-mrz-glass-blur,0px))}`;

const SLOGANS = { zh: "风起凡尘 · 红颜问道", en: "From mortal dust, immortals bloom" };

const builtinAssets = {
  yuntai: { mime: "image/webp", url: WALLPAPER_YUNTAI },
  yuanfeng: { mime: "image/webp", url: WALLPAPER_YUANFENG },
  taoyuan: { mime: "image/webp", url: WALLPAPER_TAOYUAN },
  yueye: { mime: "image/webp", url: WALLPAPER_YUEYE },
  mupeiling: { mime: "image/webp", url: WALLPAPER_MUPEILING },
  ziling: { mime: "image/webp", url: WALLPAPER_ZILING },
  nangongwan: { mime: "image/webp", url: WALLPAPER_NANGONGWAN },
  nangongque: { mime: "image/webp", url: WALLPAPER_NANGONGQUE },
  yinyue: { mime: "image/webp", url: WALLPAPER_YINYUE },
  meining: { mime: "image/webp", url: WALLPAPER_MEINING },
  songyu: { mime: "image/webp", url: WALLPAPER_SONGYU },
  yanruyan: { mime: "image/webp", url: WALLPAPER_YANRUYAN },
};

/**
 * 投影数学（tgcf 二次曲线，锚点 P=35 = catalog 出厂默认）：一个通透度旋钮
 * 联动面板底色（α 线性）、壁纸纱（30·t²）与模糊（12·t²）；P=0 纯壁纸完全
 * 可见，P=100 随动族钳 1.00。侧栏增量沿用 ruling #15 惯例（亮 +0.05 /
 * 暗 +0.17）；composer/selector 沿 tgcf 结构（亮 +0.05/暗 +0.10、亮 +0/暗 +0.05）。
 */
function project(values, assets) {
  const t = Math.min(1, Math.max(0, values.panelOpacity / 100));
  const a2 = (x) => Math.min(1, x).toFixed(2);

  const riding = {
    "--dsw-alias-bg-base": { light: t, dark: t },
    "--dsw-specific-sidebar-fill": { light: t + 0.05, dark: t + 0.17 },
    "--dsw-alias-bg-module-platform": { light: t, dark: t + 0.05 },
    "--dsw-specific-input-major": { light: t + 0.05, dark: t + 0.1 },
  };
  const tokenOverrides = {
    // 常量族：品牌绯红 × 鎏金、浮层「较实」、控件态、导航态（设计定案 §视觉系统）。
    // 用户气泡（产品主人裁决，参照 openbmc/uefi 双 token 结构）：浅色态=品牌
    // 绯红轻透纱（深字，融进暖雾白面板）；深色态=玄夜面板族较实底（亮字）。
    // 不再用饱和红实底，避免会话区色彩疲劳。
    "--dsw-alias-brand-primary": { light: "#B8433F", dark: "#E58A80" },
    "--dsw-alias-brand-text": { light: "#A87B2F", dark: "#D9B45C" },
    "--dsw-alias-button-primary-fill": { light: "#B8433F", dark: "#E58A80" },
    "--dsw-alias-button-primary-hover": { light: "#A87B2F", dark: "#D9B45C" },
    "--dsw-alias-bg-overlay": { light: "rgba(252, 250, 246, 0.85)", dark: "rgba(24, 24, 34, 0.88)" },
    "--dsw-alias-interactive-bg-hover": { light: "rgba(184, 67, 63, 0.08)", dark: "rgba(229, 138, 128, 0.14)" },
    "--dsw-alias-interactive-bg-active": { light: "rgba(184, 67, 63, 0.14)", dark: "rgba(229, 138, 128, 0.20)" },
    "--dsw-specific-sidebar-nav-item-hover": { light: "rgba(250, 249, 246, 0.6)", dark: "rgba(28, 28, 40, 0.6)" },
    "--dsw-specific-sidebar-nav-item-active": { light: "rgba(250, 249, 246, 0.9)", dark: "rgba(28, 28, 40, 0.9)" },
    "--dsw-specific-bubble": { light: "rgba(184, 67, 63, 0.10)", dark: "rgba(24, 24, 34, 0.90)" },
    "--dsw-specific-bubble-highlight": { light: "rgba(184, 67, 63, 0.18)", dark: "rgba(40, 40, 56, 0.92)" },
  };
  for (const [key, modes] of Object.entries(riding)) {
    tokenOverrides[key] = {
      light: `rgba(${BASE_RGB.light}, ${a2(modes.light)})`,
      dark: `rgba(${BASE_RGB.dark}, ${a2(modes.dark)})`,
    };
  }

  // 纱：单一 scrim 值驱动明暗两层；底色分暖雾白 / 玄夜。
  const s = (Math.round(30 * t * t) / 100).toFixed(3);
  const scrimLight = `linear-gradient(rgba(252, 250, 246, ${s}) 0%, rgba(252, 250, 246, ${s}) 100%)`;
  const scrimDark = `linear-gradient(rgba(16, 16, 26, ${s}) 0%, rgba(16, 16, 26, ${s}) 100%)`;
  const blurPx = Math.round(12 * t * t);

  // builtin/user 引用已由 projector/assetResolver 解析成 URL，这里统一消费。
  const wallpaperUrl = assets?.wallpaper?.url ?? null;
  const imageLight = wallpaperUrl === null ? null : `url("${wallpaperUrl}")`;
  const imageDark = wallpaperUrl === null ? null : `url("${wallpaperUrl}")`;

  return {
    bodyAttribute: "dshMeirenzhiSkin",
    slogans: values.slogan ?? SLOGANS,
    titleBrand: "美人志",
    favicon: { href: MARK_URL, mime: "image/svg+xml" },
    backdrop: { imageLight, imageDark, overlayLight: scrimLight, overlayDark: scrimDark, blur: blurPx },
    tokenOverrides,
    cssVariables: blurPx > 0 ? { "--dsh-mrz-glass-blur": { light: `${blurPx}px`, dark: `${blurPx}px` } } : null,
    staticCss: blurPx > 0 ? CSS + "\n" + GLASS_RULE : CSS,
    decorations: null,
  };
}

export function createMeirenzhiSkin(jsxRuntime) {
  const { jsx } = jsxRuntime;

  function MeiRenZhiMark({ size = 24, className }) {
    // 掌天瓶 mark rides a plain img so the bundled SVG data URL works in
    // every slot that renders it; alt="" + aria-hidden keep it decorative.
    return jsx("img", {
      src: MARK_URL,
      alt: "",
      width: size,
      height: size,
      className,
      style: { display: "block", borderRadius: "2px" },
      "aria-hidden": "true",
    });
  }

  function MeiRenZhiName() {
    // 「凡人修仙传」鎏金→绯红渐变字 + 反色徽章「美人志」（tgcf badge 同构，
    // 亮暗反转由 CSS 的 .dsh-mrz-badge 规则承担）。
    return jsx("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontWeight: 700,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      },
      children: [
        jsx("span", {
          style: {
            background: "linear-gradient(120deg, #A87B2F, #D9B45C 45%, #B8433F)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          },
          children: "凡人修仙传",
        }),
        jsx("span", { className: "dsh-mrz-badge", children: "美人志" }),
      ],
    });
  }

  return {
    id: "meirenzhi",
    label: { zh: "凡人修仙传 · 美人志", en: "Mortal's Journey · Beauty Chronicle" },
    description: {
      zh: "云鬓花颜 · 霞衣夜月 · 凡尘问道",
      en: "Moonlit silks · crimson & gold · mortal path",
    },
    bodyAttr: "dshMeirenzhiSkin",
    Mark: MeiRenZhiMark,
    Name: MeiRenZhiName,
    favicon: MARK_URL,
    faviconMime: "image/svg+xml",
    title: "美人志",
    css: CSS,
    // Legacy fallback path (projector layer-3 safety net) stays coherent,
    // mirroring the tgcf pattern: same builtin art as the factory wallpaper.
    art: "",
    scrimLight: `url("${WALLPAPER_YUNTAI}")`,
    scrimDark: `url("${WALLPAPER_YUNTAI}")`,
    placeholderLight: `url("${WALLPAPER_YUNTAI}")`,
    placeholderDark: `url("${WALLPAPER_YUNTAI}")`,
    slogans: SLOGANS,
    builtinAssets,
    project,
  };
}
