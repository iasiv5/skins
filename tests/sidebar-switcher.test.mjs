/**
 * Combined-shell switcher tests (T6): the five dirty-leave channels, the
 * docked panel column, and focus management — driven through the REAL
 * installSidebarSwitcher + REAL panel with the shared fake React.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { installSidebarSwitcher, sweepShellHeight } from "../src/client/sidebar-switcher.js";
import { createFakeReact, jsx, flatten } from "./fake-react.mjs";

function makeDom(viewportHeight = 900) {
  const docListeners = new Map();
  const winListeners = new Map();
  const focused = [];
  const confirms = [];
  const created = [];
  let confirmResult = true;
  globalThis.document = {
    head: { appendChild: () => {}, removeChild: () => {} },
    body: { appendChild: () => {} },
    getElementById: (id) => (id.endsWith("-gear") ? { focus: () => focused.push(id) } : null),
    createElement: () => { const el = { dataset: {}, appendChild: () => {}, remove() {} }; created.push(el); return el; },
    addEventListener: (kind, fn) => docListeners.set(kind, fn),
    removeEventListener: () => {},
  };
  globalThis.window = {
    innerWidth: 1400,
    innerHeight: viewportHeight,
    confirm: (text) => { confirms.push(text); return confirmResult; },
    addEventListener: (kind, fn) => winListeners.set(kind, fn),
    removeEventListener: () => {},
    dispatchEvent: () => {},
  };
  return {
    docListeners, winListeners, focused, confirms, created,
    setConfirm: (value) => { confirmResult = value; },
    fireOutsidePointer: () => docListeners.get("pointerdown")({ target: { closest: () => null } }),
    fireEscape: () => winListeners.get("keydown")({ key: "Escape" }),
  };
}

function makeConfigClient() {
  const listeners = new Set();
  const previews = new Map();
  let state = { status: "synced", revision: 7, mode: "normal", skins: {}, library: [], references: {}, dirtyCount: 0 };
  const calls = { flushNow: 0, restore: 0 };
  const emit = () => { for (const l of [...listeners]) l(state); };
  return {
    calls,
    getState: () => state,
    onStateChange: (l) => (listeners.add(l), () => listeners.delete(l)),
    effectiveOverrides: () => ({}),
    preview: () => { previews.set("tgcf panelOpacity", 66); state = { ...state, dirtyCount: previews.size }; emit(); },
    previewReset: () => {},
    restore: () => { calls.restore += 1; previews.clear(); state = { ...state, dirtyCount: 0 }; emit(); },
    flushNow: async () => { calls.flushNow += 1; return { flushed: 1 }; },
    retry: () => {},
    uploadImage: async () => ({ error: "offline" }),
    deleteImage: async () => ({ error: "offline" }),
    confirmRecovery: async () => ({ ok: true }),
    refetch: async () => {},
    assetUrl: () => null,
  };
}

function makeHarness(viewportHeight = 900) {
  const dom = makeDom(viewportHeight);
  const configClient = makeConfigClient();
  const react = createFakeReact();
  let active = "openbmc";
  const runtime = {
    officialId: "official",
    active: () => active,
    select: (id) => { active = id; },
    list: () => [
      { id: "openbmc", label: "OpenBMC", description: "bmc" },
      { id: "uefi-harness", label: "UEFI", description: "uefi" },
      { id: "tgcf", label: "TGCF", description: "tgcf" },
    ],
  };
  const themeSnapshot = { preference: "system", active: { id: "light" }, themes: [], revision: 0 };
  let registered = null;
  const ctx = {
    effect: (fn) => { fn(); return () => {}; },
    slots: {
      inject: (key, callback) => callback() ?? (() => {}),
      register: (opts, comp) => { registered = { opts, comp }; return () => {}; },
    },
    locale: {
      register: () => () => {},
      getLocale: () => ({ active: "zh" }),
      translate: () => null,
    },
    theme: {
      getTheme: () => themeSnapshot,
      setTheme: (id) => { themeSnapshot.preference = id; },
      on: () => () => {},
    },
    on: () => () => {},
    connection: { isLoopback: false },
  };
  const reactDom = { createPortal: (children) => ({ $$portal: true, children }) };
  installSidebarSwitcher(ctx, {
    runtime,
    jsx: (type, props, key) => jsx(type, props, key),
    react,
    reactDom,
    configClient,
    skinsById: () => ({}),
  });
  const SidebarAction = registered.comp;

  let tree = null;
  const attachFocusRecorders = () => {
    // Attach recorders where the components call .focus() so focus
    // management is observable through the fake DOM. Runs after EVERY render:
    // rerenders recreate node objects and refs follow the newest node.
    for (const node of [...flatten(tree), ...inShell()]) {
      if (node.props?.tabIndex === -1 && node.props?.role === "heading" && node.focus === undefined) {
        node.focus = (options) => dom.focused.push(options?.preventScroll ? "panel-heading-prevent-scroll" : "panel-heading");
      }
      if (node.type === "button" && String(node.props.className).includes("dsh-skins-switcher-btn") && node.focus === undefined) {
        node.focus = () => dom.focused.push("switcher-trigger");
      }
    }
  };

  const render = () => react.render(() => {
    tree = react.instantiate(jsx(SidebarAction, { wide: true }));
    // The reactDom stub bypasses instantiate for portal content — descend
    // manually so the shell's components (panel included) become real trees.
    for (const node of flatten(tree)) {
      if (node?.$$portal && node.children !== undefined) {
        node.children = react.instantiate(node.children);
      }
    }
    attachFocusRecorders();
  });

  // The reactDom stub renders portals as { $$portal, children } — descend
  // into the shell before flattening; the switcher trigger lives outside it.
  const shell = () => {
    const portal = tree.props.children.find((child) => child?.$$portal);
    return portal?.children ?? null;
  };
  const inShell = () => flatten(shell() ?? {});
  const gearButton = (skinId) => inShell().find((n) => n.type === "button" && n.props.id === `${skinId}-gear`);
  const cardButton = (skinId) => inShell().find(
    (n) => n.type === "button" && n.props.role === "menuitemradio" && n.key === skinId,
  );
  const switcherButton = () => flatten(tree).find((n) => n.type === "button" && String(n.props.className).includes("dsh-skins-switcher-btn"));
  const panelColumn = () => inShell().find((n) => n.props?.className === "dsh-skins-pz-panel") ?? null;
  const translucencyInput = () => inShell().find((n) => n.type === "input" && n.props["aria-label"] === "通透度 | Transparency");
  const heading = () => inShell().find((n) => n.props?.role === "heading");

  render();

  const openShell = async () => {
    switcherButton().props.onClick();
    await tick();
    attachFocusRecorders();
  };

  return { dom, configClient, tree: () => tree, render, shell, gearButton, cardButton, switcherButton, panelColumn, translucencyInput, heading, openShell, attachFocusRecorders, getActive: () => active,
    cssText: () => dom.created.map((el) => el.textContent ?? "").join("\n") };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test("① gear opens the docked panel column and focuses the heading", async () => {
  const h = makeHarness();
  await h.openShell();
  assert.equal(h.panelColumn(), null, "no panel before the gear click");

  h.gearButton("tgcf").props.onClick();
  await tick();
  h.attachFocusRecorders();
  // The panel mount effect runs at the next microtask checkpoint; give the
  // recorder a chance by re-running it through another render cycle.
  await tick();
  const column = h.panelColumn();
  assert.notEqual(column, null, "panel column appears beside the list");
  assert.equal(column.props.role, "region");
  assert.equal(column.props["aria-label"], "个性化设置");
   assert.ok(h.dom.focused.includes("panel-heading-prevent-scroll"),
     "panel heading receives focus without scrolling the transitioning shell");
  const gearNode = h.gearButton("tgcf");
  assert.equal(flatten(gearNode).some((n) => n.props?.className === "dsh-skins-pz-gear-dot"), false,
    "no override dot on the gear (user ruling #9)");
  const shell = h.shell();
  assert.ok(String(shell.props.className).includes("dsh-skins-wide"), "shell enters wide mode");
  assert.ok(String(shell.props.className).includes("dsh-skins-pop"), "shell keeps the dialog class");
});

test("② clean shell: outside click closes, focus returns to the trigger, and NOTHING flushes (R1)", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("openbmc").props.onClick();
  await tick();
  h.dom.fireOutsidePointer();
  await tick();
  assert.equal(h.shell(), null, "shell closed");
  assert.ok(h.dom.focused.includes("switcher-trigger"), "focus lands on the persistent trigger");
  assert.equal(h.configClient.calls.flushNow, 0, "no PATCH path may run on close (ADR-0001)");
});

test("③ outside click closes directly — no confirmation even with a pending edit (ADR-0003)", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.translucencyInput().props.onChange({ target: { value: "66" } });
  await tick();
  assert.equal(h.configClient.getState().dirtyCount, 1, "edit pending (the debounce owns it)");

  h.dom.fireOutsidePointer();
  await tick();
  assert.equal(h.shell(), null, "shell closed");
  assert.equal(h.dom.confirms.length, 0, "no discard dialog — auto-save owns persistence");
  assert.ok(h.dom.focused.includes("switcher-trigger"), "focus lands on the persistent trigger");
  assert.equal(h.configClient.calls.flushNow, 0, "closing never flushes; the debounce does");
});

test("④ Escape closes directly — no confirmation (ADR-0003)", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.translucencyInput().props.onChange({ target: { value: "66" } });
  await tick();
  h.dom.fireEscape();
  await tick();
  assert.equal(h.shell(), null, "Escape closes");
  assert.equal(h.dom.confirms.length, 0, "no dialog");
});

test("⑤ gear re-click collapses the panel directly (no confirm, ADR-0003)", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.gearButton("tgcf").props.onClick();
  await tick();
  assert.equal(h.panelColumn(), null, "panel collapsed");
  assert.notEqual(h.shell(), null, "shell itself stays open");
  assert.equal(h.dom.confirms.length, 0, "no confirmation on collapse");
});

test("⑥ gear target switch works directly (no dirty confirm, ADR-0003)", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.gearButton("openbmc").props.onClick();
  await tick();
  assert.equal(h.getActive(), "openbmc", "active follows the gear");
  assert.ok(h.heading().props.children.includes("OpenBMC"), "panel retargeted");
  assert.equal(h.dom.confirms.length, 0, "no confirmation");
});

test("⑦ panel open: card click follows the panel target (v2.4.1, reverses Q48)", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.cardButton("uefi-harness").props.onClick();
  await tick();
  assert.equal(h.getActive(), "uefi-harness", "card switches the active skin");
  assert.equal(h.dom.confirms.length, 0, "clean panel → no confirm needed");
  assert.notEqual(h.panelColumn(), null, "panel stays docked");
  assert.ok(h.heading().props.children.includes("UEFI"), "panel target follows the selection");
  // Active and panel target can never split while the panel is open.
  assert.ok(!h.heading().props.children.includes("TGCF"), "stale panel content is gone");

  // Non-personalizable target (official): the panel collapses via the same
  // clean path instead of docking an empty column.
  h.cardButton("official").props.onClick();
  await tick();
  assert.equal(h.getActive(), "official");
  assert.equal(h.panelColumn(), null, "no empty panel column for a skin without schema");
  assert.equal(h.dom.confirms.length, 0, "still clean → still no confirm");
});

test("⑧ card switch with a pending edit: direct switch, no confirm (ADR-0003)", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.translucencyInput().props.onChange({ target: { value: "66" } });
  await tick();
  h.cardButton("uefi-harness").props.onClick();
  await tick();
  assert.equal(h.getActive(), "uefi-harness", "direct switch");
  assert.ok(h.heading().props.children.includes("UEFI"), "panel follows");
  assert.equal(h.dom.confirms.length, 0, "no discard dialog — the debounce owns persistence");
});

test("⑨ panel closed: card click is a plain switch, no confirm", async () => {
  const h = makeHarness();
  await h.openShell();
  h.cardButton("tgcf").props.onClick();
  await tick();
  assert.equal(h.getActive(), "tgcf");
  assert.equal(h.panelColumn(), null, "no panel appears from a card click");
  assert.equal(h.dom.confirms.length, 0, "panel closed ⇒ nothing dirty to guard");
});

test("⑩ shell is clamped to the space above its anchor; panel column scrolls; action bar sticks (issue #2)", async () => {
  const h = makeHarness(900);
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  const sh = h.shell();
  // The trigger stub has no rect → fallback anchor top = innerHeight-60 ⇒ box.bottom = 68.
  assert.equal(sh.props.style.bottom, 68);
  assert.equal(sh.props.style.maxHeight, 820, "innerHeight - anchor - margin: the shell top can never leave the viewport");
  const css = h.cssText();
  assert.ok(css.includes(".dsh-skins-wide .dsh-skins-pz-panel{overflow-y:auto"),
    "wide mode: the panel column owns its scroll region");
  assert.ok(css.includes(".dsh-skins-pz-panel{flex:0 1 700px"),
    "panel column is shrinkable — the wide shell can never overflow horizontally");
  assert.ok(css.includes("width:min(1105px"),
    "wide shell sized for a 6-per-row wallpaper grid (v2.4.1 #3)");
  assert.ok(css.includes(".dsh-skins-pz-thumbs{display:grid;grid-template-columns:repeat(6,1fr)"),
    "wallpaper grid shows 6 thumbnails per row");
  assert.ok(css.includes(".dsh-skins-pz-thumbs>.dsh-skins-pz-btn{grid-column:1/-1;justify-self:center;white-space:nowrap"),
    "the load-more button spans the full row centered — never wrapped inside one column track");
  assert.ok(css.includes(".dsh-skins-pz-thumbs>.dsh-skins-pz-muted{grid-column:1/-1;white-space:nowrap"),
    "the empty-library hint spans the full row — never wrapped inside one column track");
  assert.ok(css.includes(".dsh-skins-pz-thumbs{grid-template-columns:repeat(4,1fr)"),
    "stacked (<904px) mode falls back to 4 columns");
  assert.ok(css.includes(".dsh-skins-pz-fields-locale{flex-direction:row"),
    "locale inputs sit side by side in the wide panel");
  assert.ok(css.includes(".dsh-skins-pz-actions{position:sticky"),
    "the action bar stays in view while the panel scrolls (Q50)");
  assert.ok(css.includes(".dsh-skins-pz-del{position:absolute"),
    "library delete is a corner badge on the cell, not a button stacked below");
  assert.ok(css.includes("overflow-y:visible"),
    "stacked (<904px) mode hands scrolling back to the whole shell");
  assert.ok(css.includes("width:min(390px"),
    "the list column is 360px in BOTH narrow and wide shells (no menu resize on gear click)");
  assert.ok(css.includes("transition:width .2s ease-out"),
    "the shell width animates so docking looks smooth");
  assert.ok(css.includes("min-width:0;width:360px;flex:none"),
    "list column width is fixed in the BASE rule — the instant wide-class flip on collapse cannot resize it");
  assert.ok(css.includes(".dsh-skins-pop{transition:none}"),
    "reduced-motion skips the width animation");
  assert.ok(
    css.includes('body[data-ds-dark-theme]:not([data-dsh-openbmc-skin]):not([data-dsh-uefi-harness]):not([data-dsh-tgcf-skin]) .dsh-skins-pop{background:rgba(41,42,44,0.97)}'),
    "official dark pop gets a deep charcoal, skinned modes keep their token overlay (ruling #16)");
  assert.ok(
    css.includes(".dsh-skins-pop-card-on,.dsh-skins-pop-card-on:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform)}"),
    "selected cards border with the skin brand color, not the frozen blue static (ruling #16)");
  assert.ok(!css.includes("var(--dsh-alias-interactive-bg-hover)"),
    "gear hover consumes the real dsw token - the dsh name is a dead key (ruling #16)");

  const tiny = makeHarness(260);
  await tiny.openShell();
  assert.equal(tiny.shell().props.style.maxHeight, 220, "very short viewports keep a usable floor, never a negative/zero clamp");
});

test("⑪ gear toggle sweeps the shell height on the width's beat (issue #13)", () => {
  // Expand: the box jumped 493→628 in one frame pre-fix; the sweep pins the
  // old height and transitions to the post-commit clamp ceiling instead.
  const style = {};
  let onTransitionEnd = null;
  const shell = {
    style,
    scrollHeight: 900, // unclamped panel content extent
    offsetHeight: 493, // consumed by the forced reflow between pin and target
    getBoundingClientRect: () => ({ height: 628 }), // post-commit clamped box
    addEventListener: (kind, fn) => { if (kind === "transitionend") onTransitionEnd = fn; },
    removeEventListener: () => {},
  };
  const finish = sweepShellHeight(shell, { from: 493, maxHeight: 628 });
  assert.equal(style.height, "628px", "sweeps toward the clamped target, not the raw content height");
  assert.equal(style.overflowY, "hidden", "no transient scrollbar while the box is pinned below its content");
  assert.ok(style.transition.includes("height 200ms ease-out"), "height rides the same beat as the width");
  assert.ok(style.transition.includes("width 200ms ease-out"),
    "inline transition restates width — an inline transition replaces the stylesheet's width-only rule");
  onTransitionEnd({ propertyName: "height" });
  assert.equal(style.height, "", "pin released after the sweep — auto height resolves to the target");
  assert.equal(style.transition, "");
  finish(); // idempotent double-release

  // Collapse: 628 → 493 sweeps down the same way.
  const down = { style: {}, scrollHeight: 493, getBoundingClientRect: () => ({ height: 493 }), offsetHeight: 628 };
  sweepShellHeight(down, { from: 628, maxHeight: 628 });
  assert.equal(down.style.height, "493px", "collapse sweeps down to the list-column height");
});

test("⑫ height sweep no-ops where a sweep would be wrong (issue #13)", () => {
  const style = {};
  const shell = { style, scrollHeight: 0, getBoundingClientRect: () => ({ height: 0 }) };
  assert.equal(typeof sweepShellHeight(undefined, { from: 100, maxHeight: 600 }), "function", "always returns a cleanup");
  assert.deepEqual(style, {}, "no shell → nothing pinned");
  assert.equal(typeof sweepShellHeight(shell, { from: null, maxHeight: 600 }), "function");
  assert.deepEqual(style, {}, "first shell open (no pre-toggle height) → nothing pinned");
  sweepShellHeight(shell, { from: 0, maxHeight: 600 });
  assert.deepEqual(style, {}, "target equals current → nothing to animate, nothing pinned");
  const savedMatchMedia = globalThis.window.matchMedia;
  globalThis.window.matchMedia = () => ({ matches: true });
  try {
    sweepShellHeight({ ...shell, scrollHeight: 900, getBoundingClientRect: () => ({ height: 628 }) }, { from: 493, maxHeight: 628 });
    assert.deepEqual(style, {}, "reduced motion → instant layout, never a sweep");
  } finally {
    if (savedMatchMedia === undefined) delete globalThis.window.matchMedia;
    else globalThis.window.matchMedia = savedMatchMedia;
  }
});
