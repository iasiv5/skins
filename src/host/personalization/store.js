/**
 * PersonalizationStore — the single owner of `$DSH_HOME/dsh-skins/` mutable
 * state (design §5). Every mutating Host route goes through here; route
 * handlers only do trust fencing, HTTP codec and error mapping.
 *
 * On-disk layout:
 *   state.json              the ONE mutable state file (atomic temp+rename)
 *   assets/u_<id>.<ext>     immutable content-addressed-by-id blobs
 *   staging/<uuid>/         in-flight writes (cleaned on error, GC'd after 24h)
 *   quarantine/             unrecognized files moved ONLY after recovery is
 *                           confirmed by the user (branch A, design §5.3)
 *
 * Boot modes:
 *   normal      state healthy → full read/write, GC enabled
 *   recovery    state corrupt/empty/missing while assets exist → NO destructive
 *               GC, candidate library rebuilt from blobs by sniffing, config
 *               overrides reported as lost; user confirm restores normal
 *   unsupported state configVersion > CONFIG_VERSION → strict zero writes:
 *               no rebuild, no moves, no staging cleanup, no GC (design §5.3 B)
 *
 * Durability contract (design §5.2): rename-based atomicity covers process
 * crashes and exception paths. Power loss may lose the state file — recovery
 * mode then guarantees blobs survive while config overrides may not.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statfsSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { codedError } from "../errors.js";
import { atomicWriteText } from "../atomic-write.js";
import { detectImageMeta, extensionForMime } from "./image-meta.js";
import { readStoreOnlyZip, writeStoreOnlyZip } from "./zip.js";
import {
  ASSET_ID_PATTERN,
  ASSET_ID_PREFIX,
  CONFIG_VERSION,
  GIF_MAX_PIXELS,
  GLOBAL_MAX_BYTES,
  GLOBAL_MAX_PIXELS,
  getField,
  getSkinSchema,
  listAssetFields,
  resolveImageRef,
  validateOverride,
} from "../../shared/personalization/catalog.js";

const STATE_FILE = "state.json";
const ASSETS_DIR = "assets";
const STAGING_DIR = "staging";
const QUARANTINE_DIR = "quarantine";
const STAGING_TTL_MS = 24 * 60 * 60 * 1000;
const DISK_SAFETY_RESERVE = 64 * 1024 * 1024;
const CORRUPT_BACKUP_LIMIT = 3;
const IMPORT_TTL_MS = 10 * 60 * 1000;

function defaultFs() {
  return {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
    renameSync,
    unlinkSync,
    readdirSync,
    rmdirSync,
    statSync,
    statfsSync,
  };
}

function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Strip control characters and clamp to a byte budget; null when invalid. */
function sanitizeDisplayName(name) {
  if (typeof name !== "string") return null;
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, "");
  if (cleaned.trim().length === 0) return null;
  if (Buffer.byteLength(cleaned, "utf8") > 200) return null;
  return cleaned;
}

function isValidStateShape(state) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) return false;
  if (!Number.isInteger(state.configVersion) || state.configVersion < 1) return false;
  if (!Number.isInteger(state.revision) || state.revision < 0) return false;
  if (typeof state.skins !== "object" || state.skins === null || Array.isArray(state.skins)) return false;
  if (typeof state.library !== "object" || state.library === null || Array.isArray(state.library)) return false;
  return true;
}

function emptyState() {
  return { configVersion: CONFIG_VERSION, revision: 0, skins: {}, library: {} };
}

