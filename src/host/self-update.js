import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export const PACKAGE_NAME = "dsh-skins";
export const REPOSITORY = "iasiv5/skins";
export const CACHE_TTL_MS = 60 * 60 * 1000;
export const GITHUB_API = `https://api.github.com/repos/${REPOSITORY}`;
const CACHE_SCHEMA_VERSION = 1;
const PROFILE_FILES = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"];
const STABLE_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA_RE = /^[0-9a-f]{40}$/i;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseStableVersion(value) {
  const raw = String(value ?? "").trim();
  const version = raw.startsWith("v") ? raw.slice(1) : raw;
  const match = STABLE_VERSION_RE.exec(version);
  if (match === null) return null;
  return {
    version,
    tag: `v${version}`,
    parts: match.slice(1).map(Number),
  };
}

export function compareStableVersions(left, right) {
  const a = parseStableVersion(left);
  const b = parseStableVersion(right);
  if (a === null || b === null) throw new Error("invalid stable semantic version");
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] === b.parts[index]) continue;
    return a.parts[index] > b.parts[index] ? 1 : -1;
  }
  return 0;
}

export function repositoryIdentity(value) {
  const raw = typeof value === "string"
    ? value
    : isRecord(value) && typeof value.url === "string" ? value.url : "";
  return raw
    .trim()
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/^ssh:\/\/git@github\.com\//i, "")
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export function detectInstallSource(spec) {
  const value = String(spec ?? "").trim();
  if (/^link:/i.test(value)) return { kind: "link", spec: value };
  if (/^file:/i.test(value) || /\.tgz(?:$|[?#])/i.test(value)) return { kind: "file", spec: value };
  const github = value
    .replace(/^git\+/, "")
    .replace(/^github:/i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/^ssh:\/\/git@github\.com\//i, "")
    .replace(/^https?:\/\/github\.com\//i, "")
    .split("#")[0]
    .replace(/\.git$/i, "")
    .replace(/\/$/, "")
    .toLowerCase();
  if (github === REPOSITORY.toLowerCase()) return { kind: "github", spec: value };
  return { kind: "unknown", spec: value };
}

export function resolveInstalledCommit(profileDir, spec) {
  const direct = /#([0-9a-f]{40})(?:$|&)/i.exec(String(spec ?? ""));
  if (direct !== null) return direct[1].toLowerCase();
  let lock;
  try {
    lock = readFileSync(join(profileDir, "pnpm-lock.yaml"), "utf8");
  } catch {
    return null;
  }
  const importer = /\n {6}dsh-skins:\n(?<body>(?: {8}[^\n]*\n)+)/u.exec(lock)?.groups?.body;
  if (importer === undefined) return null;
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

export function readProfileManifest(profileDir) {
  return readJson(join(profileDir, "package.json"), {});
}

export function readInstalledManifest(profileDir) {
  return readJson(join(profileDir, "node_modules", PACKAGE_NAME, "package.json"), null);
}

export function captureProfileSnapshot(profileDir) {
  return PROFILE_FILES.map((name) => {
    const file = join(profileDir, name);
    return {
      name,
      exists: existsSync(file),
      content: existsSync(file) ? readFileSync(file) : null,
    };
  });
}

export function restoreProfileSnapshot(profileDir, snapshot) {
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
  if (packageSnapshot?.content === null || packageSnapshot?.content === undefined) return;
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
      bundles: [...bundles],
    },
  };
  atomicWriteText(join(profileDir, "package.json"), `${JSON.stringify(current, null, 2)}\n`);
}

function validatePluginManifest(manifest, expectedVersion) {
  if (!isRecord(manifest)) throw new Error("release package.json is missing");
  if (manifest.name !== PACKAGE_NAME) throw new Error(`release package name must be ${PACKAGE_NAME}`);
  if (manifest.version !== expectedVersion) {
    throw new Error(`release tag v${expectedVersion} does not match package version ${String(manifest.version ?? "missing")}`);
  }
  if (repositoryIdentity(manifest.repository) !== REPOSITORY.toLowerCase()) {
    throw new Error(`release repository must be ${REPOSITORY}`);
  }
  if (!isRecord(manifest.dsh) || !isRecord(manifest.dsh.client) || manifest.dsh.client.platform !== "web") {
    throw new Error("release package is not a DSH Web client plugin");
  }
  if (!isRecord(manifest.dsh.bundle) || typeof manifest.dsh.bundle.patch !== "string") {
    throw new Error("release package does not declare a DSH bundle patch");
  }
  return manifest;
}

async function fetchGitHubJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": `dsh-skins/${options.currentVersion ?? "unknown"}`,
      "x-github-api-version": "2022-11-28",
    },
    signal: options.signal,
  });
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const suffix = remaining === "0" ? "；GitHub 未认证请求额度已用完" : "";
    throw new Error(`GitHub 更新检查失败（HTTP ${response.status}）${suffix}`);
  }
  return response.json();
}

