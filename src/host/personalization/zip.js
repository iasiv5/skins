/**
 * Store-only ZIP — the theme-package container (design §6/§8).
 *
 * This plugin is the ONLY producer and consumer of theme packages, so the
 * container is a strict store-only subset: no deflate, no encryption, no
 * Zip64, no data descriptors, no archive comment, no trailing payload.
 * Writing is straightforward serialization; reading enforces every
 * structural constraint from the design so hostile archives cannot reach
 * the store:
 *
 *   - single disk (0) and exactly one EOCD at the exact end of the file
 *   - EOCD entry counts equal the parsed central directory
 *   - all offsets/sizes bounded and overflow-checked against the buffer
 *   - local data regions non-overlapping and not intruding on the
 *     central directory
 *   - method must be 0 with compressed == uncompressed size
 *   - flags must be 0 (rejects encryption, data descriptor, and anything
 *     exotic); version-needed must be 20
 *   - exactly one manifest.json; other names must match
 *     assets/[a-z0-9_-]{1,80}.(png|jpe?g|webp|gif); duplicates rejected
 *   - CRC-32 verified per entry
 *   - budgets: entries ≤ 64, names ≤ 120 bytes, archive ≤ 80MB,
 *     per-entry ≤ 20MB, manifest ≤ 256KB
 */

import { codedError } from "../errors.js";

const ENTRY_LIMIT = 64;
const ARCHIVE_LIMIT = 80 * 1024 * 1024;
const ENTRY_SIZE_LIMIT = 20 * 1024 * 1024;
const MANIFEST_LIMIT = 256 * 1024;
const NAME_LIMIT = 120;
const ASSET_NAME = /^assets\/[a-z0-9_-]{1,80}\.(png|jpe?g|webp|gif)$/;
const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date(0)) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time, day };
}

/**
 * Serialize a store-only archive. `entries` is [{ name, data:Buffer }] with
 * at most one manifest.json and any number of assets/<name> entries.
 */
export function writeStoreOnlyZip(entries) {
  if (entries.length === 0 || entries.length > ENTRY_LIMIT) {
    throw codedError("IMPORT_INVALID", "theme package needs 1–64 entries");
  }
  const seen = new Set();
  let manifestCount = 0;
  for (const entry of entries) {
    if (entry.name === "manifest.json") manifestCount += 1;
    else if (!ASSET_NAME.test(entry.name)) throw codedError("IMPORT_INVALID", `entry name not allowed: ${entry.name}`);
    if (seen.has(entry.name)) throw codedError("IMPORT_INVALID", `duplicate entry: ${entry.name}`);
    seen.add(entry.name);
  }
  if (manifestCount !== 1) throw codedError("IMPORT_INVALID", "theme package needs exactly one manifest.json");
  const { time, day } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    if (nameBytes.length > NAME_LIMIT) throw codedError("IMPORT_INVALID", `entry name too long: ${entry.name}`);
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    if (data.length > ENTRY_SIZE_LIMIT) throw codedError("IMPORT_INVALID", `entry too large: ${entry.name}`);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags: none
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    nameBytes.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD, 0);
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // central dir disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length
  return Buffer.concat([...locals, centralDirectory, eocd]);
}

/**
 * Parse and fully validate a store-only archive. Returns
 * { manifest: Buffer, assets: Map<name, Buffer> } or throws a coded error.
 */
