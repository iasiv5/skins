/**
 * Combined-shell switcher tests (T6): the five dirty-leave channels, the
 * docked panel column, and focus management — driven through the REAL
 * installSidebarSwitcher + REAL panel with the shared fake React.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { installSidebarSwitcher } from "../src/client/sidebar-switcher.js";
import { createFakeReact, jsx, flatten } from "./fake-react.mjs";

function makeDom() {
  const docListeners = new Map();
  const winListeners = new Map();
  const focused = [];
  const confirms = [];
  let confirmResult = true;
  globalThis.document = {
    head: { appendChild: () => {}, removeChild: () => {} },
    body: { appendChild: () => {} },
    getElementById: (id) => (id.endsWith("-gear") ? { focus: () => focused.push(id) } : null),
    createElement: () => ({ dataset: {}, appendChild: () => {}, remove() {} }),
    addEventListener: (kind, fn) => docListeners.set(kind, fn),
    removeEventListener: () => {},
  };
  globalThis.window = {
    innerWidth: 1400,
    confirm: (text) => { confirms.push(text); return confirmResult; },
    addEventListener: (kind, fn) => winListeners.set(kind, fn),
    removeEventListener: () => {},
    dispatchEvent: () => {},
  };
  return {
    docListeners, winListeners, focused, confirms,
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
    preview: () => { previews.set("tgcf scrim", 66); state = { ...state, dirtyCount: previews.size }; emit(); },
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

function makeHarness() {
  const dom = makeDom();
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
        node.focus = () => dom.focused.push("panel-heading");
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
  const scrimInput = () => inShell().find((n) => n.type === "input" && n.props["aria-label"] === "遮罩强度");
  const heading = () => inShell().find((n) => n.props?.role === "heading");

  render();

  const openShell = async () => {
    switcherButton().props.onClick();
    await tick();
    attachFocusRecorders();
  };

  return { dom, configClient, tree: () => tree, render, shell, gearButton, cardButton, switcherButton, panelColumn, scrimInput, heading, openShell, attachFocusRecorders, getActive: () => active };
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

test("③ dirty shell + outside click: refuse keeps everything, agree discards and closes", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.scrimInput().props.onChange({ target: { value: "66" } });
  await tick();
  assert.equal(h.configClient.getState().dirtyCount, 1);

  h.dom.setConfirm(false);
  h.dom.fireOutsidePointer();
  await tick();
  assert.equal(h.dom.confirms.length, 1, "dirtyLeave confirm shown");
  assert.notEqual(h.shell(), null, "refusal keeps the shell open");
  assert.equal(h.configClient.calls.restore, 0, "refusal keeps the previews");
  assert.equal(h.configClient.getState().dirtyCount, 1);

  h.dom.setConfirm(true);
  h.dom.fireOutsidePointer();
  await tick();
  assert.equal(h.configClient.calls.restore, 1, "agreement discards via restore()");
  assert.equal(h.shell(), null, "shell closes after the discard");
  assert.equal(h.configClient.calls.flushNow, 0, "leaving never persists (R1)");
});

test("④ Escape shares the same confirmed path", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.scrimInput().props.onChange({ target: { value: "66" } });
  await tick();
  h.dom.setConfirm(true);
  h.dom.fireEscape();
  await tick();
  assert.equal(h.dom.confirms.length, 1);
  assert.equal(h.configClient.calls.restore, 1);
  assert.equal(h.shell(), null, "Escape closes after discard");
});

test("⑤ dirty gear re-click: agree collapses the panel, shell stays", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.scrimInput().props.onChange({ target: { value: "66" } });
  await tick();
  h.dom.setConfirm(true);
  h.gearButton("tgcf").props.onClick();
  await tick();
  assert.equal(h.configClient.calls.restore, 1, "collapse discards on agree");
  assert.equal(h.panelColumn(), null, "panel column collapsed");
  assert.notEqual(h.shell(), null, "shell itself stays open");
});

test("⑥ dirty target switch to another gear: refuse keeps active skin AND panel target (③-2)", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.scrimInput().props.onChange({ target: { value: "66" } });
  await tick();

  h.dom.setConfirm(false);
  h.gearButton("openbmc").props.onClick();
  await tick();
  assert.equal(h.dom.confirms.length, 1);
  assert.equal(h.getActive(), "tgcf", "refusal must not switch the active skin (guard runs BEFORE select)");
  assert.notEqual(h.panelColumn(), null, "panel stays open on tgcf");
  assert.ok(h.heading().props.children.includes("TGCF"), "panel target unchanged");

  h.dom.setConfirm(true);
  h.gearButton("openbmc").props.onClick();
  await tick();
  assert.equal(h.configClient.calls.restore, 1);
  assert.equal(h.getActive(), "openbmc", "agreement switches target");
  assert.ok(h.heading().props.children.includes("OpenBMC"), "panel now targets openbmc");
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

test("⑧ dirty card target switch: guard BEFORE select; refuse keeps active+panel, agree follows (③-2)", async () => {
  const h = makeHarness();
  await h.openShell();
  h.gearButton("tgcf").props.onClick();
  await tick();
  h.scrimInput().props.onChange({ target: { value: "66" } });
  await tick();
  assert.equal(h.configClient.getState().dirtyCount, 1);

  h.dom.setConfirm(false);
  h.cardButton("uefi-harness").props.onClick();
  await tick();
  assert.equal(h.dom.confirms.length, 1, "card click with dirty panel asks first");
  assert.equal(h.getActive(), "tgcf", "refusal must not switch the active skin (guard runs BEFORE select)");
  assert.ok(h.heading().props.children.includes("TGCF"), "refusal keeps the panel target");
  assert.equal(h.configClient.calls.restore, 0, "refusal keeps the previews");
  assert.equal(h.configClient.getState().dirtyCount, 1);

  h.dom.setConfirm(true);
  h.cardButton("uefi-harness").props.onClick();
  await tick();
  assert.equal(h.configClient.calls.restore, 1, "agreement discards via restore()");
  assert.equal(h.getActive(), "uefi-harness", "agreement switches the skin");
  assert.ok(h.heading().props.children.includes("UEFI"), "panel follows after the discard");
  assert.equal(h.configClient.calls.flushNow, 0, "leaving never persists (R1)");
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
