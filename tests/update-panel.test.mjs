import assert from "node:assert/strict";
import test from "node:test";
import { createOperationPoller } from "../src/client/update-panel.js";

function scheduler() {
  let next = 1;
  const pending = new Map();
  const cancelled = [];
  return {
    schedule(callback) {
      const id = next++;
      pending.set(id, callback);
      return id;
    },
    cancel(id) {
      cancelled.push(id);
      pending.delete(id);
    },
    async runNext() {
      const [id, callback] = pending.entries().next().value ?? [];
      if (id === undefined) return false;
      pending.delete(id);
      await callback();
      return true;
    },
    get size() { return pending.size; },
    cancelled,
  };
}

test("operation poller continues while running and cancels on close", async () => {
  const timers = scheduler();
  let loads = 0;
  const poller = createOperationPoller({
    schedule: timers.schedule,
    cancel: timers.cancel,
    delay: 1,
    loadStatus: async () => {
      loads += 1;
      return { operation: { phase: "installing" } };
    },
  });
  poller.start();
  assert.equal(timers.size, 1);
  await timers.runNext();
  assert.equal(loads, 1);
  assert.equal(timers.size, 1);
  poller.stop();
  assert.equal(timers.size, 0);
  assert.equal(timers.cancelled.length, 1);
});

test("operation poller stops scheduling after a terminal state", async () => {
  const timers = scheduler();
  const poller = createOperationPoller({
    schedule: timers.schedule,
    cancel: timers.cancel,
    delay: 1,
    loadStatus: async () => ({ operation: { phase: "done" } }),
  });
  poller.start();
  await timers.runNext();
  assert.equal(timers.size, 0);
  poller.stop();
});

test("a newly mounted panel can resume polling an existing operation", async () => {
  const timers = scheduler();
  let phase = "installing";
  const mount = () => createOperationPoller({
    schedule: timers.schedule,
    cancel: timers.cancel,
    delay: 1,
    loadStatus: async () => ({ operation: { phase } }),
  });
  const first = mount();
  first.start();
  first.stop();
  const reopened = mount();
  reopened.start();
  phase = "failed";
  await timers.runNext();
  assert.equal(timers.size, 0);
});