export function createPersonalizationStore(options = {}) {
  const dataDir = options.dataDir;
  if (typeof dataDir !== "string" || dataDir.length === 0) {
    throw new Error("personalization store requires a dataDir");
  }
  const fs = options.fs ?? defaultFs();
  const now = options.now ?? Date.now;

  const stateFile = join(dataDir, STATE_FILE);
  const assetsDir = join(dataDir, ASSETS_DIR);
  const stagingDir = join(dataDir, STAGING_DIR);
  const quarantineDir = join(dataDir, QUARANTINE_DIR);

  let state = null;
  let mode = "normal"; // normal | recovery | unsupported
  let recovery = null; // { candidateLibrary, quarantine:[names], configLost }
  const imports = new Map(); // importToken → { status, manifest, assets, diff, expiresAt, result }
  let chain = Promise.resolve();
  let initialized = false;

  // -- filesystem helpers ---------------------------------------------------

  function ensureDirs() {
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.mkdirSync(stagingDir, { recursive: true });
  }

  function readStateFile() {
    if (!fs.existsSync(stateFile)) return { kind: "missing" };
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    } catch {
      return { kind: "corrupt" };
    }
    if (!isValidStateShape(parsed)) return { kind: "corrupt" };
    return { kind: "ok", state: parsed };
  }

  function listAssetFiles() {
    if (!fs.existsSync(assetsDir)) return [];
    return fs.readdirSync(assetsDir).filter((name) => !name.startsWith("."));
  }

  function blobFileFor(id, extension) {
    return join(assetsDir, `${id}.${extension}`);
  }

  function commitState(next) {
    atomicWriteText(stateFile, `${JSON.stringify(next, null, 2)}\n`, fs);
    state = next;
  }

  /** Serialized mutation queue: every visible state change runs through it. */
  function enqueue(work) {
    const run = chain.then(work);
    chain = run.then(() => undefined, () => undefined);
    return run;
  }

  // -- boot -----------------------------------------------------------------

  function sniffBlobFile(name) {
    const file = join(assetsDir, name);
    let buffer;
    try {
      buffer = fs.readFileSync(file);
    } catch {
      return { name, kind: "unreadable" };
    }
    const meta = detectImageMeta(buffer);
    if (meta === null) return { name, kind: "unrecognized" };
    const id = name.split(".")[0];
    if (!ASSET_ID_PATTERN.test(id)) return { name, kind: "unrecognized" };
    const extension = extensionForMime(meta.mime);
    return {
      name,
      kind: "asset",
      meta: {
        id,
        displayName: name,
        mime: meta.mime,
        extension,
        byteLength: buffer.length,
        width: meta.width,
        height: meta.height,
        sha256: sha256Hex(buffer),
        createdAt: now(),
      },
    };
  }

  function init() {
    if (initialized) return;
    try {
      initOnce();
    } catch (error) {
      // A failed boot (e.g. disk error during the initial state write) must
      // not latch `initialized` — the next call retries the whole boot.
      initialized = false;
      state = null;
      throw error;
    }
  }

  function initOnce() {
    initialized = true;
    ensureDirs();
    const read = readStateFile();
    const assetFiles = listAssetFiles();

    if (read.kind === "missing" && assetFiles.length === 0) {
      // True first install (design §5.3 branch A precondition).
      commitState(emptyState());
      mode = "normal";
      gcNow();
      return;
    }

    if (read.kind === "missing" || read.kind === "corrupt") {
      // Recovery branch A: rebuild a candidate from blobs; nothing destructive.
      const candidateLibrary = {};
      const quarantine = [];
      for (const scanned of assetFiles.map(sniffBlobFile)) {
        if (scanned.kind === "asset") candidateLibrary[scanned.meta.id] = scanned.meta;
        else quarantine.push(scanned.name);
      }
      mode = "recovery";
      recovery = { candidateLibrary, quarantine, configLost: true };
      state = emptyState();
      return;
    }

    if (read.state.configVersion > CONFIG_VERSION) {
      // Branch B: strict zero writes — no rebuild, no GC, no staging cleanup.
      mode = "unsupported";
      state = read.state;
      return;
    }

    mode = "normal";
    state = read.state;
    gcNow();
  }

  // -- garbage collection ---------------------------------------------------

  function gcNow() {
    if (mode !== "normal") return;
    const live = new Set(Object.keys(state.library));
    for (const name of listAssetFiles()) {
      const id = name.split(".")[0];
      if (!live.has(id)) {
        try { fs.unlinkSync(join(assetsDir, name)); } catch {}
      }
    }
    cleanupStaging();
  }

  function cleanupStaging() {
    if (!fs.existsSync(stagingDir)) return;
    for (const entry of fs.readdirSync(stagingDir)) {
      const dir = join(stagingDir, entry);
      try {
        // Fresh staging dirs belong to in-flight writes; expire only old ones.
        if (now() - fs.statSync(dir).mtimeMs < STAGING_TTL_MS) continue;
        for (const file of fs.readdirSync(dir)) fs.unlinkSync(join(dir, file));
        fs.rmdirSync(dir);
      } catch {}
    }
  }

  // -- guards ---------------------------------------------------------------

  function requireNormal(operation) {
    if (mode === "unsupported") {
      throw codedError("STORE_READONLY", `配置状态为更高版本（configVersion>${CONFIG_VERSION}），${operation}被拒绝`);
    }
    if (mode === "recovery") {
      throw codedError("STORE_RECOVERY_REQUIRED", `配置状态待恢复，${operation}被拒绝`);
    }
  }

  function metaProviderFactory(library) {
    return (id) => library[id] ?? null;
  }

  // -- snapshot -------------------------------------------------------------

  function referencesFor(skins, library) {
    const references = {};
    for (const id of Object.keys(library)) references[id] = [];
    for (const [skinId, section] of Object.entries(skins)) {
      for (const field of listAssetFields(skinId)) {
        const value = section?.[field.key];
        if (typeof value === "string" && references[value] !== undefined) {
          references[value].push({ skinId, key: field.key });
        }
      }
    }
    return references;
  }

  function snapshot() {
    init();
    const base = {
      configVersion: state.configVersion,
      revision: state.revision,
      skins: state.skins,
      library: Object.values(state.library),
      mode,
      quota: {
        count: Object.keys(state.library).length,
        totalBytes: Object.values(state.library).reduce((sum, meta) => sum + meta.byteLength, 0),
      },
    };
    if (mode === "normal") base.references = referencesFor(state.skins, state.library);
    if (mode === "recovery") base.recovery = recovery;
    return base;
  }

  // -- config operations (field-level ops, design §2/§4) --------------------

  async function applyOperations({ operations }) {
    init();
    requireNormal("配置写入");
    if (!Array.isArray(operations) || operations.length === 0 || operations.length > 64) {
      throw codedError("INVALID_CONFIG", "operations 必须是 1–64 个元素的数组");
    }
    for (const operation of operations) {
      if (operation === null || typeof operation !== "object") {
        throw codedError("INVALID_CONFIG", "operation 必须是对象");
      }
      const { op, skinId, key } = operation;
      if (op !== "set" && op !== "delete") throw codedError("INVALID_CONFIG", "op 必须是 set 或 delete");
      if (getField(skinId, key) === null) {
        throw codedError("INVALID_CONFIG", `未知字段 ${skinId}.${key}`);
      }
    }
    // Draft + validation run INSIDE the serialized queue so interleaved
    // mutations always build on the newest committed state.
    return enqueue(() => {
      const draft = structuredClone(state);
      const provider = metaProviderFactory(draft.library);
      for (const operation of operations) {
        const { op, skinId, key } = operation;
        if (op === "set") {
          const verdict = validateOverride(skinId, key, operation.value, provider);
          if (!verdict.ok) {
            throw codedError("INVALID_CONFIG", `${skinId}.${key} 校验失败（${verdict.code}）`, { code: verdict.code });
          }
        }
      }
      for (const { op, skinId, key, value } of operations) {
        draft.skins[skinId] = draft.skins[skinId] ?? {};
        if (op === "set") draft.skins[skinId][key] = value;
        else delete draft.skins[skinId][key];
      }
      draft.revision += 1;
      commitState(draft);
      gcNow();
      return { revision: draft.revision };
    });
  }

  // -- asset upload (design §4 upload contract) ------------------------------

  /**
   * Shared ingest validation (upload AND theme import): magic sniff, animation
   * policy, global byte and per-format pixel caps. Returns the trusted meta.
   */
  function ingestAssetMeta(buffer, { declaredMime } = {}) {
    const meta = detectImageMeta(buffer);
    if (meta === null) throw codedError("UNSUPPORTED_IMAGE", "无法识别的图片格式");
    if (meta.animated === true) throw codedError("ANIMATION_UNSUPPORTED", "动画 WebP 暂不支持");
    if (typeof declaredMime === "string" && declaredMime !== "" && declaredMime !== meta.mime) {
      throw codedError("UNSUPPORTED_IMAGE", `声明的 ${declaredMime} 与实际内容 ${meta.mime} 不符`);
    }
    if (buffer.length > GLOBAL_MAX_BYTES) {
      throw codedError("UPLOAD_TOO_LARGE", "图片超过 20MB 上限");
    }
    const pixelCap = meta.mime === "image/gif" ? GIF_MAX_PIXELS : GLOBAL_MAX_PIXELS;
    if (meta.width * meta.height > pixelCap) {
      throw codedError("UPLOAD_TOO_LARGE", `图片像素超过上限（${meta.mime === "image/gif" ? "12" : "40"}MP）`);
    }
    return meta;
  }

  function checkDiskSpace(incomingBytes) {
    if (typeof fs.statfsSync !== "function") return;
    try {
      const stats = fs.statfsSync(dataDir);
      const required = incomingBytes * 2 + DISK_SAFETY_RESERVE;
      if (BigInt(stats.bsize) * BigInt(stats.bavail) < BigInt(required)) {
        throw codedError("DISK_FULL", "磁盘剩余空间不足，拒绝写入");
      }
    } catch (error) {
      if (error?.code === "DISK_FULL") throw error;
      // statfs unavailable on this platform — proceed without the check.
    }
  }

  async function uploadAsset(buffer, { displayName, declaredMime }) {
    init();
    requireNormal("图片上传");
    const meta = ingestAssetMeta(buffer, { declaredMime });
    const name = sanitizeDisplayName(displayName);
    if (name === null) throw codedError("FILENAME_INVALID", "文件展示名无效");

    return enqueue(() => {
      checkDiskSpace(buffer.length);
      const extension = extensionForMime(meta.mime);
      let id = "";
      let target;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        id = ASSET_ID_PREFIX + randomUUID().replaceAll("-", "");
        target = blobFileFor(id, extension);
        if (!fs.existsSync(target)) break;
      }
      const stagingPath = join(stagingDir, randomUUID());
      fs.mkdirSync(stagingPath, { recursive: true });
      const stagingFile = join(stagingPath, "blob");
      try {
        fs.writeFileSync(stagingFile, buffer);
        fs.renameSync(stagingFile, target);
      } catch (error) {
        try { fs.unlinkSync(stagingFile); } catch {}
        try { fs.rmdirSync(stagingPath); } catch {}
        throw error;
      }
      try { fs.rmdirSync(stagingPath); } catch {}

      const asset = {
        id,
        displayName: name,
        mime: meta.mime,
        extension,
        byteLength: buffer.length,
        width: meta.width,
        height: meta.height,
        sha256: sha256Hex(buffer),
        createdAt: new Date(now()).toISOString(),
      };
      const draft = structuredClone(state);
      draft.library[id] = asset;
      draft.revision += 1;
      try {
        commitState(draft);
      } catch (error) {
        // State commit failed: the blob is orphaned (GC reclaims it later);
        // surface the error without leaving a visible-but-dangling reference.
        try { fs.unlinkSync(target); } catch {}
        throw error;
      }
      return { asset, revision: draft.revision };
    });
  }

  // -- asset delete (design: always allowed, clear references, report) -------

  async function deleteAsset(id) {
    init();
    requireNormal("图片删除");
    if (typeof id !== "string" || !ASSET_ID_PATTERN.test(id)) {
      throw codedError("INVALID_ASSET_ID", "非法的图片 id");
    }
    return enqueue(() => {
      const meta = state.library[id];
      if (meta === undefined) throw codedError("ASSET_NOT_FOUND", "图片不存在");
      const draft = structuredClone(state);
      const affectedSkins = [];
      for (const [skinId, section] of Object.entries(draft.skins)) {
        for (const field of listAssetFields(skinId)) {
          if (section?.[field.key] === id) {
            delete section[field.key];
            affectedSkins.push({ skinId, key: field.key });
          }
        }
      }
      delete draft.library[id];
      draft.revision += 1;
      commitState(draft); // state first: a crash here only orphans the blob
      try { fs.unlinkSync(blobFileFor(id, meta.extension)); } catch {}
      gcNow();
      return { revision: draft.revision, affectedSkins };
    });
  }

  // -- asset serving (path rebuilt from trusted metadata, design §4) ---------

  function serveAsset(url) {
    init();
    const path = String(url ?? "").split("?")[0];
    const match = /\/dsh-skins\/assets\/([^/]+)$/.exec(path);
    if (match === null) return null;
    const name = match[1];
    if (!/^u_[0-9a-f]{32}\.(png|jpe?g|webp|gif)$/.test(name)) return null;
    const id = name.split(".")[0];
    const meta = state.library[id];
    if (meta === undefined) return null;
    // The requested extension must equal the trusted metadata's extension;
    // the served path is rebuilt from metadata, never from the raw suffix.
    if (name !== `${id}.${meta.extension}`) return null;
    try {
      return { buffer: fs.readFileSync(blobFileFor(id, meta.extension)), meta };
    } catch {
      return null;
    }
  }

  // -- theme packages: export / prepare / commit (design §6) ----------------

  function exportTheme(skinId) {
    init();
    requireNormal("主题导出");
    const schema = getSkinSchema(skinId);
    if (schema === null) throw codedError("UNKNOWN_SKIN", `皮肤 ${skinId} 不在个性化目录中`);
    const section = state.skins[skinId] ?? {};
    const fields = {};
    const entries = [{ name: "manifest.json", data: null }];
    const listed = [];
    for (const field of schema.fields) {
      const value = section[field.key];
      if (value === undefined) continue;
      if (field.type === "image") {
        const ref = resolveImageRef(value);
        if (ref === null) continue;
        if (ref.kind === "builtin") {
          fields[field.key] = value; // builtin refs travel as-is
          continue;
        }
        const meta = state.library[ref.id];
        if (meta === undefined) continue; // dangling reference: skip on export
        const file = `assets/${meta.id}.${meta.extension}`;
        fields[field.key] = { $asset: file };
        const data = fs.readFileSync(blobFileFor(meta.id, meta.extension));
        entries.push({ name: file, data });
        listed.push({ file, sha256: sha256Hex(data) });
      } else {
        fields[field.key] = value;
      }
    }
    const manifest = {
      formatVersion: 1,
      skinId,
      exportedAt: new Date(now()).toISOString(),
      fields,
      assets: listed,
    };
    entries[0].data = Buffer.from(JSON.stringify(manifest), "utf8");
    return {
      zip: writeStoreOnlyZip(entries),
      filename: `dsh-skins-theme-${skinId}.zip`,
    };
  }

  function pruneExpiredImports() {
    for (const [token, entry] of imports) {
      if (entry.status !== "committed" && entry.expiresAt < now()) imports.delete(token);
    }
  }

  async function prepareImport(buffer) {
    init();
    requireNormal("主题导入");
    pruneExpiredImports();
    const { manifest: manifestBuffer, assets } = readStoreOnlyZip(buffer);
    let manifest;
    try {
      manifest = JSON.parse(manifestBuffer.toString("utf8"));
    } catch {
      throw codedError("IMPORT_INVALID", "manifest.json 不是合法 JSON");
    }
    if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)
      || manifest.formatVersion !== 1 || typeof manifest.skinId !== "string"
      || typeof manifest.fields !== "object" || manifest.fields === null
      || Array.isArray(manifest.fields) || !Array.isArray(manifest.assets)) {
      throw codedError("IMPORT_INVALID", "manifest 结构不合法");
    }
    const schema = getSkinSchema(manifest.skinId);
    if (schema === null) throw codedError("IMPORT_INVALID", `皮肤 ${manifest.skinId} 不在个性化目录中`);

    // Every listed asset must be present with a matching hash; no orphans.
    const listedFiles = new Set();
    for (const asset of manifest.assets) {
      if (typeof asset?.file !== "string" || typeof asset.sha256 !== "string") {
        throw codedError("IMPORT_INVALID", "manifest.assets 结构不合法");
      }
      const data = assets.get(asset.file);
      if (data === undefined) throw codedError("IMPORT_INVALID", `包内缺少 ${asset.file}`);
      if (sha256Hex(data) !== asset.sha256) throw codedError("IMPORT_INVALID", `${asset.file} 哈希不匹配`);
      listedFiles.add(asset.file);
    }
    for (const name of assets.keys()) {
      if (!listedFiles.has(name)) throw codedError("IMPORT_INVALID", `${name} 未在 manifest 中登记`);
    }

    // Field values: markers must point at listed assets; plain image strings
    // must be builtin refs; other values validate without library metadata.
    const mappedFields = {};
    for (const [key, value] of Object.entries(manifest.fields)) {
      const field = getField(manifest.skinId, key);
      if (field === null) continue; // future-version fields are ignored on import
      if (field.type === "image" && value !== null && typeof value === "object" && !Array.isArray(value)) {
        const file = value.$asset;
        if (typeof file !== "string" || !listedFiles.has(file)) {
          throw codedError("IMPORT_INVALID", `${key} 引用了未登记的资产`);
        }
        mappedFields[key] = { $asset: file };
        continue;
      }
      if (field.type === "image" && typeof value === "string" && !value.startsWith("builtin:")) {
        throw codedError("IMPORT_INVALID", `${key} 的用户图片必须以 $asset 标记导出`);
      }
      const verdict = validateOverride(manifest.skinId, key, value, undefined);
      if (!verdict.ok) throw codedError("IMPORT_INVALID", `${key} 校验失败（${verdict.code}）`);
      mappedFields[key] = value;
    }

    // Diff against the current overrides (design: preview three groups).
    const current = state.skins[manifest.skinId] ?? {};
    const knownKeys = new Set(schema.fields.map((field) => field.key));
    const setFields = Object.keys(mappedFields);
    const removeFields = [...knownKeys].filter((key) => current[key] !== undefined && !(key in mappedFields));
    const keepUnknown = Object.keys(current).filter((key) => !knownKeys.has(key));
    const warnings = [];
    if (keepUnknown.length > 0) warnings.push({ code: "KEEP_UNKNOWN_FIELDS", keys: keepUnknown });

    const importToken = randomUUID();
    imports.set(importToken, {
      status: "prepared",
      manifest,
      assets,
      mappedFields,
      expiresAt: now() + IMPORT_TTL_MS,
    });
    return {
      importToken,
      baseRevision: state.revision,
      diff: { setFields, removeFields, keepUnknown },
      warnings,
      expiresAt: new Date(now() + IMPORT_TTL_MS).toISOString(),
    };
  }

  async function commitImport({ importToken, baseRevision, confirm, purgeUnknown }) {
    init();
    requireNormal("主题导入");
    const entry = imports.get(importToken);
    if (entry === undefined || entry.expiresAt < now()) {
      imports.delete(importToken);
      throw codedError("IMPORT_EXPIRED", "导入会话不存在或已过期");
    }
    if (entry.status === "committed") {
      // Network-retry idempotency: same token + same params → same result.
      if (entry.resultParams === JSON.stringify({ baseRevision, confirm, purgeUnknown })) {
        return Promise.resolve(entry.result);
      }
      throw codedError("IMPORT_CONFLICT", "导入已提交，参数不一致");
    }
    if (confirm !== true) throw codedError("INVALID_CONFIG", "commit 需要 confirm:true");
    if (typeof baseRevision !== "number" || baseRevision !== state.revision) {
      throw codedError("IMPORT_CONFLICT", "配置已变化，请重新预览");
    }
    return enqueue(() => {
      const skinId = entry.manifest.skinId;
      const schema = getSkinSchema(skinId);
      const newBlobs = [];
      const mapping = {};
      try {
        const draft = structuredClone(state);
        // Re-id assets through the shared ingest validation; hash dedup
        // reuses an identical library entry instead of duplicating the blob.
        for (const [file, buffer] of entry.assets) {
          const meta = ingestAssetMeta(buffer);
          const hash = sha256Hex(buffer);
          const existing = Object.values(draft.library).find((asset) => asset.sha256 === hash);
          if (existing !== undefined) {
            mapping[file] = existing.id;
            continue;
          }
          checkDiskSpace(buffer.length);
          const extension = extensionForMime(meta.mime);
          let id = "";
          let target;
          for (let attempt = 0; attempt < 5; attempt += 1) {
            id = ASSET_ID_PREFIX + randomUUID().replaceAll("-", "");
            target = blobFileFor(id, extension);
            if (!fs.existsSync(target)) break;
          }
          const stagingPath = join(stagingDir, randomUUID());
          fs.mkdirSync(stagingPath, { recursive: true });
          const stagingFile = join(stagingPath, "blob");
          try {
            fs.writeFileSync(stagingFile, buffer);
            fs.renameSync(stagingFile, target);
          } catch (error) {
            try { fs.unlinkSync(stagingFile); } catch {}
            try { fs.rmdirSync(stagingPath); } catch {}
            throw error;
          }
          try { fs.rmdirSync(stagingPath); } catch {}
          newBlobs.push(target);
          draft.library[id] = {
            id,
            displayName: file.split("/").pop(),
            mime: meta.mime,
            extension,
            byteLength: buffer.length,
            width: meta.width,
            height: meta.height,
            sha256: hash,
            createdAt: new Date(now()).toISOString(),
          };
          mapping[file] = id;
        }

        // Build the replacement section: known fields from the manifest,
        // unknown fields preserved unless purgeUnknown.
        const provider = (id) => draft.library[id] ?? null;
        const current = state.skins[skinId] ?? {};
        const knownKeys = new Set(schema.fields.map((field) => field.key));
        const section = {};
        if (!purgeUnknown) {
          for (const [key, value] of Object.entries(current)) {
            if (!knownKeys.has(key)) section[key] = value;
          }
        }
        for (const [key, value] of Object.entries(entry.mappedFields)) {
          const finalValue = value !== null && typeof value === "object" && typeof value.$asset === "string"
            ? mapping[value.$asset]
            : value;
          if (finalValue === undefined) continue;
          const verdict = validateOverride(skinId, key, finalValue, provider);
          if (!verdict.ok) {
            throw codedError("IMPORT_INVALID", `${key} 导入校验失败（${verdict.code}）`);
          }
          section[key] = finalValue;
        }
        draft.skins[skinId] = section;
        draft.revision += 1;
        commitState(draft);
        const result = { revision: draft.revision, skinConfig: section, assetMapping: mapping };
        entry.status = "committed";
        entry.result = result;
        entry.resultParams = JSON.stringify({ baseRevision, confirm, purgeUnknown });
        gcNow();
        return result;
      } catch (error) {
        for (const blob of newBlobs) {
          try { fs.unlinkSync(blob); } catch {}
        }
        throw error;
      }
    });
  }



  // -- recovery confirmation (branch A: destructive steps only after commit) -

  async function confirmRecovery() {
    init();
    if (mode !== "recovery") throw codedError("STORE_NOT_RECOVERING", "当前不在恢复模式");
    return enqueue(() => {
      // Keep ≤3 corrupt backups, then archive the unreadable state file.
      const backup = `${stateFile}.corrupt.${now()}.json`;
      try {
        if (fs.existsSync(stateFile)) fs.renameSync(stateFile, backup);
        pruneCorruptBackups();
      } catch {} // missing file (deleted externally) — nothing to back up

      // Physically move unrecognized files into quarantine/ — only now, after
      // the user confirmed (design §5.3 A.3).
      fs.mkdirSync(quarantineDir, { recursive: true });
      for (const name of recovery.quarantine) {
        try { fs.renameSync(join(assetsDir, name), join(quarantineDir, name)); } catch {}
      }

      const draft = emptyState();
      draft.library = recovery.candidateLibrary;
      draft.revision = 1;
      commitState(draft);
      mode = "normal";
      recovery = null;
      gcNow();
      return { revision: draft.revision };
    });
  }

  function pruneCorruptBackups() {
    const dir = join(dataDir);
    if (!fs.existsSync(dir)) return;
    const backups = fs.readdirSync(dir)
      .filter((name) => name.startsWith(`${STATE_FILE}.corrupt.`))
      .sort();
    while (backups.length > CORRUPT_BACKUP_LIMIT) {
      try { fs.unlinkSync(join(dir, backups.shift())); } catch {}
    }
  }

  return {
    init,
    snapshot,
    applyOperations,
    uploadAsset,
    deleteAsset,
    serveAsset,
    exportTheme,
    prepareImport,
    commitImport,
    confirmRecovery,
    getMode: () => {
      init();
      return mode;
    },
  };
}
