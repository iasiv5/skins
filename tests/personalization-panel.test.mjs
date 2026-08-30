/**
 * Personalization panel public-path tests. The 1.0.0 build shipped a panel
 * whose 返回 button called an unbound `setPersonalizeId` (the switcher's
 * setter, not in panel scope): every click died in a ReferenceError, so on
 * openbmc / uefi-harness the settings panel could be entered but never left.
 * These tests render the REAL panel (schema from the real catalog) and drive
 * the complete public path — render → click 返回 → onBack + gear re-focus —
 * in the exact states users reported (offline-failed banner visible).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createPersonalizationPanel } from "../src/client/personalization/panel.js";

// ---- minimal React with hooks (element trees are plain objects) -----------

function createFakeReact() {
  const hookStack = [];
  let rootThunk = null;
  let renderScheduled = false;
  const onRendered = [];

  function rerender() {
    if (renderScheduled || rootThunk === null) return;
    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      rootThunk();
    });
  }

  function slot() {
    const frame = hookStack.at(-1);
    if (frame.index >= frame.slots.length) frame.slots.push({});
    return frame.slots[frame.index++];
  }

  function useState(initial) {
    const s = slot();
    if (!("value" in s)) s.value = typeof initial === "function" ? initial() : initial;
    return [s.value, (next) => {
      s.value = typeof next === "function" ? next(s.value) : next;
      rerender();
    }];
  }

  function useEffect(effect, deps) {
    const s = slot();
    s.deps = deps;
    if (!s.ran) {
      s.ran = true;
      onRendered.push(effect);
    }
  }

  function useRef(initial) {
    const s = slot();
    if (!("ref" in s)) s.ref = { current: initial };
    return s.ref;
  }

  function instantiate(element) {
    if (element === null || element === undefined || typeof element === "boolean") return null;
    if (typeof element === "string" || typeof element === "number") return element;
    if (Array.isArray(element)) return element.map(instantiate);
    if (typeof element.type === "function") {
      const frame = { slots: [], index: 0 };
      hookStack.push(frame);
      try {
        return instantiate(element.type(element.props ?? {}));
      } finally {
        hookStack.pop();
      }
    }
    return { ...element, props: { ...element.props, children: instantiate(element.props?.children) } };
  }

  return {
    useState, useEffect, useRef, instantiate,
    render(thunk) {
      rootThunk = thunk;
      const tree = thunk();
      queueMicrotask(() => {
        while (onRendered.length > 0) {
          const effect = onRendered.shift();
          effect();
        }
      });
      return tree;
    },
  };
}

const jsx = (type, props, key) => ({ type, props: props ?? {}, key });

// ---- tree helpers ----------------------------------------------------------

function flatten(node) {
  if (node === null || node === undefined || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const self = typeof node.type === "string" || node.type === undefined ? [node] : [];
  return [...self, ...flatten(node.props?.children)];
}

function findButton(tree, text) {
  return flatten(tree).find((node) => node.type === "button" && node.props.children === text) ?? null;
}

// ---- fixture ---------------------------------------------------------------

function installDocument() {
  const focused = [];
  globalThis.document = {
    getElementById: (id) => (id.endsWith("-gear") ? { focus: () => focused.push(id) } : null),
    createElement: () => ({}),
  };
  return focused;
}

function makeConfigClient(overrides = {}) {
  const listeners = new Set();
  const state = {
    status: "offline-failed",
    revision: 7,
    mode: "normal",
    skins: {},
    library: [],
    references: {},
    dirtyCount: 0,
    ...overrides,
  };
  return {
    getState: () => state,
    onStateChange: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    effectiveOverrides: () => ({}),
    retry: () => {},
    preview: () => {},
    previewReset: () => {},
    uploadImage: async () => ({ error: "offline" }),
    deleteImage: async () => ({ error: "offline" }),
    confirmRecovery: async () => ({ error: "offline" }),
    assetUrl: () => null,
    exportTheme: async () => ({ error: "offline" }),
    prepareThemeImport: async () => ({ error: "offline" }),
    commitThemeImport: async () => ({ error: "offline" }),
  };
}

function mountPanel({ skinId, status }) {
  const react = createFakeReact();
  const focused = installDocument();
  const configClient = makeConfigClient(status ? { status } : undefined);
  const tr = (key) => key;
  let onBackCalls = 0;
  const Panel = createPersonalizationPanel({
    jsx,
    react,
    configClient,
    tr,
    builtinAssetsFor: () => ({}),
    labelFor: (id) => id,
  });
  let tree = null;
  react.render(() => {
    tree = react.instantiate(
      jsx(Panel, { skinId, onBack: () => { onBackCalls += 1; } }),
    );
  });
  return {
    tree: () => tree,
    focused,
    backCalls: () => onBackCalls,
  };
}

// ---- the reported bug: 返回 must leave the panel ---------------------------

for (const skinId of ["openbmc", "uefi-harness", "tgcf"]) {
  for (const status of ["offline-failed", "synced", "loading"]) {
    test(`返回 leaves the ${skinId} panel in ${status} state`, async () => {
      const panel = mountPanel({ skinId, status });
      // Let mount effects (state subscription, header focus) run first: the
      // click must be exercised against a fully mounted panel.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const tree = panel.tree();
      assert.notEqual(tree, null, "panel renders");

      // The exact screen users reported: offline banner + retry offered.
      const texts = flatten(tree).map((node) => node.props?.children).filter((c) => typeof c === "string");
      if (status === "offline-failed") {
        assert.ok(texts.includes("personalization.status.offline"), "offline banner shown");
        assert.ok(findButton(tree, "personalization.status.retry") !== null, "retry offered");
      }

      const back = findButton(tree, "personalization.back");
      assert.notEqual(back, null, "back button rendered");
      assert.equal(panel.backCalls(), 0);

      // The 1.0.0 build threw ReferenceError here (unbound setPersonalizeId).
      back.props.onClick();

      assert.equal(panel.backCalls(), 1, "onBack fired exactly once");
      assert.ok(panel.focused.includes(`${skinId}-gear`), "focus returns to the skin's gear button");
    });
  }
}
