/**
 * Personalization panel public-path tests (simplification T5). These render
 * the REAL panel (schema from the REAL catalog) through the shared fake
 * React and drive the complete user path: field edits preview locally,
 * 保存 flushes exactly once, 还原 discards (works offline), the wallpaper
 * section merges builtin + library with clear-library confirmation, and the
 * footer action bar carries the status cluster (offline/retry/conflict/dirty).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createPersonalizationPanel } from "../src/client/personalization/panel.js";
import { getSkinSchema } from "../src/shared/personalization/catalog.js";
import { createFakeReact, jsx, flatten, findButton } from "./fake-react.mjs";

const SKINS = ["openbmc", "uefi-harness", "tgcf"];
const STATUSES = ["synced", "offline-failed"];

function makeConfigClient(overrides = {}) {
  const listeners = new Set();
  let state = {
    status: "synced",
    revision: 7,
    mode: "normal",
    skins: {},
    library: [],
    references: {},
    dirtyCount: 0,
    ...overrides,
  };
  // Preview layer, mirroring the real client's effectiveOverrides(skinId):
  // returns THAT SKIN's section with previews layered on top.
  const previews = new Map();
  const calls = { preview: [], previewReset: [], restore: 0, flushNow: 0, retry: 0 };
  const emit = () => { for (const l of [...listeners]) l(state); };
  return {
    calls,
    getState: () => state,
    setState: (next) => { state = { ...state, ...next }; emit(); },
    onStateChange: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    effectiveOverrides: (skinId) => {
      const section = structuredClone(state.skins[skinId] ?? {});
      for (const [composite, value] of previews) {
        const [owner, key] = composite.split(" ");
        if (owner !== skinId) continue;
        if (value === null) delete section[key];
        else section[key] = value;
      }
      return section;
    },
    preview: (skinId, key, value) => { calls.preview.push({ skinId, key, value }); previews.set(`${skinId} ${key}`, value); state = { ...state, dirtyCount: previews.size }; emit(); },
    previewReset: (skinId, key) => { calls.previewReset.push({ skinId, key }); previews.set(`${skinId} ${key}`, null); state = { ...state, dirtyCount: previews.size }; emit(); },
    restore: () => { calls.restore += 1; previews.clear(); state = { ...state, dirtyCount: 0 }; emit(); },
    flushNow: async () => { calls.flushNow += 1; return { flushed: state.dirtyCount, blocked: null }; },
    retry: () => { calls.retry += 1; },
    uploadImage: async () => ({ error: "offline" }),
    deleteImage: async (id) => { void id; return { error: "offline" }; },
    confirmRecovery: async () => ({ ok: true }),
    refetch: async () => {},
    assetUrl: (asset) => `/dsh-skins/assets/${asset.id}.png`,
  };
}

function installDom() {
  const confirms = [];
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({}),
  };
  globalThis.window = { confirm: (text) => { confirms.push(text); return true; } };
  return confirms;
}

function mountPanel({ skinId, status, config } = {}) {
  const react = createFakeReact();
  const confirms = installDom();
  const configClient = config ?? makeConfigClient({ status });
  // Mirrors the real locale runtime: template lookup + {placeholder}
  // substitution. Tests assert on the substituted params, so append them.
  const tr = (key, params = {}) => {
    const suffix = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(" ");
    return suffix === "" ? key : `${key} ${suffix}`;
  };
  const Panel = createPersonalizationPanel({
    jsx, react, configClient, tr,
    builtinAssetsFor: () => ({}),
    labelFor: (id) => id,
  });
  let tree = null;
  react.render(() => {
    tree = react.instantiate(jsx(Panel, { skinId }));
  });
  return { tree: () => tree, confirms, configClient, tr };
}

const textsOf = (tree) => flatten(tree).map((n) => n.props?.children).filter((c) => typeof c === "string");
const tick = () => new Promise((r) => setTimeout(r, 0));

for (const skinId of SKINS) {
  for (const status of STATUSES) {
    test(`panel renders per catalog schema for ${skinId} in ${status}`, async () => {
      const panel = mountPanel({ skinId, status });
      await tick();
      const tree = panel.tree();
      assert.notEqual(tree, null);

      const texts = textsOf(tree);
      for (const gone of ["personalization.favicon", "personalization.accent", "personalization.gold", "personalization.bubble", "personalization.back", "personalization.theme.export", "personalization.theme.import"]) {
        assert.equal(texts.includes(gone), false, `${gone} must not render`);
      }
      for (const field of getSkinSchema(skinId).fields) {
        assert.ok(texts.includes(field.labelKey), `${field.labelKey} renders`);
      }
      const actions = flatten(tree).find((n) => n.props?.className?.includes("dsh-skins-pz-actions"));
      assert.notEqual(actions, null, "footer action bar renders");
      assert.notEqual(findButton(tree, "personalization.save"), null);
      assert.notEqual(findButton(tree, "personalization.restore"), null);
      if (status === "offline-failed") {
        assert.ok(texts.includes("personalization.status.offline"), "offline banner in the footer");
        assert.notEqual(findButton(tree, "personalization.status.retry"), null, "retry offered");
      }
    });
  }
}

test("field edits preview locally; 保存 is the only flush and disabled when clean", async () => {
  const panel = mountPanel({ skinId: "tgcf", status: "synced" });
  await tick();
  const scrim = flatten(panel.tree()).find((n) => n.type === "input" && n.props["aria-label"] === "personalization.scrim");
  assert.notEqual(scrim, null, "scrim slider renders");
  assert.equal(findButton(panel.tree(), "personalization.save").props.disabled, true, "保存 disabled while clean");

  scrim.props.onChange({ target: { value: "55" } });
  await tick();
  assert.deepEqual(panel.configClient.calls.preview, [{ skinId: "tgcf", key: "scrim", value: 55 }]);
  assert.equal(panel.configClient.getState().dirtyCount, 1);

  const save = findButton(panel.tree(), "personalization.save");
  assert.notEqual(save.props.disabled, true, "保存 enabled once dirty");
  await save.props.onClick();
  assert.equal(panel.configClient.calls.flushNow, 1, "保存 flushes exactly once");
});

test("slogan text edits preview the complete locale object", async () => {
  const panel = mountPanel({ skinId: "tgcf", status: "synced" });
  await tick();
  const tree = panel.tree();
  const zh = flatten(tree).find((n) => n.type === "input" && n.props["aria-label"] === "personalization.slogan (ZH)");
  const en = flatten(tree).find((n) => n.type === "input" && n.props["aria-label"] === "personalization.slogan (EN)");
  assert.notEqual(zh, null);
  zh.props.onChange({ target: { value: "新标语" } });
  await tick();
  // Re-query from the re-rendered tree — the en input's handler must see the
  // fresh locale value (exactly like typing into the re-rendered DOM).
  const enFresh = flatten(panel.tree()).find((n) => n.type === "input" && n.props["aria-label"] === "personalization.slogan (EN)");
  enFresh.props.onChange({ target: { value: "New slogan" } });
  await tick();
  assert.equal(panel.configClient.calls.preview.length, 2);
  assert.deepEqual(panel.configClient.calls.preview[0].value, { zh: "新标语", en: "A thousand lights before the dawn" });
  assert.deepEqual(panel.configClient.calls.preview[1].value, { zh: "新标语", en: "New slogan" });
});

test("还原 discards previews — enabled offline, disabled while clean (M2)", async () => {
  const panel = mountPanel({ skinId: "tgcf", status: "offline-failed" });
  await tick();
  let restore = findButton(panel.tree(), "personalization.restore");
  assert.equal(restore.props.disabled, true, "还原 disabled while clean");

  // Sliders stay interactive offline (previews are local); pick a non-default scrim.
  const scrim = flatten(panel.tree()).find((n) => n.type === "input" && n.props["aria-label"] === "personalization.scrim");
  scrim.props.onChange({ target: { value: "66" } });
  await tick();
  assert.equal(panel.configClient.getState().dirtyCount, 1);

  restore = findButton(panel.tree(), "personalization.restore");
  assert.notEqual(restore.props.disabled, true, "还原 works offline (purely local)");
  restore.props.onClick();
  await tick();
  assert.equal(panel.configClient.calls.restore, 1);
  assert.equal(panel.configClient.getState().dirtyCount, 0);
});

test("offline: 保存/上传/删除/清空 disabled while 还原 stays usable", async () => {
  const asset = { id: "u_0123456789abcdef0123456789abcdef", displayName: "壁纸.png" };
  const config = makeConfigClient({ status: "offline-failed", library: [asset] });
  const panel = mountPanel({ skinId: "tgcf", status: "offline-failed", config });
  await tick();
  const tree = panel.tree();
  assert.equal(findButton(tree, "personalization.save").props.disabled, true, "保存 disabled offline");
  assert.equal(findButton(tree, "personalization.library.upload").props.disabled, true, "upload disabled offline");
  const del = flatten(tree).find((n) => n.type === "button" && typeof n.props["aria-label"] === "string" && n.props["aria-label"].startsWith("personalization.library.delete:"));
  assert.equal(del.props.disabled, true, "per-asset delete disabled offline");
  assert.equal(findButton(tree, "personalization.library.clear").props.disabled, true, "清空图库 disabled offline");
  // 还原 depends on dirty state only — offline must NOT disable it (M2):
  const scrim = flatten(tree).find((n) => n.type === "input" && n.props["aria-label"] === "personalization.scrim");
  scrim.props.onChange({ target: { value: "70" } });
  await tick();
  assert.notEqual(findButton(panel.tree(), "personalization.restore").props.disabled, true, "还原 usable offline once dirty");
});

test("清空图库 confirms with the affected list and stops at the first failure (Q45/L8)", async () => {
  const assets = [
    { id: "u_0123456789abcdef0123456789abcdef", displayName: "a.png" },
    { id: "u_0123456789abcdef0123456789abcdeff", displayName: "b.png" },
  ];
  const references = {
    [assets[0].id]: [{ skinId: "tgcf", key: "wallpaper" }],
    [assets[1].id]: [{ skinId: "openbmc", key: "wallpaper" }],
  };
  const deleted = [];
  const config = makeConfigClient({ status: "synced", library: assets, references });
  config.deleteImage = async (id) => {
    deleted.push(id);
    return id === assets[1].id ? { error: "boom" } : { affectedSkins: [] };
  };
  const panel = mountPanel({ skinId: "tgcf", status: "synced", config });
  await tick();
  await findButton(panel.tree(), "personalization.library.clear").props.onClick();

  assert.equal(panel.confirms.length, 1, "exactly one confirm");
  const text = panel.confirms[0];
  assert.ok(text.includes("2"), "count in the confirm text");
  assert.ok(text.includes("tgcf · wallpaper"), "affected pair listed");
  assert.ok(text.includes("openbmc · wallpaper"), "affected pair listed");
  assert.deepEqual(deleted, [assets[0].id, assets[1].id], "stops at the first failure");
  assert.ok(textsOf(panel.tree()).includes("personalization.library.clearFailed"), "failure surfaced");
});

test("declining the clear-library confirm deletes nothing", async () => {
  const assets = [{ id: "u_0123456789abcdef0123456789abcdef", displayName: "a.png" }];
  const config = makeConfigClient({ status: "synced", library: assets });
  config.deleteImage = async () => { throw new Error("must not be called"); };
  const panel = mountPanel({ skinId: "tgcf", status: "synced", config });
  globalThis.window.confirm = () => false;
  await tick();
  await findButton(panel.tree(), "personalization.library.clear").props.onClick();
  // Reaching here without throwing means the decline path held.
});

test("conflict banner renders only while synced (③-3)", async () => {
  const config = makeConfigClient({ status: "synced" });
  config.flushNow = async () => ({ flushed: 0, blocked: "conflict" });
  const panel = mountPanel({ skinId: "tgcf", status: "synced", config });
  await tick();
  const scrim = flatten(panel.tree()).find((n) => n.type === "input" && n.props["aria-label"] === "personalization.scrim");
  scrim.props.onChange({ target: { value: "40" } });
  await tick();
  await findButton(panel.tree(), "personalization.save").props.onClick();
  await tick();
  assert.ok(textsOf(panel.tree()).includes("personalization.conflict"), "banner while synced");

  config.setState({ status: "unsupported-readonly" });
  await tick();
  assert.equal(textsOf(panel.tree()).includes("personalization.conflict"), false, "no banner after STORE_READONLY downgrade");
  assert.ok(textsOf(panel.tree()).includes("personalization.status.unsupported"), "read-only strip instead");
});

test("no theme UI and no theme keys remain anywhere (⑦)", () => {
  const panelSource = readFileSync("src/client/personalization/panel.js", "utf8");
  const dictsSource = readFileSync("src/client/dicts.js", "utf8");
  for (const banned of ["personalization.theme.", "personalization.back"]) {
    assert.equal(panelSource.includes(banned), false, `panel must not reference ${banned}`);
    assert.equal(dictsSource.includes(banned), false, `dicts must not define ${banned}`);
  }
  assert.ok(dictsSource.includes('"personalization.library.uploading"'), "uploading key exists");
  assert.ok(dictsSource.includes('"personalization.panelLabel"'), "panelLabel key exists");
});
