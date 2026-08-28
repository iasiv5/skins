import assert from "node:assert/strict";
import test from "node:test";
import { DICTS, HOST_ERROR_KEYS, formatTemplate } from "../src/client/dicts.js";
import { resolveFailedOperationText, resolveHostErrorText } from "../src/client/update-panel.js";

const PLACEHOLDER = /\{(\w+)\}/g;

function placeholders(text) {
  return [...String(text).matchAll(PLACEHOLDER)].map((match) => match[1]).sort();
}

test("zh and en dictionaries carry exactly the same key set", () => {
  const zhKeys = Object.keys(DICTS.zh).sort();
  const enKeys = Object.keys(DICTS.en).sort();
  assert.deepEqual(
    zhKeys.filter((key) => !(key in DICTS.en)),
    [],
    "keys missing from en",
  );
  assert.deepEqual(
    enKeys.filter((key) => !(key in DICTS.zh)),
    [],
    "keys missing from zh",
  );
  assert.ok(zhKeys.length > 0);
});

test("every entry uses the same placeholders in zh and en", () => {
  for (const [key, zhText] of Object.entries(DICTS.zh)) {
    assert.deepEqual(placeholders(zhText), placeholders(DICTS.en[key]), `placeholder mismatch for "${key}"`);
  }
});

test("every host error code resolves to an existing dictionary key", () => {
  for (const [code, key] of Object.entries(HOST_ERROR_KEYS)) {
    assert.ok(key in DICTS.zh, `code ${code} points at missing zh key ${key}`);
    assert.ok(key in DICTS.en, `code ${code} points at missing en key ${key}`);
  }
});

test("formatTemplate substitutes params and leaves unknown placeholders intact", () => {
  assert.equal(formatTemplate("v{current} → v{latest}", { current: "0.4.0", latest: "0.5.0" }), "v0.4.0 → v0.5.0");
  assert.equal(formatTemplate("exit {exitCode}", { exitCode: 1 }), "exit 1");
  assert.equal(formatTemplate("keep {unknown}", {}), "keep {unknown}");
});

/** tr that behaves like the official locale runtime bound to the en dict. */
const enTr = (key, params = {}) => {
  const template = DICTS.en[key];
  if (template === undefined) return key;
  return formatTemplate(template, params);
};
const zhTr = (key, params = {}) => {
  const template = DICTS.zh[key];
  if (template === undefined) return key;
  return formatTemplate(template, params);
};

test("resolveHostErrorText localizes coded errors and falls back to the raw message", () => {
  assert.equal(
    resolveHostErrorText({ code: "AGENTS_RUNNING", params: { count: 2 }, text: "检测到 2 个 Agent 正在运行" }, enTr),
    "2 Agent(s) are running; try again later",
  );
  assert.equal(
    resolveHostErrorText({ code: "AGENTS_RUNNING", params: { count: 2 }, text: "检测到 2 个 Agent 正在运行" }, zhTr),
    "检测到 2 个 Agent 正在运行，请稍后重试",
  );
  // Unknown code → raw host message, never a bare key.
  assert.equal(
    resolveHostErrorText({ code: "SOMETHING_ELSE", text: "raw fallback" }, enTr),
    "raw fallback",
  );
  // Plain strings (client-side errors) pass through untouched.
  assert.equal(resolveHostErrorText("offline", enTr), "offline");
  assert.equal(resolveHostErrorText(null, enTr), "");
});

test("resolveFailedOperationText composes the rollback suffix in both languages", () => {
  const operation = {
    phase: "failed",
    message: "DSH 插件更新失败（exit 1）：boom；自动回滚失败：恢复后的 lockfile commit 校验失败",
    code: "UPDATE_COMMAND_FAILED",
    params: { exitCode: "1", output: "boom" },
    rollbackError: { code: "ROLLBACK_LOCKFILE_MISMATCH" },
  };
  assert.equal(
    resolveFailedOperationText(operation, enTr),
    "DSH plugin update failed (exit 1): boom; automatic rollback failed: Restored lockfile failed commit verification",
  );
  assert.equal(
    resolveFailedOperationText({ phase: "failed", message: "已经是最新正式版本", code: "UPDATE_ALREADY_LATEST" }, zhTr),
    "已经是最新正式版本",
  );
  // Uncoded failures keep their host message verbatim.
  assert.equal(resolveFailedOperationText({ phase: "failed", message: "simulated install failure" }, enTr), "simulated install failure");
});
