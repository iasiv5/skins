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

// Mark: user-provided 掌天瓶 icon PNG transcoded to WebP (96px, q75) and
// inlined as a data URL (2026-09-01 ruling — dragon plate reverted).
const MARK_URL = "data:image/webp;base64,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";

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
    // 掌天瓶 icon rides a plain img so the bundled WebP data URL works in
    // every slot that renders it; alt="" + aria-hidden keep it decorative.
    return jsx("img", {
      src: MARK_URL,
      alt: "",
      width: size,
      height: size,
      className,
      style: { display: "block", borderRadius: "2px", filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.30))" },
      "aria-hidden": "true",
    });
  }

  function MeiRenZhiName() {
    // 「凡人修仙传」鎏金→绯红渐变裁字（原始方案；行楷字体栈与手绘 SVG 字形
    // 两版均被产品主人否决——观感不足/不可读，2026-09-01 回归此方案）+
    // 反色徽章 BEAUTY（tgcf badge 同构，亮暗反转由 CSS 的 .dsh-mrz-badge
    // 规则承担）。
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
