import assert from "node:assert/strict";
import test from "node:test";
import { crc32, readStoreOnlyZip, writeStoreOnlyZip } from "../src/host/personalization/zip.js";

const MANIFEST = Buffer.from(JSON.stringify({ formatVersion: 1, skinId: "tgcf", fields: {}, assets: [] }));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

function happyArchive() {
  return writeStoreOnlyZip([
    { name: "manifest.json", data: MANIFEST },
    { name: "assets/u_0123456789abcdef0123456789abcdef.png", data: PNG },
  ]);
}

test("roundtrip: writer output reads back byte-equal", () => {
  const archive = happyArchive();
  const parsed = readStoreOnlyZip(archive);
  assert.deepEqual(parsed.manifest, MANIFEST);
  assert.equal(parsed.assets.size, 1);
  assert.deepEqual(parsed.assets.get("assets/u_0123456789abcdef0123456789abcdef.png"), PNG);
});

test("writer enforces names, duplicates and the single manifest", () => {
  assert.throws(() => writeStoreOnlyZip([{ name: "evil.sh", data: PNG }]), (e) => e.code === "IMPORT_INVALID");
  assert.throws(() => writeStoreOnlyZip([
    { name: "manifest.json", data: MANIFEST },
    { name: "manifest.json", data: MANIFEST },
  ]), /duplicate/);
  assert.throws(() => writeStoreOnlyZip([
    { name: "manifest.json", data: MANIFEST },
    { name: "assets/a.png", data: PNG },
    { name: "assets/a.png", data: PNG },
  ]), /duplicate/);
});

// --- raw builder for hostile archives ---------------------------------------

function rawEntry({ name, data, method = 0, flags = 0, crc, localFlags, localMethod, nameBytes: overrideName, extraLength = 0 }) {
  const nameBytes = overrideName ?? Buffer.from(name, "utf8");
  const actualCrc = crc ?? crc32(data);
  const local = Buffer.alloc(30 + nameBytes.length + extraLength);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(localFlags ?? flags, 6);
  local.writeUInt16LE(localMethod ?? method, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(actualCrc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(extraLength, 28);
  nameBytes.copy(local, 30);
  return { local: Buffer.concat([local, data]), nameBytes, crc: actualCrc, size: data.length, localHeaderLength: 30 + nameBytes.length + extraLength };
}

function rawZip(entries, { patch } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const built = entry.built ?? rawEntry(entry);
    locals.push(built.local);
    const central = Buffer.alloc(46 + built.nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(entry.centralFlags ?? entry.flags ?? 0, 8);
    central.writeUInt16LE(entry.centralMethod ?? entry.method ?? 0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(built.crc, 16);
    central.writeUInt32LE(entry.centralSize ?? built.size, 20);
    central.writeUInt32LE(built.size, 24);
    central.writeUInt16LE(built.nameBytes.length, 28);
    central.writeUInt16LE(entry.centralExtra ?? 0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(entry.localOffset ?? offset, 42);
    built.nameBytes.copy(central, 46);
    centrals.push(central);
    offset += built.local.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(patch?.disk ?? 0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(patch?.count ?? entries.length, 8);
  eocd.writeUInt16LE(patch?.count ?? entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(patch?.commentLength ?? 0, 20);
  return Buffer.concat([...locals, centralDirectory, eocd]);
}

function rejects(buffer, matcher) {
  const check = typeof matcher === "function"
    ? matcher
    : (error) => (matcher ? matcher.test(error.message) : error.code === "IMPORT_INVALID" || error.code === "IMPORT_TOO_LARGE");
  assert.throws(() => readStoreOnlyZip(buffer), check);
}

test("rejects non-zip, truncated and oversized buffers", () => {
  rejects(Buffer.from("not a zip at all"), (e) => e.code === "IMPORT_INVALID");
  rejects(Buffer.alloc(10), (e) => e.code === "IMPORT_INVALID");
  rejects(Buffer.alloc(81 * 1024 * 1024), (e) => e.code === "IMPORT_TOO_LARGE");
});

test("rejects trailing payload and archive comments", () => {
  rejects(Buffer.concat([happyArchive(), Buffer.from("x")]), /end with the end-of-central-directory/);
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST }], { patch: { commentLength: 4 } }), /archive comment rejected/);
});

test("rejects multi-disk and count mismatches", () => {
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST }], { patch: { disk: 1 } }), /multi-disk/);
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST }], { patch: { count: 2 } }), /misaligned|truncated|size mismatch/);
});

test("rejects non-store compression and exotic flags", () => {
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST, method: 8 }]), /only store/);
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST, flags: 0x0001 }]), /encryption|flags/);
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST, flags: 0x0008 }]), /flags/);
});

test("rejects CRC corruption", () => {
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST, crc: 0xdeadbeef }]), /CRC mismatch/);
});

