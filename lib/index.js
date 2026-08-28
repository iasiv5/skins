// src/index.js
import { readFileSync as readFileSync2 } from "node:fs";
import { homedir } from "node:os";
import { dirname as dirname3, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";

// src/host/restart.js
import { spawn } from "node:child_process";

// src/host/errors.js
function codedError(code, message, params) {
  const error = message instanceof Error ? message : new Error(message);
  error.code = code;
  if (params !== void 0) error.params = params;
  return error;
}
function publicError(error) {
  const value = {
    error: error instanceof Error ? error.message : String(error)
  };
  if (error !== null && error !== void 0 && error.code !== void 0) value.code = error.code;
  if (error !== null && error !== void 0 && error.params !== void 0) value.params = error.params;
  return value;
}

// src/host/restart.js
var RELAUNCH_HELPER = String.raw`
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
var MANAGED_RESTART_EXIT_CODE = 75;
function serviceManagedEnv(env) {
  return typeof env === "object" && env !== null && (env.INVOCATION_ID !== void 0 || env.NOTIFY_SOCKET !== void 0);
}
function createRestartScheduler(exit, overrides = {}) {
  if (typeof exit !== "function") return { available: false, schedule() {
  } };
  const runtime = {
    execPath: process.execPath,
    argv: [...process.argv],
    cwd: process.cwd(),
    env: process.env,
    pid: process.pid,
    spawn,
    setTimeout,
    ...overrides
  };
  let scheduled = false;
  return {
    available: true,
    schedule() {
      if (scheduled) return;
      scheduled = true;
      if (serviceManagedEnv(runtime.env)) {
        const managed = runtime.setTimeout(() => exit(MANAGED_RESTART_EXIT_CODE), 150);
        managed.unref?.();
        return;
      }
      const helper = runtime.spawn(runtime.execPath, [
        "-e",
        RELAUNCH_HELPER,
        String(runtime.pid),
        runtime.execPath,
        runtime.cwd,
        JSON.stringify(runtime.argv.slice(1))
      ], {
        cwd: runtime.cwd,
        env: runtime.env,
        detached: true,
        stdio: "ignore"
      });
      helper.unref();
      const timer = runtime.setTimeout(() => exit(0), 150);
      timer.unref?.();
    }
  };
}
function agentList(agents) {
  if (agents === null || agents === void 0 || typeof agents.list !== "function") return null;
  try {
    const list = agents.list();
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}
function restartSafety(agents) {
  const list = agentList(agents);
  if (list === null) return { state: "unknown", running: null };
  const running = list.filter((agent) => agent?.status === "running").length;
  return { state: running > 0 ? "blocked" : "safe", running };
}
async function waitForRestartSafety(agents, confirmUnknown = false) {
  const list = agentList(agents);
  if (list === null) {
    if (!confirmUnknown) {
      throw codedError("RESTART_SAFETY_UNKNOWN", "无法确认 Agent 运行状态，请再次确认后重启");
    }
    return { state: "unknown", running: null };
  }
  const running = list.filter((agent) => agent?.status === "running").length;
  if (running > 0) {
    throw codedError("AGENTS_RUNNING", `检测到 ${running} 个 Agent 正在运行，请等待任务结束后再重启`, { count: running });
  }
  await Promise.all(list.map((agent) => typeof agent?.whenIdle === "function" ? agent.whenIdle() : void 0));
  const after = agentList(agents);
  if (after === null) {
    if (!confirmUnknown) {
      throw codedError("RESTART_SAFETY_UNKNOWN", "复核 Agent 状态失败，请再次确认后重启");
    }
    return { state: "unknown", running: null };
  }
  const started = after.filter((agent) => agent?.status === "running").length;
  if (started > 0) {
    throw codedError("AGENTS_RUNNING", `检测到 ${started} 个 Agent 刚刚开始运行，请稍后再重启`, { count: started });
  }
  return { state: "safe", running: 0 };
}

// src/host/routes.js
function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(value));
}
function header(headers, name2) {
  const value = headers?.[name2];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : void 0;
}
function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`);
  } catch {
    return void 0;
  }
}
function canonicalAuthority(entry, parsed) {
  const port = parsed.port !== "" ? parsed.port : new URL(`https://${entry}`).port;
  return port === "" ? parsed.hostname : `${parsed.hostname}:${port}`;
}
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    const parsed = parseAuthority(entry);
    if (parsed === void 0) return false;
    return canonicalAuthority(entry, parsed) === parsed.hostname ? parsed.hostname === hostUrl.hostname : parsed.host === hostUrl.host;
  });
}
function isTrustedRequest(request, trustedHosts = []) {
  const host = header(request.headers, "host");
  if (host === void 0) return false;
  const hostUrl = parseAuthority(host);
  if (hostUrl === void 0) return false;
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
  if (header(request.headers, "sec-fetch-site") === "cross-site") return false;
  const origin = header(request.headers, "origin");
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}
async function readJsonBody(request, limit = 4096) {
  const type = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!type.startsWith("application/json")) throw new Error("content-type must be application/json");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error("request body too large");
    chunks.push(buffer);
  }
  if (size === 0) return {};
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid request body");
  return value;
}
function method(request, response, expected) {
  if (request.method === expected) return true;
  response.writeHead(405, { allow: expected });
  response.end();
  return false;
}
function mountUpdateRoutes(host, options) {
  const { updater, restart, agents, trustedHosts = [] } = options;
  const updateRoute = host.webServer.register({
    kind: "exact",
    path: "/dsh-skins/update",
    handler: async (request, response) => {
      if (!isTrustedRequest(request, trustedHosts)) return sendJson(response, 403, { error: "trusted DSH Web request required" });
      if (request.method === "GET") {
        const url = new URL(request.url ?? "/", "http://localhost");
        const force = url.searchParams.get("force") === "1" && request.headers["x-dsh-skins-force"] === "1";
        try {
          const status = await updater.status(force);
          return sendJson(response, 200, {
            ...status,
            operation: updater.currentOperation(),
            restartRequired: updater.restartRequired,
            restartAvailable: restart.available === true,
            restartSafety: restartSafety(agents)
          });
        } catch (error) {
          return sendJson(response, 502, {
            ...publicError(error),
            operation: updater.currentOperation(),
            restartRequired: updater.restartRequired,
            restartAvailable: restart.available === true,
            restartSafety: restartSafety(agents)
          });
        }
      }
      if (!method(request, response, "POST")) return;
      try {
        return sendJson(response, 202, { operation: updater.startUpdate() });
      } catch (error) {
        return sendJson(response, 409, publicError(error));
      }
    }
  });
  const restartRoute = host.webServer.register({
    kind: "exact",
    path: "/dsh-skins/restart",
    handler: async (request, response) => {
      if (!isTrustedRequest(request, trustedHosts)) return sendJson(response, 403, { error: "trusted DSH Web request required" });
      if (!method(request, response, "POST")) return;
      if (restart.available !== true) {
        return sendJson(response, 501, publicError(codedError("RESTART_UNAVAILABLE", "当前 DSH Host 不支持自重启")));
      }
      if (!updater.restartRequired) {
        return sendJson(response, 409, publicError(codedError("NO_PENDING_UPDATE", "当前没有等待重启应用的更新")));
      }
      try {
        const body = await readJsonBody(request);
        const confirmUnknown = body.confirmUnknown === true;
        await waitForRestartSafety(agents, confirmUnknown);
        sendJson(response, 202, { restarting: true });
        restart.schedule();
      } catch (error) {
        sendJson(response, 409, {
          ...publicError(error),
          restartSafety: restartSafety(agents)
        });
      }
    }
  });
  return () => {
    restartRoute();
    updateRoute();
  };
}