export async function fetchLatestStableRelease(options = {}) {
  const raw = await (options.fetchJson ?? fetchGitHubJson)(`${GITHUB_API}/releases/latest`, options);
  if (raw.draft === true || raw.prerelease === true) throw new Error("GitHub latest release 不是正式版本");
  const parsed = parseStableVersion(raw.tag_name);
  if (parsed === null || raw.tag_name !== parsed.tag) {
    throw new Error(`Release tag 必须严格使用 vX.Y.Z：${String(raw.tag_name ?? "missing")}`);
  }
  return {
    version: parsed.version,
    tag: parsed.tag,
    htmlUrl: typeof raw.html_url === "string"
      ? raw.html_url
      : `https://github.com/${REPOSITORY}/releases/tag/${parsed.tag}`,
    name: typeof raw.name === "string" && raw.name.trim() !== "" ? raw.name.trim() : parsed.tag,
  };
}

export async function resolveReleaseArtifact(release, options = {}) {
  const fetchJson = options.fetchJson ?? fetchGitHubJson;
  const ref = await fetchJson(`${GITHUB_API}/git/ref/tags/${encodeURIComponent(release.tag)}`, options);
  let object = ref.object;
  for (let depth = 0; depth < 5 && isRecord(object) && object.type === "tag"; depth += 1) {
    if (!SHA_RE.test(String(object.sha ?? ""))) throw new Error("Release tag object 缺少有效 SHA");
    const annotated = await fetchJson(`${GITHUB_API}/git/tags/${object.sha}`, options);
    object = annotated.object;
  }
  if (!isRecord(object) || object.type !== "commit" || !SHA_RE.test(String(object.sha ?? ""))) {
    throw new Error("Release tag 未解析到完整 commit SHA");
  }
  const commit = String(object.sha).toLowerCase();
  const content = await fetchJson(`${GITHUB_API}/contents/package.json?ref=${commit}`, options);
  if (content.encoding !== "base64" || typeof content.content !== "string") {
    throw new Error("Release commit 缺少可读取的 package.json");
  }
  let manifest;
  try {
    manifest = JSON.parse(Buffer.from(content.content.replace(/\s/g, ""), "base64").toString("utf8"));
  } catch {
    throw new Error("Release commit 的 package.json 无效");
  }
  validatePluginManifest(manifest, release.version);
  return { ...release, commit, manifest };
}

function cachePayload(currentVersion, checkedAt, release) {
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    currentVersion,
    checkedAt,
    release,
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
    ...(operation.finishedAt === undefined ? {} : { finishedAt: operation.finishedAt }),
    ...(operation.error === undefined ? {} : { error: operation.error }),
    ...(operation.rolledBack === undefined ? {} : { rolledBack: operation.rolledBack }),
    ...(operation.release === undefined ? {} : { release: operation.release }),
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
    throw new Error("profile 未固定到已验证的更新 commit");
  }
  if (!Array.isArray(profile.dsh?.profile?.bundles) || !profile.dsh.profile.bundles.includes(PACKAGE_NAME)) {
    throw new Error("profile 未注册 dsh-skins bundle");
  }
  const installed = readInstalledManifest(profileDir);
  validatePluginManifest(installed, artifact.version);
  return installed;
}

