import { spawn } from "node:child_process";

const RELAUNCH_HELPER = String.raw`
const { spawn } = require('node:child_process')
const [parentPid, executable, cwd, argsJson] = process.argv.slice(1)
const args = JSON.parse(argsJson)
const waitForParent = () => {
  try {
    process.kill(Number(parentPid), 0)
    setTimeout(waitForParent, 100)
  } catch {
    setTimeout(() => {
      const child = spawn(executable, args, {
        cwd,
        env: process.env,
        detached: false,
        stdio: 'ignore',
      })
      child.once('error', () => process.exit(1))
      child.once('exit', code => process.exit(code == null ? 1 : code))
    }, 750)
  }
}
waitForParent()
`;

export function createRestartScheduler(exit, overrides = {}) {
  if (typeof exit !== "function") return { available: false, schedule() {} };
  const runtime = {
    execPath: process.execPath,
    argv: [...process.argv],
    cwd: process.cwd(),
    env: process.env,
    pid: process.pid,
    spawn,
    setTimeout,
    ...overrides,
  };
  let scheduled = false;
  return {
    available: true,
    schedule() {
      if (scheduled) return;
      scheduled = true;
      const helper = runtime.spawn(runtime.execPath, [
        "-e",
        RELAUNCH_HELPER,
        String(runtime.pid),
        runtime.execPath,
        runtime.cwd,
        JSON.stringify(runtime.argv.slice(1)),
      ], {
        cwd: runtime.cwd,
        env: runtime.env,
        detached: true,
        stdio: "ignore",
      });
      helper.unref();
      const timer = runtime.setTimeout(() => exit(0), 150);
      timer.unref?.();
    },
  };
}

function agentList(agents) {
  if (agents === null || agents === undefined || typeof agents.list !== "function") return null;
  try {
    const list = agents.list();
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

export function restartSafety(agents) {
  const list = agentList(agents);
  if (list === null) return { state: "unknown", running: null };
  const running = list.filter((agent) => agent?.status === "running").length;
  return { state: running > 0 ? "blocked" : "safe", running };
}

export async function waitForRestartSafety(agents, confirmUnknown = false) {
  const list = agentList(agents);
  if (list === null) {
    if (!confirmUnknown) {
      const error = new Error("无法确认 Agent 运行状态，请再次确认后重启");
      error.code = "RESTART_SAFETY_UNKNOWN";
      throw error;
    }
    return { state: "unknown", running: null };
  }
  const running = list.filter((agent) => agent?.status === "running").length;
  if (running > 0) {
    const error = new Error(`检测到 ${running} 个 Agent 正在运行，请等待任务结束后再重启`);
    error.code = "AGENTS_RUNNING";
    throw error;
  }
  await Promise.all(list.map((agent) => typeof agent?.whenIdle === "function" ? agent.whenIdle() : undefined));
  const after = agentList(agents);
  if (after === null) {
    if (!confirmUnknown) {
      const error = new Error("复核 Agent 状态失败，请再次确认后重启");
      error.code = "RESTART_SAFETY_UNKNOWN";
      throw error;
    }
    return { state: "unknown", running: null };
  }
  const started = after.filter((agent) => agent?.status === "running").length;
  if (started > 0) {
    const error = new Error(`检测到 ${started} 个 Agent 刚刚开始运行，请稍后再重启`);
    error.code = "AGENTS_RUNNING";
    throw error;
  }
  return { state: "safe", running: 0 };
}