export function readStoreOnlyZip(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw codedError("IMPORT_INVALID", "archive too small");
  if (buffer.length > ARCHIVE_LIMIT) throw codedError("IMPORT_TOO_LARGE", "archive exceeds 80MB");

  // EOCD must sit at the exact end (no trailing payload, no comment).
  const eocdOffset = buffer.length - 22;
  if (buffer.readUInt32LE(eocdOffset) !== EOCD) {
    throw codedError("IMPORT_INVALID", "archive must end with the end-of-central-directory record");
  }
  if (buffer.readUInt16LE(eocdOffset + 4) !== 0 || buffer.readUInt16LE(eocdOffset + 6) !== 0) {
    throw codedError("IMPORT_INVALID", "multi-disk archives rejected");
  }
  const countThisDisk = buffer.readUInt16LE(eocdOffset + 8);
  const countTotal = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (buffer.readUInt16LE(eocdOffset + 20) !== 0) throw codedError("IMPORT_INVALID", "archive comment rejected");
  if (countThisDisk !== countTotal) throw codedError("IMPORT_INVALID", "split central directory rejected");
  if (countTotal > ENTRY_LIMIT) throw codedError("IMPORT_INVALID", `too many entries (${countTotal})`);
  if (centralOffset + centralSize !== eocdOffset) {
    throw codedError("IMPORT_INVALID", "central directory must end exactly at the EOCD");
  }

  const ranges = [];
  const assets = new Map();
  let manifest = null;
  let cursor = centralOffset;
  for (let index = 0; index < countTotal; index += 1) {
    if (cursor + 46 > eocdOffset || buffer.readUInt32LE(cursor) !== CENTRAL) {
      throw codedError("IMPORT_INVALID", "central directory truncated or misaligned");
    }
    const versionNeeded = buffer.readUInt16LE(cursor + 6);
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameLength > eocdOffset) throw codedError("IMPORT_INVALID", "central entry name truncated");
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;

    if (versionNeeded !== 20) throw codedError("IMPORT_INVALID", `${name}: unsupported version ${versionNeeded}`);
    if (flags !== 0) throw codedError("IMPORT_INVALID", `${name}: unsupported flags 0x${flags.toString(16)} (encryption/descriptors rejected)`);
    if (method !== 0) throw codedError("IMPORT_INVALID", `${name}: only store (method 0) entries are accepted`);
    if (compressedSize !== uncompressedSize) throw codedError("IMPORT_INVALID", `${name}: store entry size mismatch`);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw codedError("IMPORT_INVALID", `${name}: Zip64 rejected`);
    }
    if (extraLength !== 0 || commentLength !== 0) throw codedError("IMPORT_INVALID", `${name}: extra fields and comments rejected`);
    if (nameLength > NAME_LIMIT) throw codedError("IMPORT_INVALID", `${name}: name too long`);
    if (name === "manifest.json") {
      if (manifest !== null) throw codedError("IMPORT_INVALID", "duplicate manifest.json");
      if (uncompressedSize > MANIFEST_LIMIT) throw codedError("IMPORT_INVALID", "manifest.json exceeds 256KB");
    } else if (!ASSET_NAME.test(name)) {
      throw codedError("IMPORT_INVALID", `${name}: entry names must be manifest.json or assets/<safe-name>`);
    }
    if (assets.has(name) || name === "manifest.json" && manifest !== null) {
      throw codedError("IMPORT_INVALID", `${name}: duplicate entry`);
    }

    // Local header consistency, then the data region.
    if (localOffset + 30 > eocdOffset || buffer.readUInt32LE(localOffset) !== LOCAL) {
      throw codedError("IMPORT_INVALID", `${name}: local header missing`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    if (localNameLength !== nameLength) throw codedError("IMPORT_INVALID", `${name}: local/central name mismatch`);
    if (localExtraLength !== 0) throw codedError("IMPORT_INVALID", `${name}: local extra fields rejected`);
    if (buffer.readUInt16LE(localOffset + 6) !== 0 || buffer.readUInt16LE(localOffset + 8) !== 0) {
      throw codedError("IMPORT_INVALID", `${name}: local flags/method differ from store-only`);
    }
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + uncompressedSize;
    if (dataEnd > centralOffset) throw codedError("IMPORT_INVALID", `${name}: data intrudes on the central directory`);
    if (uncompressedSize > ENTRY_SIZE_LIMIT) throw codedError("IMPORT_TOO_LARGE", `${name}: entry exceeds 20MB`);
    const data = buffer.subarray(dataStart, dataEnd);
    if (crc32(data) !== crc) throw codedError("IMPORT_INVALID", `${name}: CRC mismatch`);

    // Data regions must not overlap.
    for (const [start, end] of ranges) {
      if (dataStart < end && start < dataEnd) throw codedError("IMPORT_INVALID", `${name}: overlapping entry data`);
    }
    ranges.push([dataStart, dataEnd]);

    if (name === "manifest.json") manifest = Buffer.from(data);
    else assets.set(name, Buffer.from(data));
  }
  if (cursor !== eocdOffset) throw codedError("IMPORT_INVALID", "central directory size mismatch");
  if (manifest === null) throw codedError("IMPORT_INVALID", "manifest.json missing");
  return { manifest, assets };
}
