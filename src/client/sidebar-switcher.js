import { createUpdatePanel } from "./update-panel.js";
import { DICTS, NS, formatTemplate } from "./dicts.js";
import { createPersonalizationPanel } from "./personalization/panel.js";
import { getSkinSchema } from "../shared/personalization/catalog.js";

const TAG_ID = "dsh-skins/sidebar.css";

/** The shell width/height animation beat (keep in sync with the CSS below). */
const SWEEP_MS = 200;

/**
 * Height sweep across gear expand/collapse/retarget (field issue #13). The
 * shell's height is content-driven (auto → auto), so `transition: height`
 * alone never interpolates and every toggle snapped the box to its new
 * height in a single frame — on expansion the whole list column jumped up
 * while the width was still animating (the visible "bounce"; collapse only
 * masked it because there the snap rode the width motion in the same beat).
 * Pin the pre-toggle height, then release it into a height transition toward
 * the post-toggle height so the box grows on the SAME beat as its width.
 * Returns a cleanup that releases the pin (safe to call twice).
 */
export function sweepShellHeight(shell, { from, maxHeight, duration = SWEEP_MS } = {}) {
  if (!shell || typeof from !== "number" || !Number.isFinite(from)) return () => {};
  if (typeof shell.getBoundingClientRect !== "function") return () => {};
  const reduced = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return () => {};
  // Post-commit box: the clamped layout height and the unclamped content
  // extent — the sweep's target is the clamp ceiling, not the content.
  const rect = shell.getBoundingClientRect();
  const content = Math.max(rect.height, shell.scrollHeight || 0);
  const target = typeof maxHeight === "number" ? Math.min(content, maxHeight) : content;
  if (!Number.isFinite(target) || Math.abs(target - from) < 1) return () => {};
  const release = () => {
    shell.style.height = "";
    shell.style.transition = "";
    shell.style.overflowY = "";
  };
  // The inline transition REPLACES the stylesheet's width-only transition —
  // it must restate width, or the box would snap horizontally mid-sweep.
  shell.style.transition = `width ${duration}ms ease-out, height ${duration}ms ease-out`;
  shell.style.height = `${from}px`;
  shell.style.overflowY = "hidden"; // no transient scrollbar while clamped
  void shell.offsetHeight; // commit the pin as the transition's from-value
  shell.style.height = `${target}px`;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    shell.removeEventListener?.("transitionend", onEnd);
    release();
  };
  const onEnd = (event) => { if (event?.propertyName === "height") finish(); };
  const timer = setTimeout(finish, duration + 60); // transitionend can be eaten
  shell.addEventListener?.("transitionend", onEnd);
  return finish;
}
const THEME_CHOICES = [
  { id: "light", labelKey: "appearance.light" },
  { id: "dark", labelKey: "appearance.dark" },
  { id: "system", labelKey: "appearance.system" },
];