export function createSelfUpdater(options, dependencies = {}) {
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
      const valid = validCachedRelease(memoryCache, currentVersion, now(), ttlMs);
      if (valid !== null) return valid;
    }
    const disk = readJson(cacheFile, null);
    const valid = validCachedRelease(disk, currentVersion, now(), ttlMs);
    if (valid !== null) memoryCache = disk;
    return valid;
  };

  const writeCache = (checkedAt, release) => {
    memoryCache = cachePayload(currentVersion, checkedAt, release);
    atomicWriteText(cacheFile, `${JSON.stringify(memoryCache, null, 2)}\n`);
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
      restartRequired,
    };
  };

  const status = async (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached !== null) return buildStatus(cached.release, cached.checkedAt, true);
    }
    const signal = AbortSignal.timeout(10_000);
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
        const reason = before.disabledReason === "development-link"
          ? "本地 link 开发模式不会被在线更新覆盖"
          : before.updateAvailable ? "当前安装来源不支持一键更新" : "已经是最新正式版本";
        throw new Error(reason);
      }

      setOperation({ phase: "preparing", message: "正在验证 Release 与固定提交" });
      const artifact = await resolveArtifact(before.latest, {
        currentVersion,
        signal: AbortSignal.timeout(15_000),
      });
      operation.release = {
        version: artifact.version,
        tag: artifact.tag,
        htmlUrl: artifact.htmlUrl,
        commit: artifact.commit,
      };

      const profile = readProfileManifest(profileDir);
      previousSpec = profile.dependencies?.[PACKAGE_NAME];
      const previousManifest = readInstalledManifest(profileDir);
      previousVersion = previousManifest?.version ?? currentVersion;
      if (detectInstallSource(previousSpec).kind !== "github") {
        throw new Error("更新开始前安装来源已变化，请重新打开皮肤切换器");
      }
      validatePluginManifest(previousManifest, previousVersion);
      previousCommit = resolveInstalledCommit(profileDir, previousSpec);
      if (previousCommit === null) {
        throw new Error("无法从当前 GitHub 安装或 lockfile 解析原版本 commit，已停止更新");
      }
      snapshot = captureProfileSnapshot(profileDir);

      setOperation({ phase: "installing", message: `正在安装 ${artifact.tag}` });
      await runner("web", ["add", `github:${REPOSITORY}#${artifact.commit}`], {
        onChunk: (chunk) => {
          if (String(chunk).trim() !== "") operation.message = `正在安装 ${artifact.tag}`;
        },
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
        name: artifact.name,
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
            throw new Error("恢复后的 lockfile commit 校验失败");
          }
          const restoredProfile = readProfileManifest(profileDir);
          if (!Array.isArray(restoredProfile.dsh?.profile?.bundles) || !restoredProfile.dsh.profile.bundles.includes(PACKAGE_NAME)) {
            throw new Error("恢复后的 bundle 注册校验失败");
          }
          rolledBack = true;
        } catch (rollbackFailure) {
          rollbackError = rollbackFailure instanceof Error ? rollbackFailure : new Error(String(rollbackFailure));
          try { restoreProfileSnapshot(profileDir, snapshot); } catch {}
        }
      }
      const message = rollbackError === null
        ? original.message
        : `${original.message}；自动回滚失败：${rollbackError.message}`;
      setOperation({ phase: "failed", message, error: message, rolledBack });
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
        startedAt: new Date(now()).toISOString(),
      };
      updatePromise = executeUpdate();
      return publicOperation(operation);
    },
    currentOperation() {
      return publicOperation(operation);
    },
    get restartRequired() {
      return restartRequired;
    },
  };
}
