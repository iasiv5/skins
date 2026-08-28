import { createUpdatePanel } from "./update-panel.js";

const NS = "dsh-skins.ui";
const TAG_ID = "dsh-skins/sidebar.css";
const DICTS = {
  zh: {
    "skins.switch": "皮肤切换",
    "skins.title": "选择皮肤",
    "skins.official.label": "DeepSeek Harness（官方）",
    "skins.official.description": "不启用额外皮肤，使用官方界面",
    "appearance.title": "外观配色",
    "appearance.light": "浅色",
    "appearance.dark": "深色",
    "appearance.system": "跟随系统",
    "update.checking": "正在检查更新…",
    "update.checkFailed": "暂时无法检查更新",
    "update.retry": "重试",
    "update.developmentCurrent": "本地开发模式 - v{current}（最新正式版 v{latest}）",
    "update.developmentNewer": "本地开发模式 - v{current}（可更新至 v{latest}）",
    "update.unsupported": "当前安装来源不支持在线更新",
    "update.unsupportedHint": "仅从官方 GitHub 仓库安装的版本可以一键更新",
    "update.available": "发现插件更新",
    "update.versions": "v{current} → v{latest}",
    "update.releaseNotes": "查看版本说明",
    "update.action": "更新",
    "update.failed": "更新失败",
    "update.installed": "更新已安装",
    "update.restartRequired": "v{version} 将在重启 DSH Web 后生效",
    "update.restartNow": "立即重启",
    "update.confirmRestart": "确认重启",
    "update.confirmUnknown": "仍要重启",
    "update.later": "稍后",
    "update.deferred": "已选择稍后重启",
    "update.restartManual": "请手动重启 DSH Web",
    "update.restarting": "正在重启…",
    "update.restart.blocked": "检测到 {count} 个 Agent 正在运行，请稍后重试",
    "update.restart.unknown": "无法确认 Agent 状态；再次点击“仍要重启”表示你确认继续",
    "update.phase.queued": "更新已排队",
    "update.phase.checking": "正在检查最新正式版本…",
    "update.phase.preparing": "正在验证 Release…",
    "update.phase.installing": "正在下载安装…",
    "update.phase.validating": "正在校验安装结果…",
    "update.phase.rollback": "更新失败，正在恢复原版本…",
  },
  en: {
    "skins.switch": "Skin Switcher",
    "skins.title": "Choose Skin",
    "skins.official.label": "DeepSeek Harness (Official)",
    "skins.official.description": "Use the official interface without an additional skin",
    "appearance.title": "Appearance",
    "appearance.light": "Light",
    "appearance.dark": "Dark",
    "appearance.system": "System",
    "update.checking": "Checking for updates…",
    "update.checkFailed": "Unable to check for updates",
    "update.retry": "Retry",
    "update.developmentCurrent": "Local development mode - v{current} (latest release v{latest})",
    "update.developmentNewer": "Local development mode - v{current} (update available: v{latest})",
    "update.unsupported": "This install source cannot update online",
    "update.unsupportedHint": "One-click update is available only for installs from the official GitHub repository",
    "update.available": "Plugin update available",
    "update.versions": "v{current} → v{latest}",
    "update.releaseNotes": "Release notes",
    "update.action": "Update",
    "update.failed": "Update failed",
    "update.installed": "Update installed",
    "update.restartRequired": "v{version} will take effect after DSH Web restarts",
    "update.restartNow": "Restart now",
    "update.confirmRestart": "Confirm restart",
    "update.confirmUnknown": "Restart anyway",
    "update.later": "Later",
    "update.deferred": "Restart deferred",
    "update.restartManual": "Restart DSH Web manually",
    "update.restarting": "Restarting…",
    "update.restart.blocked": "{count} Agent(s) are running; try again later",
    "update.restart.unknown": "Agent status is unavailable; click Restart anyway again to confirm",
    "update.phase.queued": "Update queued",
    "update.phase.checking": "Checking the latest stable release…",
    "update.phase.preparing": "Verifying the Release…",
    "update.phase.installing": "Downloading and installing…",
    "update.phase.validating": "Validating the installation…",
    "update.phase.rollback": "Update failed; restoring the previous version…",
  },
};
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
  '.dsh-skins-pop{position:fixed;z-index:60;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;width:min(360px,calc(100vw - 24px));max-height:calc(100vh - 24px);padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv3,0 8px 24px rgba(0,0,0,.14));overflow-y:auto}',
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
].join("\n");

export function installSidebarSwitcher(ctx, { runtime, jsx, react, reactDom }) {
  const UpdatePanel = createUpdatePanel(ctx, { jsx, react });

  function fallbackTranslate(key, params = {}) {
    const template = DICTS.zh[key] ?? key;
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template,
    );
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
    const [themePreference, setThemePreference] = react.useState(() => ctx.theme?.getTheme?.().preference ?? "system");
    const buttonRef = react.useRef(null);

    react.useEffect(() => {
      if (!open) return undefined;
      const onPointer = (event) => {
        const node = event.target;
        if (!node || typeof node.closest !== "function") return;
        if (node.closest(".dsh-skins-pop, .dsh-skins-switcher-wrap")) return;
        setOpen(false);
      };
      const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
      document.addEventListener("pointerdown", onPointer, true);
      window.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("pointerdown", onPointer, true);
        window.removeEventListener("keydown", onKey);
      };
    }, [open]);

    react.useEffect(() => {
      const onChange = () => setActiveId(runtime.active());
      window.addEventListener("dsh-skins:changed", onChange);
      return () => window.removeEventListener("dsh-skins:changed", onChange);
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
    const skinCards = choices.map((skin) => jsx("button", {
      type: "button",
      role: "menuitemradio",
      "aria-checked": activeId === skin.id,
      className: `dsh-skins-pop-card${activeId === skin.id ? " dsh-skins-pop-card-on" : ""}`,
      onClick: () => {
        runtime.select(skin.id);
        setActiveId(skin.id);
      },
      children: [
        jsx("span", { className: "dsh-skins-pop-card-label", children: skin.label }),
        jsx("span", { className: "dsh-skins-pop-card-desc", children: skin.description }),
      ],
    }, skin.id));

    const panel = open && box && typeof document !== "undefined"
      ? reactDom.createPortal(jsx("div", {
        className: "dsh-skins-pop",
        role: "dialog",
        "aria-label": tr("skins.switch"),
        style: { left: box.left, bottom: box.bottom },
        children: [
          jsx("div", { className: "dsh-skins-pop-title", children: tr("appearance.title") }),
          jsx("div", { className: "dsh-skins-theme-grid", children: themeCards }),
          jsx("div", { className: "dsh-skins-pop-divider", "aria-hidden": "true" }),
          jsx("div", { className: "dsh-skins-pop-title", children: tr("skins.title") }),
          ...skinCards,
          jsx(UpdatePanel, { open, tr }),
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
          onClick: () => open ? setOpen(false) : openPopover(),
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
    label: () => "皮肤切换",
  }, SidebarAction));
}