const CSS = [
  '[data-slot="sidebar.footer.action"]{display:flex!important;flex-direction:column;width:100%;min-width:0}',
  '[data-slot="sidebar.footer.action"]>*{flex:none;min-width:0}',
  '.dsh-skins-switcher-wrap{width:100%}',
  '.dsh-skins-switcher-wrap.rail{display:flex;justify-content:center}',
  '.dsh-skins-switcher-btn{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:4px -2px;padding:0 10px 0 8px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;cursor:pointer;overflow:hidden}',
  '.dsh-skins-switcher-wrap.rail .dsh-skins-switcher-btn{width:36px;height:36px;margin:8px 0 10px;padding:0;justify-content:center;border-radius:50%;gap:0}',
  '.dsh-skins-switcher-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.dsh-skins-switcher-btn.on,.dsh-skins-switcher-btn[aria-expanded=true]{background:var(--dsw-specific-sidebar-nav-item-active)}',
  '.dsh-skins-switcher-btn svg{flex:none;width:16px;height:16px}',
  '.dsh-skins-switcher-wrap.rail .dsh-skins-switcher-btn svg{width:18px;height:18px}',
  '.dsh-skins-switcher-btn span{white-space:nowrap;overflow:hidden}',
  '.dsh-skins-pop{position:fixed;z-index:60;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;width:min(390px,calc(100vw - 24px));max-height:calc(100vh - 24px);padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv3,0 8px 24px rgba(0,0,0,.14));overflow-y:auto;transition:width .2s ease-out}',
  '.dsh-skins-pop-title{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);padding:0 4px}',
  '.dsh-skins-theme-grid{display:flex;align-items:stretch;gap:8px}',
  '.dsh-skins-theme-card{box-sizing:border-box;display:flex;flex:1;min-width:0;height:72px;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px 5px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}',
  '.dsh-skins-theme-card:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.dsh-skins-theme-card-on,.dsh-skins-theme-card-on:hover{border-color:var(--dsw-static-neutral-bluish-400);background:var(--dsw-alias-bg-module-platform)}',
  '.dsh-skins-theme-card svg{width:18px;height:18px;flex:none}',
  '.dsh-skins-pop-divider{height:1px;margin:4px 0;background:var(--dsw-alias-border-l2)}',
  '.dsh-skins-pop-card{box-sizing:border-box;display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;width:100%;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}',
  '.dsh-skins-pop-card:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.dsh-skins-pop-card-on,.dsh-skins-pop-card-on:hover{border-color:var(--dsw-static-neutral-bluish-400);background:var(--dsw-alias-bg-module-platform)}',
  '.dsh-skins-pop-card-label{font-size:14px;line-height:20px;font-weight:500}',
  '.dsh-skins-pop-card-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
  '.dsh-skins-update-row{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px;padding:12px 4px 0;border-top:1px solid var(--dsw-alias-border-l2);font-size:12px;line-height:17px}',
  '.dsh-skins-update-row-muted{display:block;min-width:0;color:var(--dsw-alias-label-secondary,#5f6368);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.dsh-skins-update-copy{display:flex;min-width:0;flex:1;flex-direction:column;align-items:flex-start;gap:2px;color:var(--dsw-alias-label-secondary)}',
  '.dsh-skins-update-copy strong{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}',
  '.dsh-skins-update-copy a{color:var(--dsw-alias-brand-text);text-decoration:none}',
  '.dsh-skins-update-copy a:hover{text-decoration:underline}',
  '.dsh-skins-update-actions{display:flex;flex:none;align-items:center;gap:6px}',
  '.dsh-skins-update-actions button,.dsh-skins-update-error>button{height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}',
  '.dsh-skins-update-actions button:hover,.dsh-skins-update-error>button:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.dsh-skins-update-actions button:disabled{opacity:.55;cursor:default}',
  '.dsh-skins-update-error,.dsh-skins-update-error-text{color:var(--dsw-alias-error-text,var(--dsw-static-red-500,#d33))}',
  '.dsh-skins-update-spinner{width:16px;height:16px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:dsh-skins-spin .8s linear infinite}',
  '@keyframes dsh-skins-spin{to{transform:rotate(360deg)}}',
  '@media (prefers-reduced-motion:reduce){.dsh-skins-update-spinner{animation:none}}',
  // -- personalization gear + panel -------------------------------------------
  '.dsh-skins-pop-card-row{display:flex;width:100%;min-width:0;gap:6px;align-items:stretch}',
  '.dsh-skins-pop-card-row .dsh-skins-pop-card{flex:1;min-width:0}',
  '.dsh-skins-pz-gear{position:relative;flex:none;align-self:center;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:.75;transition:opacity .15s}',
  '.dsh-skins-pz-gear:hover,.dsh-skins-pz-gear:focus-visible,.dsh-skins-pz-gear.touch{opacity:1;border-color:var(--dsw-alias-border-l2);background:var(--dsh-alias-interactive-bg-hover)}',
  '.dsh-skins-pz-gear svg{width:16px;height:16px}',
  // -- combined shell (Q44/Q46): list column + docked panel column ----------
  '.dsh-skins-pop.dsh-skins-wide{flex-direction:row;align-items:stretch;width:min(1105px,calc(100vw - 24px))}',
  '.dsh-skins-pop-main{display:flex;flex-direction:column;gap:8px;min-width:0;width:360px;flex:none}',
  '.dsh-skins-pop.dsh-skins-wide .dsh-skins-pop-main{flex:0 0 360px}',
  '.dsh-skins-pz-panel{flex:0 1 700px;min-width:0;display:flex;flex-direction:column;gap:10px;padding-left:14px;border-left:1px solid var(--dsw-alias-border-l2);overflow-x:hidden;transform:translateX(16px);opacity:0;animation:dsh-skins-pz-in .2s ease-out forwards}',
  '@keyframes dsh-skins-pz-in{to{transform:none;opacity:1}}',
  '@media (prefers-reduced-motion:reduce){.dsh-skins-pz-panel{animation:none;transform:none;opacity:1}.dsh-skins-pop{transition:none}}',
  '@media (max-width:904px){.dsh-skins-pop.dsh-skins-wide{flex-direction:column;width:min(390px,calc(100vw - 24px))}.dsh-skins-pz-panel{flex-basis:auto;padding-left:0;border-left:0;border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px;transform:translateY(12px)}.dsh-skins-pop.dsh-skins-wide .dsh-skins-pz-panel{overflow-y:visible}}',
  '.dsh-skins-pz{display:flex;flex-direction:column;gap:10px}',
  '.dsh-skins-pz-head{display:flex;align-items:center;gap:8px}',
  '.dsh-skins-pz-head .dsh-skins-pop-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;outline:none}',
  '.dsh-skins-pz-row{display:flex;flex-direction:column;gap:6px}',
  '.dsh-skins-pz-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);font-weight:500}',
  '.dsh-skins-pz-fields{display:flex;flex-direction:column;gap:6px}',
  '.dsh-skins-pz-colors{flex-direction:row;gap:14px}',
  '.dsh-skins-pz-color{display:flex;align-items:center;gap:6px}',
  '.dsh-skins-pz-color input[type=color]{width:34px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);cursor:pointer}',
  '.dsh-skins-pz-range{display:flex;align-items:center;gap:8px}',
  '.dsh-skins-pz-range input[type=range]{flex:1;min-width:0;accent-color:var(--dsw-alias-brand-primary)}',
  '.dsh-skins-pz-range output{flex:none;min-width:44px;text-align:right;font-size:12px;color:var(--dsw-alias-label-secondary)}',
  '.dsh-skins-pz-input{box-sizing:border-box;width:100%;height:32px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}',
  '.dsh-skins-pz-btn{flex:none;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}',
  '.dsh-skins-pz-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.dsh-skins-pz-btn:disabled{opacity:.55;cursor:default}',
  '.dsh-skins-pz-group{display:flex;flex-direction:column;gap:6px}',
  '.dsh-skins-pz-thumbs{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}',
  '.dsh-skins-pz-thumb{position:relative;aspect-ratio:4/3;padding:0;border:2px solid transparent;border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);cursor:pointer}',
  '.dsh-skins-pz-thumb img{width:100%;height:100%;object-fit:cover}',
  '.dsh-skins-pz-thumb.on{border-color:var(--dsw-alias-brand-primary)}',
  '.dsh-skins-pz-thumb:disabled{opacity:.55;cursor:default}',
  '.dsh-skins-pz-muted{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
  '.dsh-skins-pz-strip{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:12px}',
  '.dsh-skins-pz-status{display:flex;align-items:center;gap:8px;justify-content:space-between}',
  '.dsh-skins-pz-warn{border-color:var(--dsw-alias-state-warning,#c77d00)}',
  '.dsh-skins-pz-asset{display:flex;align-items:center;gap:8px}',
  '.dsh-skins-pz-asset img{flex:none;width:44px;height:33px;border-radius:6px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2)}',
  '.dsh-skins-pz-asset-copy{flex:1;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dsh-skins-pz-gallery{display:flex;flex-direction:column;gap:8px}',
  // -- field issue #2: library cell corner-badges, sticky action bar,
  //    and a dedicated scroll region for the panel column ---------------
  '.dsh-skins-wide .dsh-skins-pz-panel{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}',
  '.dsh-skins-pz-cell{position:relative;display:block}',
  '.dsh-skins-pz-cell .dsh-skins-pz-thumb{width:100%}',
  '.dsh-skins-pz-del{position:absolute;top:4px;right:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font:inherit;font-size:14px;line-height:1;cursor:pointer}',
  '.dsh-skins-pz-del:hover{background:rgba(0,0,0,.78)}',
  '.dsh-skins-pz-del:disabled{opacity:.55;cursor:default}',
  '.dsh-skins-pz-del .dsh-skins-update-spinner{width:12px;height:12px;border-width:2px}',
  '.dsh-skins-pz-rowbtns{display:flex;gap:6px;flex-wrap:wrap}',
  '.dsh-skins-pz-actions{position:sticky;bottom:0;z-index:1;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:2px;padding:10px 2px 2px;background:var(--dsw-alias-bg-overlay);border-top:1px solid var(--dsw-alias-border-l2)}',
  '.dsh-skins-pz-cluster{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}',
  '.dsh-skins-pz-cluster-status{flex-direction:column;align-items:flex-start;gap:4px;flex-wrap:nowrap}',
  '.dsh-skins-pz-primary{background:var(--dsh-alias-brand-primary,#C3272B);border-color:transparent;color:#fff}',
  '.dsh-skins-pz-primary:hover{filter:brightness(1.06)}',
  '.dsh-skins-pz-danger{color:var(--dsw-alias-error-text,var(--dsw-static-red-500,#d33));border-color:var(--dsw-alias-error-text,var(--dsw-static-red-500,#d33))}',
  '.dsh-skins-pz-fields-locale{flex-direction:row;gap:6px}',
  '.dsh-skins-pz-fields-locale .dsh-skins-pz-input{flex:1;min-width:0}',
  // Stacked (<904px) resets MUST come after the rules they override — the
  // array order is the cascade order among equal-specificity selectors.
  '@media (max-width:904px){.dsh-skins-pz-thumbs{grid-template-columns:repeat(4,1fr)}}',
].join("\n");