test("rejects duplicate names and duplicate manifests", () => {
  rejects(rawZip([
    { name: "assets/a.png", data: PNG },
    { name: "assets/a.png", data: PNG },
  ]), /duplicate/);
  rejects(rawZip([{ name: "assets/a.png", data: PNG }]), /manifest.json missing/);
  rejects(rawZip([
    { name: "manifest.json", data: MANIFEST },
    { name: "manifest.json", data: MANIFEST },
  ]), /duplicate/);
});

test("rejects unsafe entry names and path traversal", () => {
  rejects(rawZip([{ name: "../state.json", data: MANIFEST }]), /entry names must be/);
  rejects(rawZip([{ name: "assets/../../etc/passwd.png", data: PNG }]), /entry names must be/);
  rejects(rawZip([{ name: "assets/UPPER.PNG", data: PNG }]), /entry names must be/);
  rejects(rawZip([{ name: `assets/${"a".repeat(81)}.png`, data: PNG }]), /name too long|entry names must be/);
});

test("rejects local/central mismatches, extra fields and overlapping data", () => {
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST, localFlags: 1 }]), /local flags\/method differ/);
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST, localMethod: 8 }]), /local flags\/method differ/);
  rejects(rawZip([
    { name: "manifest.json", data: MANIFEST },
    { name: "assets/a.png", data: PNG, localOffset: 30 }, // points into the manifest's data region
  ]), /overlapping|local header missing/);
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST, extraLength: 4 }]), /extra fields/);
});

test("rejects sizes that intrude on the central directory or exceed budgets", () => {
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST, centralSize: 0xffffffff }]), /store entry size mismatch|intrudes/);
  rejects(rawZip([{ name: "manifest.json", data: MANIFEST, localOffset: 0xffffffff }]), /Zip64 rejected|local header missing/);
  const bigManifest = Buffer.alloc(257 * 1024, 0x20);
  rejects(rawZip([{ name: "manifest.json", data: bigManifest }]), /manifest.json exceeds 256KB/);
  const hugeDeclared = rawZip([{ name: "assets/a.png", data: PNG, centralSize: 21 * 1024 * 1024, method: 0 }]);
  rejects(hugeDeclared, /size mismatch|exceeds 20MB|intrudes/);
});

test("crc32 matches zlib for a known vector", () => {
  // CRC-32("123456789") = 0xCBF43926 (canonical test vector).
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("rejects local/central CRC, size and version mismatches", () => {
  // Central CRC differs from the local record for the same entry.
  const centralTweaked = rawZip([{ name: "manifest.json", data: MANIFEST }], {
    patch: {},
  });
  void centralTweaked; // builder keeps them equal by design; corrupt one manually:
  const archive = rawZip([{ name: "manifest.json", data: MANIFEST }]);
  // Local CRC lives at localOffset+14; flip it after serialization.
  const localNameLength = archive.readUInt16LE(26);
  void localNameLength;
  const corrupted = Buffer.from(archive);
  corrupted.writeUInt32LE(crc32(MANIFEST) ^ 0xffff, 14);
  rejects(corrupted, /local\/central CRC or size mismatch/);
  // Version-needed mismatch between local and central records.
  const versionTweaked = Buffer.from(rawZip([{ name: "manifest.json", data: MANIFEST }]));
  versionTweaked.writeUInt16LE(21, 4); // local version-needed
  rejects(versionTweaked, /local\/central version mismatch|unsupported version/);
});

test("rejects structural gaps between entries (unclaimed payload)", () => {
  // Hand-assemble: locals1 + "xx" + locals2, central records claiming the
  // shifted offsets, EOCD consistent — only the 2-byte gap is anomalous.
  const first = rawEntry({ name: "manifest.json", data: MANIFEST });
  const second = rawEntry({ name: "assets/a.png", data: PNG });
  const gap = Buffer.from("xx");
  const secondOffset = first.local.length + gap.length;
  const centralOffset = secondOffset + second.local.length;
  const central = (built, offset) => {
    const record = Buffer.alloc(46 + built.nameBytes.length);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0, 8);
    record.writeUInt16LE(0, 10);
    record.writeUInt16LE(0, 12);
    record.writeUInt16LE(0, 14);
    record.writeUInt32LE(built.crc, 16);
    record.writeUInt32LE(built.size, 20);
    record.writeUInt32LE(built.size, 24);
    record.writeUInt16LE(built.nameBytes.length, 28);
    record.writeUInt32LE(offset, 42);
    built.nameBytes.copy(record, 46);
    return record;
  };
  const centralDirectory = Buffer.concat([central(first, 0), central(second, secondOffset)]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(2, 8);
  eocd.writeUInt16LE(2, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  const gapped = Buffer.concat([first.local, gap, second.local, centralDirectory, eocd]);
  rejects(gapped, /gaps or unclaimed payload/);
});