// src/host/self-update.js
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
var PACKAGE_NAME = "dsh-skins";
var REPOSITORY = "iasiv5/skins";
var CACHE_TTL_MS = 60 * 60 * 1e3;
var GITHUB_API = `https://api.github.com/repos/${REPOSITORY}`;
var CACHE_SCHEMA_VERSION = 1;
var PROFILE_FILES = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"];
var STABLE_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
var SHA_RE = /^[0-9a-f]{40}$/i;
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function parseStableVersion(value) {
  const raw = String(value ?? "").trim();
  const version = raw.startsWith("v") ? raw.slice(1) : raw;
  const match = STABLE_VERSION_RE.exec(version);
  if (match === null) return null;
  return {
    version,
    tag: `v${version}`,
    parts: match.slice(1).map(Number)
  };
}
function compareStableVersions(left, right) {
  const a = parseStableVersion(left);
  const b = parseStableVersion(right);
  if (a === null || b === null) throw new Error("invalid stable semantic version");
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] === b.parts[index]) continue;
    return a.parts[index] > b.parts[index] ? 1 : -1;
  }
  return 0;
}
function repositoryIdentity(value) {
  const raw = typeof value === "string" ? value : isRecord(value) && typeof value.url === "string" ? value.url : "";
  return raw.trim().replace(/^git\+/, "").replace(/^git@github\.com:/i, "").replace(/^ssh:\/\/git@github\.com\//i, "").replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
}
function detectInstallSource(spec) {
  const value = String(spec ?? "").trim();
  if (/^link:/i.test(value)) return { kind: "link", spec: value };
  if (/^file:/i.test(value) || /\.tgz(?:$|[?#])/i.test(value)) return { kind: "file", spec: value };
  const github = value.replace(/^git\+/, "").replace(/^github:/i, "").replace(/^git@github\.com:/i, "").replace(/^ssh:\/\/git@github\.com\//i, "").replace(/^https?:\/\/github\.com\//i, "").split("#")[0].replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
  if (github === REPOSITORY.toLowerCase()) return { kind: "github", spec: value };
  return { kind: "unknown", spec: value };
}
function resolveInstalledCommit(profileDir, spec) {
  const direct = /#([0-9a-f]{40})(?:$|&)/i.exec(String(spec ?? ""));
  if (direct !== null) return direct[1].toLowerCase();
  let lock;
  try {
    lock = readFileSync(join(profileDir, "pnpm-lock.yaml"), "utf8");
  } catch {
    return null;
  }
  const importer = /\n {6}dsh-skins:\n(?<body>(?: {8}[^\n]*\n)+)/u.exec(lock)?.groups?.body;
  if (importer === void 0) return null;
  const resolved = /https:\/\/codeload\.github\.com\/iasiv5\/skins\/tar\.gz\/([0-9a-f]{40})(?:[^\n]*)/i.exec(importer);
  return resolved === null ? null : resolved[1].toLowerCase();
}
function atomicWriteText(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, content);
  renameSync(temporary, file);
}
function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function readProfileManifest(profileDir) {
  return readJson(join(profileDir, "package.json"), {});
}
function readInstalledManifest(profileDir) {
  return readJson(join(profileDir, "node_modules", PACKAGE_NAME, "package.json"), null);
}
function captureProfileSnapshot(profileDir) {
  return PROFILE_FILES.map((name2) => {
    const file = join(profileDir, name2);
    return {
      name: name2,
      exists: existsSync(file),
      content: existsSync(file) ? readFileSync(file) : null
    };
  });
}
function restoreProfileSnapshot(profileDir, snapshot) {
  for (const item of snapshot) {
    const file = join(profileDir, item.name);
    if (item.exists) {
      mkdirSync(dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.rollback`;
      writeFileSync(temporary, item.content);
      renameSync(temporary, file);
    } else if (existsSync(file)) {
      unlinkSync(file);
    }
  }
}
function preserveProfileBundles(profileDir, snapshot) {
  const packageSnapshot = snapshot.find((item) => item.name === "package.json" && item.exists);
  if (packageSnapshot?.content === null || packageSnapshot?.content === void 0) return;
  let before;
  try {
    before = JSON.parse(packageSnapshot.content.toString("utf8"));
  } catch {
    return;
  }
  const bundles = before.dsh?.profile?.bundles;
  if (!Array.isArray(bundles) || !bundles.includes(PACKAGE_NAME)) return;
  const current = readProfileManifest(profileDir);
  current.dsh = {
    ...current.dsh,
    profile: {
      ...current.dsh?.profile,
      bundles: [...bundles]
    }
  };
  atomicWriteText(join(profileDir, "package.json"), `${JSON.stringify(current, null, 2)}
`);
}
function validatePluginManifest(manifest, expectedVersion) {
  if (!isRecord(manifest)) throw codedError("RELEASE_MANIFEST_MISSING", "Release 缺少 package.json");
  if (manifest.name !== PACKAGE_NAME) {
    throw codedError("RELEASE_NAME_MISMATCH", `Release 包名必须是 ${PACKAGE_NAME}`, { expected: PACKAGE_NAME });
  }
  if (manifest.version !== expectedVersion) {
    throw codedError(
      "RELEASE_VERSION_MISMATCH",
      `Release tag v${expectedVersion} 与包版本 ${String(manifest.version ?? "missing")} 不一致`,
      { tag: expectedVersion, version: String(manifest.version ?? "missing") }
    );
  }
  if (repositoryIdentity(manifest.repository) !== REPOSITORY.toLowerCase()) {
    throw codedError("RELEASE_REPOSITORY_MISMATCH", `Release 仓库必须是 ${REPOSITORY}`, { repository: REPOSITORY });
  }
  if (!isRecord(manifest.dsh) || !isRecord(manifest.dsh.client) || manifest.dsh.client.platform !== "web") {
    throw codedError("RELEASE_NOT_WEB_PLUGIN", "Release 包不是 DSH Web 客户端插件");
  }
  if (!isRecord(manifest.dsh.bundle) || typeof manifest.dsh.bundle.patch !== "string") {
    throw codedError("RELEASE_NO_BUNDLE_PATCH", "Release 包未声明 DSH bundle patch");
  }
  return manifest;
}
async function fetchGitHubJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": `dsh-skins/${options.currentVersion ?? "unknown"}`,
      "x-github-api-version": "2022-11-28"
    },
    signal: options.signal
  });
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const rateLimited = remaining === "0";
    const suffix = rateLimited ? "；GitHub 未认证请求额度已用完" : "";
    throw codedError(
      rateLimited ? "GITHUB_CHECK_RATE_LIMITED" : "GITHUB_CHECK_FAILED",
      `GitHub 更新检查失败（HTTP ${response.status}）${suffix}`,
      { status: response.status }
    );
  }
  return response.json();
}
async function fetchLatestStableRelease(options = {}) {
  const raw = await (options.fetchJson ?? fetchGitHubJson)(`${GITHUB_API}/releases/latest`, options);
  if (raw.draft === true || raw.prerelease === true) {
    throw codedError("RELEASE_NOT_STABLE", "GitHub latest release 不是正式版本");
  }
  const parsed = parseStableVersion(raw.tag_name);
  if (parsed === null || raw.tag_name !== parsed.tag) {
    throw codedError(
      "RELEASE_TAG_INVALID",
      `Release tag 必须严格使用 vX.Y.Z：${String(raw.tag_name ?? "missing")}`,
      { tag: String(raw.tag_name ?? "missing") }
    );
  }
  return {
    version: parsed.version,
    tag: parsed.tag,
    htmlUrl: typeof raw.html_url === "string" ? raw.html_url : `https://github.com/${REPOSITORY}/releases/tag/${parsed.tag}`,
    name: typeof raw.name === "string" && raw.name.trim() !== "" ? raw.name.trim() : parsed.tag
  };
}
async function resolveReleaseArtifact(release, options = {}) {
  const fetchJson = options.fetchJson ?? fetchGitHubJson;
  const ref = await fetchJson(`${GITHUB_API}/git/ref/tags/${encodeURIComponent(release.tag)}`, options);
  let object = ref.object;
  for (let depth = 0; depth < 5 && isRecord(object) && object.type === "tag"; depth += 1) {
    if (!SHA_RE.test(String(object.sha ?? ""))) {
      throw codedError("RELEASE_SHA_INVALID", "Release tag object 缺少有效 SHA");
    }
    const annotated = await fetchJson(`${GITHUB_API}/git/tags/${object.sha}`, options);
    object = annotated.object;
  }
  if (!isRecord(object) || object.type !== "commit" || !SHA_RE.test(String(object.sha ?? ""))) {
    throw codedError("RELEASE_SHA_MISSING", "Release tag 未解析到完整 commit SHA");
  }
  const commit = String(object.sha).toLowerCase();
  const content = await fetchJson(`${GITHUB_API}/contents/package.json?ref=${commit}`, options);
  if (content.encoding !== "base64" || typeof content.content !== "string") {
    throw codedError("RELEASE_PACKAGE_MISSING", "Release commit 缺少可读取的 package.json");
  }
  let manifest;
  try {
    manifest = JSON.parse(Buffer.from(content.content.replace(/\s/g, ""), "base64").toString("utf8"));
  } catch {
    throw codedError("RELEASE_PACKAGE_INVALID", "Release commit 的 package.json 无效");
  }
  validatePluginManifest(manifest, release.version);
  return { ...release, commit, manifest };
}
function cachePayload(currentVersion, checkedAt, release) {
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    currentVersion,
    checkedAt,
    release
  };
}
function validCachedRelease(value, currentVersion, now, ttlMs) {
  if (!isRecord(value) || value.schemaVersion !== CACHE_SCHEMA_VERSION) return null;
  if (value.currentVersion !== currentVersion) return null;
  if (!Number.isFinite(value.checkedAt) || now - value.checkedAt < 0 || now - value.checkedAt >= ttlMs) return null;
  const release = value.release;
  if (!isRecord(release) || parseStableVersion(release.version) === null) return null;
  if (release.tag !== `v${release.version}` || typeof release.htmlUrl !== "string") return null;
  return { checkedAt: value.checkedAt, release };
}
function publicOperation(operation) {
  if (operation === null) return null;
  return {
    id: operation.id,
    phase: operation.phase,
    message: operation.message,
    startedAt: operation.startedAt,
    ...operation.finishedAt === void 0 ? {} : { finishedAt: operation.finishedAt },
    ...operation.error === void 0 ? {} : { error: operation.error },
    ...operation.rolledBack === void 0 ? {} : { rolledBack: operation.rolledBack },
    ...operation.release === void 0 ? {} : { release: operation.release },
    ...operation.code === void 0 ? {} : { code: operation.code },
    ...operation.params === void 0 ? {} : { params: operation.params },
    ...operation.rollbackError === void 0 ? {} : { rollbackError: operation.rollbackError }
  };
}
function sourceReason(source) {
  if (source.kind === "link") return "development-link";
  if (source.kind === "file") return "local-file";
  if (source.kind !== "github") return "unsupported-source";
  return null;
}
function validateInstalledState(profileDir, artifact) {
  const profile = readProfileManifest(profileDir);
  const dependency = profile.dependencies?.[PACKAGE_NAME];
  if (typeof dependency !== "string" || !dependency.toLowerCase().includes(artifact.commit)) {
    throw codedError("PROFILE_NOT_PINNED", "profile 未固定到已验证的更新 commit");
  }
  if (!Array.isArray(profile.dsh?.profile?.bundles) || !profile.dsh.profile.bundles.includes(PACKAGE_NAME)) {
    throw codedError("PROFILE_BUNDLE_MISSING", "profile 未注册 dsh-skins bundle");
  }
  const installed = readInstalledManifest(profileDir);
  validatePluginManifest(installed, artifact.version);
  return installed;
}
function createSelfUpdater(options, dependencies = {}) {
  const profileDir = options.profileDir;
  const cacheFile = options.cacheFile;
  const ttlMs = options.ttlMs ?? CACHE_TTL_MS;
  const now = dependencies.now ?? Date.now;
  const latestRelease = dependencies.fetchLatestRelease ?? fetchLatestStableRelease;
  const resolveArtifact = dependencies.resolveReleaseArtifact ?? resolveReleaseArtifact;
  const runner = dependencies.runner;
  if (typeof runner !== "function") throw new Error("self updater requires a profile runner");
  let currentVersion = options.currentVersion;
  if (parseStableVersion(currentVersion) === null) throw new Error(`invalid current version ${currentVersion}`);
  let memoryCache = null;
  let operation = null;
  let updatePromise = null;
  let restartRequired = false;
  const readSource = () => {
    const profile = readProfileManifest(profileDir);
    return detectInstallSource(profile.dependencies?.[PACKAGE_NAME]);
  };
  const readCache = () => {
    if (memoryCache !== null) {
      const valid2 = validCachedRelease(memoryCache, currentVersion, now(), ttlMs);
      if (valid2 !== null) return valid2;
    }
    const disk = readJson(cacheFile, null);
    const valid = validCachedRelease(disk, currentVersion, now(), ttlMs);
    if (valid !== null) memoryCache = disk;
    return valid;
  };
  const writeCache = (checkedAt, release) => {
    memoryCache = cachePayload(currentVersion, checkedAt, release);
    atomicWriteText(cacheFile, `${JSON.stringify(memoryCache, null, 2)}
`);
  };
  const buildStatus = (release, checkedAt, cached) => {
    const source = readSource();
    const releaseNewer = compareStableVersions(release.version, currentVersion) > 0;
    const disabledReason = sourceReason(source);
    return {
      currentVersion,
      source,
      latest: release,
      checkedAt,
      cached,
      updateAvailable: releaseNewer,
      canUpdate: releaseNewer && disabledReason === null,
      disabledReason,
      restartRequired
    };
  };
  const status = async (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached !== null) return buildStatus(cached.release, cached.checkedAt, true);
    }
    const signal = AbortSignal.timeout(1e4);
    const release = await latestRelease({ currentVersion, signal });
    const checkedAt = now();
    writeCache(checkedAt, release);
    return buildStatus(release, checkedAt, false);
  };
  const setOperation = (patch) => {
    Object.assign(operation, patch);
    if (operation.phase === "done" || operation.phase === "failed") {
      operation.finishedAt = new Date(now()).toISOString();
    }
  };
  const executeUpdate = async () => {
    let snapshot = null;
    let previousSpec = null;
    let previousVersion = null;
    let previousCommit = null;
    try {
      setOperation({ phase: "checking", message: "正在重新检查最新正式版本" });
      const before = await status(true);
      if (!before.canUpdate) {
        if (before.disabledReason === "development-link") {
          throw codedError("UPDATE_LINK_PROTECTED", "本地 link 开发模式不会被在线更新覆盖");
        }
        if (before.updateAvailable) {
          throw codedError("UPDATE_SOURCE_UNSUPPORTED", "当前安装来源不支持一键更新");
        }
        throw codedError("UPDATE_ALREADY_LATEST", "已经是最新正式版本");
      }
      setOperation({ phase: "preparing", message: "正在验证 Release 与固定提交" });
      const artifact = await resolveArtifact(before.latest, {
        currentVersion,
        signal: AbortSignal.timeout(15e3)
      });
      operation.release = {
        version: artifact.version,
        tag: artifact.tag,
        htmlUrl: artifact.htmlUrl,
        commit: artifact.commit
      };
      const profile = readProfileManifest(profileDir);
      previousSpec = profile.dependencies?.[PACKAGE_NAME];
      const previousManifest = readInstalledManifest(profileDir);
      previousVersion = previousManifest?.version ?? currentVersion;
      if (detectInstallSource(previousSpec).kind !== "github") {
        throw codedError("UPDATE_SOURCE_CHANGED", "更新开始前安装来源已变化，请重新打开皮肤切换器");
      }
      validatePluginManifest(previousManifest, previousVersion);
      previousCommit = resolveInstalledCommit(profileDir, previousSpec);
      if (previousCommit === null) {
        throw codedError("UPDATE_ORIGIN_UNRESOLVED", "无法从当前 GitHub 安装或 lockfile 解析原版本 commit，已停止更新");
      }
      snapshot = captureProfileSnapshot(profileDir);
      setOperation({ phase: "installing", message: `正在安装 ${artifact.tag}` });
      await runner("web", ["add", `github:${REPOSITORY}#${artifact.commit}`], {
        onChunk: (chunk) => {
          if (String(chunk).trim() !== "") operation.message = `正在安装 ${artifact.tag}`;
        }
      });
      preserveProfileBundles(profileDir, snapshot);
      setOperation({ phase: "validating", message: "正在校验安装结果" });
      validateInstalledState(profileDir, artifact);
      currentVersion = artifact.version;
      restartRequired = true;
      writeCache(now(), {
        version: artifact.version,
        tag: artifact.tag,
        htmlUrl: artifact.htmlUrl,
        name: artifact.name
      });
      setOperation({ phase: "done", message: `已安装 ${artifact.tag}，重启后生效`, rolledBack: false });
    } catch (error) {
      const original = error instanceof Error ? error : new Error(String(error));
      let rollbackError = null;
      let rolledBack = false;
      if (snapshot !== null && typeof previousSpec === "string" && previousCommit !== null) {
        setOperation({ phase: "rollback", message: "更新失败，正在恢复原版本" });
        try {
          await runner("web", ["add", `github:${REPOSITORY}#${previousCommit}`], {});
          restoreProfileSnapshot(profileDir, snapshot);
          const restored = readInstalledManifest(profileDir);
          validatePluginManifest(restored, previousVersion);
          if (resolveInstalledCommit(profileDir, previousSpec) !== previousCommit) {
            throw codedError("ROLLBACK_LOCKFILE_MISMATCH", "恢复后的 lockfile commit 校验失败");
          }
          const restoredProfile = readProfileManifest(profileDir);
          if (!Array.isArray(restoredProfile.dsh?.profile?.bundles) || !restoredProfile.dsh.profile.bundles.includes(PACKAGE_NAME)) {
            throw codedError("ROLLBACK_BUNDLE_MISSING", "恢复后的 bundle 注册校验失败");
          }
          rolledBack = true;
        } catch (rollbackFailure) {
          rollbackError = rollbackFailure instanceof Error ? rollbackFailure : new Error(String(rollbackFailure));
          try {
            restoreProfileSnapshot(profileDir, snapshot);
          } catch {
          }
        }
      }
      const message = rollbackError === null ? original.message : `${original.message}；自动回滚失败：${rollbackError.message}`;
      setOperation({
        phase: "failed",
        message,
        error: message,
        rolledBack,
        ...original.code === void 0 ? {} : { code: original.code },
        ...original.params === void 0 ? {} : { params: original.params },
        ...rollbackError === null ? {} : {
          rollbackError: {
            message: rollbackError.message,
            ...rollbackError.code === void 0 ? {} : { code: rollbackError.code },
            ...rollbackError.params === void 0 ? {} : { params: rollbackError.params }
          }
        }
      });
    } finally {
      updatePromise = null;
    }
  };
  return {
    async status(force = false) {
      return status(force);
    },
    startUpdate() {
      if (updatePromise !== null) return publicOperation(operation);
      operation = {
        id: randomUUID(),
        phase: "queued",
        message: "更新已排队",
        startedAt: new Date(now()).toISOString()
      };
      updatePromise = executeUpdate();
      return publicOperation(operation);
    },
    currentOperation() {
      return publicOperation(operation);
    },
    get restartRequired() {
      return restartRequired;
    }
  };
}

// src/host/runner.js
import { spawn as spawn2 } from "node:child_process";
import { dirname as dirname2, resolve } from "node:path";
var COMMAND_TIMEOUT_MS = 10 * 60 * 1e3;
var WINDOWS_METACHARS = /[\s"&|<>^()%!]/;
function quoteWindowsArg(value) {
  if (!WINDOWS_METACHARS.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
function spawnPortable(file, args, options) {
  const { viaShell = false, ...spawnOptions } = options;
  if (process.platform !== "win32" || viaShell !== true) {
    return spawn2(file, args, { ...spawnOptions, shell: false });
  }
  const commandLine = [file, ...args].map(quoteWindowsArg).join(" ");
  return spawn2(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${commandLine}"`], {
    ...spawnOptions,
    shell: false,
    windowsVerbatimArguments: true
  });
}
function currentDshInvocation() {
  const entry = process.argv[1];
  if (entry !== void 0 && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const absolute = resolve(entry);
    return {
      file: process.execPath,
      prefix: [...process.execArgv, absolute],
      cwd: dirname2(absolute),
      viaShell: false
    };
  }
  return { file: "dsh", prefix: [], cwd: void 0, viaShell: process.platform === "win32" };
}
function runDshPlugin(profile, args, options = {}) {
  const invocation = options.invocation ?? currentDshInvocation();
  const argv = [...invocation.prefix, "plugin", "--profile", profile, ...args, "--reporter=ndjson"];
  return new Promise((resolvePromise, reject) => {
    const child = spawnPortable(invocation.file, argv, {
      cwd: invocation.cwd,
      env: { ...process.env, CI: "true" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      viaShell: invocation.viaShell
    });
    let output = "";
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolvePromise(output);
    };
    const append = (chunk) => {
      const text = String(chunk);
      output = (output + text).slice(-256 * 1024);
      options.onChunk?.(text);
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", finish);
    child.on("close", (code) => {
      if (code === 0) finish();
      else {
        const tail = output.trim().slice(-1200) || "no output";
        finish(codedError(
          "UPDATE_COMMAND_FAILED",
          `DSH 插件更新失败（exit ${String(code)}）：${tail}`,
          { exitCode: String(code), output: tail }
        ));
      }
    });
    const timer = setTimeout(() => {
      if (child.pid !== void 0) {
        try {
          if (process.platform === "win32") child.kill("SIGTERM");
          else process.kill(-child.pid, "SIGTERM");
        } catch {
        }
      }
      finish(codedError("UPDATE_COMMAND_TIMEOUT", "DSH 插件更新超时"));
    }, options.timeoutMs ?? COMMAND_TIMEOUT_MS);
    timer.unref?.();
  });
}

// src/index.js
var name = "dsh-skins";
function packageRoot() {
  return join2(dirname3(fileURLToPath(import.meta.url)), "..");
}
function packageVersion() {
  const manifest = JSON.parse(readFileSync2(join2(packageRoot(), "package.json"), "utf8"));
  if (typeof manifest.version !== "string") throw new Error("dsh-skins package.json 缺少版本号");
  return manifest.version;
}
function dshHome() {
  return process.env.DSH_HOME?.trim() || join2(homedir(), ".dsh");
}
function apply(ctx) {
  ctx.inject(["webServer", "agents", "webRuntime"], (hostContext) => {
    const root = dshHome();
    const profileDir = join2(root, "profiles", "web");
    const updater = createSelfUpdater({
      profileDir,
      cacheFile: join2(root, "dsh-skins", "update-cache.json"),
      currentVersion: packageVersion()
    }, {
      runner: runDshPlugin
    });
    const restart = createRestartScheduler(ctx.get("appExit"));
    hostContext.effect(() => mountUpdateRoutes(hostContext, {
      updater,
      restart,
      agents: hostContext.agents,
      trustedHosts: hostContext.webRuntime.trustedHosts
    }), "dsh-skins: self-update routes");
  });
}
export {
  apply,
  createSelfUpdater,
  name
};