export function installSidebarSwitcher(ctx, { runtime, jsx, react, reactDom, configClient, skinsById }) {
  const UpdatePanel = createUpdatePanel(ctx, { jsx, react });

  function fallbackTranslate(key, params = {}) {
    return formatTemplate(DICTS.zh[key] ?? key, params);
  }

  /** Locale-aware translate for the personalization surface. */
  function localeTranslate(key, params = {}) {
    try {
      const text = ctx.locale?.translate?.(NS, key, params);
      if (typeof text === "string" && text !== key) return text;
    } catch {}
    return fallbackTranslate(key, params);
  }

  function labelFor(skinId) {
    if (skinId === runtime.officialId) return localeTranslate("skins.official.label");
    const listed = runtime.list().find((skin) => skin.id === skinId);
    return listed?.label ?? skinId;
  }

  function builtinAssetsFor(skinId) {
    return skinsById?.(skinId)?.builtinAssets ?? {};
  }

  const PersonalizationPanel = configClient
    ? createPersonalizationPanel({
      jsx, react, configClient, tr: localeTranslate, builtinAssetsFor, labelFor,
    })
    : null;

  function GearIcon() {
    return jsx("svg", {
      width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
      xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true",
      children: jsx("path", {
        d: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
          + "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
        stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round",
      }),
    });
  }

  function SwitcherIcon() {
    return jsx("svg", {
      width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
      xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true",
      children: [
        jsx("path", { d: "M12 3a9 9 0 1 0 .6 17.98c1.2-.05 1.8-1.5 1-2.4-.9-1-.25-2.58 1.1-2.58H18a4 4 0 0 0 4-4c0-5-4.5-9-10-9Z", stroke: "currentColor", strokeWidth: "1.6" }),
        jsx("circle", { cx: "7.8", cy: "10.2", r: "1.1", fill: "currentColor" }),
        jsx("circle", { cx: "11", cy: "7.2", r: "1.1", fill: "currentColor" }),
        jsx("circle", { cx: "15.2", cy: "7.8", r: "1.1", fill: "currentColor" }),
        jsx("circle", { cx: "17.4", cy: "11.4", r: "1.1", fill: "currentColor" }),
      ],
    });
  }

  function ThemeIcon({ id }) {
    if (id === "light") {
      return jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
        jsx("circle", { cx: "12", cy: "12", r: "4", stroke: "currentColor", strokeWidth: "1.6" }),
        jsx("path", { d: "M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }),
      ] });
    }
    if (id === "dark") {
      return jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: jsx("path", { d: "M20 15.2A8.2 8.2 0 0 1 8.8 4a8.2 8.2 0 1 0 11.2 11.2Z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }) });
    }
    return jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
      jsx("rect", { x: "3", y: "4", width: "18", height: "13", rx: "2.5", stroke: "currentColor", strokeWidth: "1.6" }),
      jsx("path", { d: "M8 21h8M12 17v4", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }),
    ] });
  }

  function SidebarAction({ wide, t }) {
    const tr = typeof t === "function" ? (key, params) => t(key, params) : fallbackTranslate;
    const [open, setOpen] = react.useState(false);
    const [activeId, setActiveId] = react.useState(runtime.active);
    const [box, setBox] = react.useState(null);
    const [personalizeId, setPersonalizeId] = react.useState(null);
    const [themePreference, setThemePreference] = react.useState(() => ctx.theme?.getTheme?.().preference ?? "system");
    const buttonRef = react.useRef(null);
    const shellRef = react.useRef(null);
    const shellHeightRef = react.useRef(null);

    // Capture the shell's current height during render — i.e. BEFORE React
    // mutates the DOM for this render — so the height sweep (layout effect
    // below) knows the box's pre-toggle height. Reading layout here is fine:
    // this component re-renders only on discrete user/state events.
    if (open && shellRef.current && typeof shellRef.current.getBoundingClientRect === "function") {
      shellHeightRef.current = shellRef.current.getBoundingClientRect().height;
    }

    // Closing the shell clears the panel state. Auto-save lives in the
    // session-global config client (ADR-0003), so an in-flight debounce
    // completes regardless of the shell's lifecycle.
    react.useEffect(() => {
      if (open) return undefined;
      setPersonalizeId(null);
      return undefined;
    }, [open]);

    const closeShell = () => {
      setOpen(false);
      // The gear unmounts with the shell; focus lands on the persistent trigger.
      buttonRef.current?.focus?.();
    };

    react.useEffect(() => {
      if (!open) return undefined;
      const onPointer = (event) => {
        const node = event.target;
        if (!node || typeof node.closest !== "function") return;
        if (node.closest(".dsh-skins-pop, .dsh-skins-switcher-wrap")) return;
        closeShell();
      };
      const onKey = (event) => { if (event.key === "Escape") closeShell(); };
      document.addEventListener("pointerdown", onPointer, true);
      window.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("pointerdown", onPointer, true);
        window.removeEventListener("keydown", onKey);
      };
    }, [open]);

    react.useEffect(() => {
      const onChange = () => setActiveId(runtime.active());
      window.addEventListener("dsh-skins:active-changed", onChange);
      return () => window.removeEventListener("dsh-skins:active-changed", onChange);
    }, []);

    react.useEffect(() => ctx.on("theme/change", (snapshot) => {
      if (snapshot?.preference) setThemePreference(snapshot.preference);
    }), []);

    const openPopover = () => {
      const rect = buttonRef.current?.getBoundingClientRect?.() ?? { left: 12, top: window.innerHeight - 60 };
      setBox({ left: Math.round(rect.left) + 4, bottom: Math.round(window.innerHeight - rect.top + 8) });
      setActiveId(runtime.active());
      setThemePreference(ctx.theme?.getTheme?.().preference ?? "system");
      setOpen(true);
    };

    const themeCards = THEME_CHOICES.map((choice) => jsx("button", {
      type: "button",
      className: `dsh-skins-theme-card${themePreference === choice.id ? " dsh-skins-theme-card-on" : ""}`,
      "aria-pressed": themePreference === choice.id,
      onClick: () => {
        ctx.theme.setTheme(choice.id);
        setThemePreference(choice.id);
      },
      children: [jsx(ThemeIcon, { id: choice.id }), jsx("span", { children: tr(choice.labelKey) })],
    }, choice.id));

    const choices = [
      {
        id: runtime.officialId,
        label: tr("skins.official.label"),
        description: tr("skins.official.description"),
      },
      ...runtime.list(),
    ];
    const skinCards = choices.map((skin) => {
      const personalizable = configClient !== null && getSkinSchema(skin.id) !== null;
      const card = jsx("button", {
        type: "button",
        role: "menuitemradio",
        "aria-checked": activeId === skin.id,
        className: `dsh-skins-pop-card${activeId === skin.id ? " dsh-skins-pop-card-on" : ""}`,
        onClick: () => {
          // Panel open → the card is a panel-target switch (design §7.2,
          // v2.4.1): the panel follows the selection so active and panel
          // target can never split. No confirmation — auto-save keeps the
          // preview layer transient and harmless (v2.5). A non-personalizable
          // target (no schema) collapses the panel instead of following.
          if (personalizeId !== null && personalizeId !== skin.id) {
            setPersonalizeId(personalizable ? skin.id : null);
          }
          runtime.select(skin.id);
          setActiveId(skin.id);
        },
        children: [
          jsx("span", { className: "dsh-skins-pop-card-label", children: skin.label }),
          jsx("span", { className: "dsh-skins-pop-card-desc", children: skin.description }),
        ],
      }, skin.id);
      if (!personalizable) return card;
      return jsx("div", { className: "dsh-skins-pop-card-row", children: [
        card,
        jsx("button", {
          type: "button",
          id: `${skin.id}-gear`,
          className: "dsh-skins-pz-gear",
          "aria-label": localeTranslate("personalization.title"),
          title: localeTranslate("personalization.title"),
          "aria-expanded": personalizeId === skin.id,
          onClick: () => {
            if (personalizeId === skin.id) {
              // Collapse: focus returns to the gear.
              setPersonalizeId(null);
              try { document.getElementById(`${skin.id}-gear`)?.focus?.(); } catch {}
              return;
            }
            // Opening (or re-targeting) the panel selects the skin so edits
            // preview live; auto-save persists them in the background (v2.5).
            runtime.select(skin.id);
            setActiveId(runtime.active());
            setPersonalizeId(skin.id);
          },
          children: [
            jsx(GearIcon, {}),
          ],
        }, `${skin.id}-gear`),
      ] }, skin.id);
    });

    const showPersonalization = personalizeId !== null && PersonalizationPanel !== null;
    // Wide shell (Q46, v2.4.1 #3): list column (360px) + shrinkable panel
    // column (700px basis) in one 1105px dialog. Clamp so the wide shell
    // never overflows the right edge.
    const shellLeft = box === null ? undefined
      : showPersonalization && typeof window !== "undefined"
        ? Math.max(12, Math.min(box.left, window.innerWidth - 1117))
        : box.left;
    // Clamp the shell to the space actually available ABOVE its bottom
    // anchor: the CSS max-height(100vh-24px) alone ignores the anchor
    // offset, so a tall panel slides its top off-screen with the content
    // unreachable AND unscrollable (field issue #2).
    const shellMaxHeight = box === null || typeof window === "undefined" || typeof window.innerHeight !== "number"
      ? undefined
      : Math.max(220, window.innerHeight - box.bottom - 12);
    // Post-commit, pre-paint: pin the pre-toggle height and sweep to the new
    // one on the width's beat (field issue #13 — see sweepShellHeight).
    react.useLayoutEffect(() => {
      if (!open || box === null) return undefined;
      const shell = shellRef.current;
      if (!shell) return undefined;
      const from = shellHeightRef.current;
      shellHeightRef.current = null;
      return sweepShellHeight(shell, { from, maxHeight: shellMaxHeight }) ?? undefined;
    }, [open, showPersonalization, personalizeId, shellMaxHeight]);
    const panel = open && box && typeof document !== "undefined"
      ? reactDom.createPortal(jsx("div", {
        ref: shellRef,
        className: `dsh-skins-pop${showPersonalization ? " dsh-skins-wide" : ""}`,
        role: "dialog",
        "aria-label": showPersonalization ? localeTranslate("personalization.title") : tr("skins.switch"),
        style: { left: shellLeft, bottom: box.bottom, maxHeight: shellMaxHeight },
        children: [
          jsx("div", { key: "main", className: "dsh-skins-pop-main", children: [
            jsx("div", { key: "appearance", className: "dsh-skins-pop-title", children: tr("appearance.title") }),
            jsx("div", { key: "grid", className: "dsh-skins-theme-grid", children: themeCards }),
            jsx("div", { key: "d1", className: "dsh-skins-pop-divider", "aria-hidden": "true" }),
            jsx("div", { key: "skins", className: "dsh-skins-pop-title", children: tr("skins.title") }),
            ...skinCards,
            jsx(UpdatePanel, { key: "update", open, tr }),
          ] }),
          showPersonalization ? jsx("div", {
            key: "panel", className: "dsh-skins-pz-panel",
            role: "region", "aria-label": localeTranslate("personalization.panelLabel"),
            children: jsx(PersonalizationPanel, { skinId: personalizeId }),
          }) : null,
        ],
      }), document.body)
      : null;

    return jsx("div", {
      className: `dsh-skins-switcher-wrap${wide ? "" : " rail"}`,
      children: [
        jsx("button", {
          ref: buttonRef,
          type: "button",
          className: `dsh-skins-switcher-btn${open ? " on" : ""}`,
          "aria-label": tr("skins.switch"),
          "aria-expanded": open,
          title: tr("skins.switch"),
          onClick: () => { if (open) closeShell(); else openPopover(); },
          children: [jsx(SwitcherIcon, {}), wide ? jsx("span", { children: tr("skins.switch") }) : null],
        }),
        panel,
      ],
    });
  }

  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-skins";
    tag.dataset.pluginCss = TAG_ID;
    tag.textContent = CSS;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, "dsh-skins: sidebar switcher style");

  ctx.effect(() => {
    try { return ctx.locale.register(NS, DICTS); } catch { return () => {}; }
  }, "dsh-skins: sidebar switcher dictionary");

  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "skins-switcher",
    order: 4,
    locale: NS,
    label: () => {
      try {
        const text = ctx.locale?.translate?.(NS, "skins.switch");
        if (typeof text === "string" && text !== "skins.switch") return text;
      } catch {}
      return fallbackTranslate("skins.switch");
    },
  }, SidebarAction));
}
