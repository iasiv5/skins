/**
 * 「凡人修仙传 · 美人志」— fan-made, non-official skin (factory-default skin
 * since its introduction; registered FIRST, see src/client/index.js).
 *
 * The 12 bundled wallpapers (4 group + 8 solo, generated
 * by scripts/build-meirenzhi-wallpapers.mjs) are AI-generated fan art the
 * product owner supplied for bundling — NOT official《凡人修仙传》material.
 * The dragon brand mark/favicon (golden dragon on a red rounded plate, per
 * the product owner's reference image) is an original code-drawn SVG; the
 * BEAUTY badge is rendered with HTML/CSS and the
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

// Mark: user-provided dragon plate PNG transcoded to WebP (128px, q90,
// green plate background padded) and inlined as a data URL.
// Name: 凡人修仙传 rendered as hand-drawn brush-stroke letterforms — original
// SVG strokes (2026-09-01 calligraphy reference, Plan B), no font dependency.
const MARK_URL = "data:image/webp;base64,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";

const NAME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 348 72">`
  + `<defs><linearGradient id="dsh-mrz-ink" x1="0" y1="0" x2="348" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#A87B2F"/><stop offset="0.45" stop-color="#D9B45C"/><stop offset="1" stop-color="#B8433F"/></linearGradient></defs>`
  + `<g stroke="url(#dsh-mrz-ink)" fill="none" stroke-linecap="round">`
  // 凡
  + `<g><path d="M16 12 C12 28 10 44 8 58" stroke-width="7"/>`
  + `<path d="M16 12 C26 8 38 8 46 12" stroke-width="5"/>`
  + `<path d="M46 12 C50 28 53 42 60 52" stroke-width="7"/></g>`
  // 人
  + `<g><path d="M78 12 C66 30 56 44 48 58" stroke-width="7"/>`
  + `<path d="M80 14 C92 28 104 42 116 52" stroke-width="7"/></g>`
  // 修
  + `<g><path d="M138 12 C135 30 134 46 135 62" stroke-width="6"/>`
  + `<path d="M148 24 C143 34 138 42 132 48" stroke-width="4"/>`
  + `<path d="M158 10 C156 30 155 48 155 64" stroke-width="5"/>`
  + `<path d="M166 14 C172 20 179 24 186 26" stroke-width="4"/>`
  + `<path d="M168 28 C174 24 180 22 187 20" stroke-width="4"/>`
  + `<path d="M176 22 C175 36 174 50 174 62" stroke-width="5.5"/>`
  + `<path d="M180 44 L192 40" stroke-width="2.5"/>`
  + `<path d="M179 51 L193 47" stroke-width="2.5"/>`
  + `<path d="M178 58 L194 54" stroke-width="2.5"/></g>`
  // 仙
  + `<g><path d="M212 12 C209 30 208 46 209 62" stroke-width="6"/>`
  + `<path d="M222 24 C217 34 212 42 206 48" stroke-width="4"/>`
  + `<path d="M234 26 C233 38 232 48 231 58" stroke-width="5"/>`
  + `<path d="M246 12 C245 30 244 46 244 60" stroke-width="7"/>`
  + `<path d="M258 28 C257 38 256 48 255 57" stroke-width="5"/>`
  + `<path d="M230 60 C242 57 256 57 264 59" stroke-width="5"/></g>`
  // 传
  + `<g><path d="M284 12 C281 30 280 46 281 62" stroke-width="6"/>`
  + `<path d="M294 24 C289 34 284 42 278 48" stroke-width="4"/>`
  + `<path d="M302 16 C310 13 318 13 326 15" stroke-width="5"/>`
  + `<path d="M304 26 C312 24 320 24 328 26" stroke-width="5"/>`
  + `<path d="M314 12 C313 32 312 48 312 62" stroke-width="6.5"/>`
  + `<path d="M298 56 C312 53 328 53 340 56" stroke-width="6"/></g>`
  + `</g>`
  // 点：凡 dot + 传 dot
  + `<g fill="url(#dsh-mrz-ink)">`
  + `<path d="M28 32 C33 30 37 32 37 36 C33 39 28 37 28 32 Z"/>`
  + `<path d="M324 34 C328 33 331 35 330 38 C327 39 324 37 324 34 Z"/>`
  + `</g>`
  + `</svg>`;
const NAME_URL = "data:image/svg+xml," + encodeURIComponent(NAME_SVG);

const CSS = [
  // 反色徽章（official HARNESS 反色语言，tgcf badge 同构）：亮=玄夜底雾白字，
  // 暗=雾白底玄夜字。#12121A/#FAF9F6 与面板底色族同源。
  `${SCOPE} .dsh-mrz-badge{display:inline-flex;align-items:center;background:#12121A;border-radius:4px;padding:0 5px;font-size:10px;line-height:16px;font-weight:600;letter-spacing:.08em;color:#FAF9F6}`,
  `body[data-dsh-meirenzhi-skin][data-ds-dark-theme] .dsh-mrz-badge{background:#FAF9F6;color:#12121A}`,
  // 用户气泡描边 + 轻投影（openbmc 同款泡泡边框：框出用户输入区）。哈希类
  // gdEzaW_bubble 随 conversation 插件版本构建，版本升级若失效仅影响描边
  // 装饰，token 填充不受影响。
  `${SCOPE} .gdEzaW_bubble{border:1px solid rgba(184, 67, 63, 0.38);box-shadow:0 1px 4px rgba(184, 67, 63, 0.10)}`,
  `body[data-dsh-meirenzhi-skin][data-ds-dark-theme] .gdEzaW_bubble{border-color:rgba(229, 138, 128, 0.38);box-shadow:0 1px 6px rgba(229, 138, 128, 0.10)}`,
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
    favicon: { href: MARK_URL, mime: "image/webp" },
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
    // Dragon mark rides a plain img so the bundled SVG data URL works in
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
    // 「凡人修仙传」hand-drawn brush letterforms (SVG data URL, gradient ink)
    // + 反色徽章 BEAUTY（tgcf badge 同构，亮暗反转由 CSS 的 .dsh-mrz-badge
    // 规则承担）。img 不依赖浏览器字体环境。
    return jsx("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        whiteSpace: "nowrap",
      },
      children: [
        jsx("img", {
          src: NAME_URL,
          alt: "凡人修仙传",
          style: { height: "30px", display: "block" },
          "aria-hidden": "true",
        }),
        jsx("span", { className: "dsh-mrz-badge", children: "BEAUTY" }),
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
    faviconMime: "image/webp",
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
