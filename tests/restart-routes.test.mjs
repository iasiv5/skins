import assert from "node:assert/strict";
import test from "node:test";
import { restartSafety, waitForRestartSafety } from "../src/host/restart.js";
import { isTrustedRequest } from "../src/host/routes.js";

test("browser-trust fence accepts only loopback or configured authorities", () => {
  assert.equal(isTrustedRequest({ headers: { host: "127.0.0.1:3080" } }), true);
  assert.equal(isTrustedRequest({ headers: { origin: "http://127.0.0.1:3080", host: "127.0.0.1:3080", "sec-fetch-site": "same-origin" } }), true);
  assert.equal(isTrustedRequest({ headers: { origin: "http://127.0.0.1", host: "127.0.0.1:3080" } }), false);
  assert.equal(isTrustedRequest({ headers: { origin: "https://evil.test", host: "127.0.0.1:3080" } }), false);
  assert.equal(isTrustedRequest({ headers: { origin: "http://attacker.test:3080", host: "attacker.test:3080" } }), false);
  assert.equal(isTrustedRequest({ headers: { origin: "https://example.test", host: "example.test" } }, ["example.test"]), true);
  assert.equal(isTrustedRequest({ headers: { origin: "https://example.test", host: "127.0.0.1:3080", "x-forwarded-host": "example.test" } }, ["example.test"]), false);
  assert.equal(isTrustedRequest({ headers: { host: "127.0.0.1:3080", "sec-fetch-site": "cross-site" } }), false);
});

test("restart safety blocks running Agents", async () => {
  const agents = { list: () => [{ status: "running", whenIdle: async () => {} }] };
  assert.deepEqual(restartSafety(agents), { state: "blocked", running: 1 });
  await assert.rejects(() => waitForRestartSafety(agents), /1 个 Agent/);
});

test("restart safety waits for idle Agents and rechecks", async () => {
  let waited = false;
  const agent = { status: "idle", whenIdle: async () => { waited = true; } };
  const agents = { list: () => [agent] };
  assert.deepEqual(await waitForRestartSafety(agents), { state: "safe", running: 0 });
  assert.equal(waited, true);
});

test("unknown Agent state requires explicit confirmation", async () => {
  assert.deepEqual(restartSafety(null), { state: "unknown", running: null });
  await assert.rejects(() => waitForRestartSafety(null), (error) => error.code === "RESTART_SAFETY_UNKNOWN");
  assert.deepEqual(await waitForRestartSafety(null, true), { state: "unknown", running: null });
});
