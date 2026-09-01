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
      style: { display: "block", borderRadius: "2px" },
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
