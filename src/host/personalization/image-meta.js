/**
 * Magic-number sniffing and header-only dimension parsing for the four
 * user-uploadable raster formats (PNG / JPEG / GIF / WebP). Pure Buffer
 * functions — no filesystem, no decoding. Used by the Host ingest path
 * (upload + theme import) so declared MIME values are never trusted.
 *
 * WebP covers all three container chunks (VP8X / `VP8 ` / VP8L) and reads
 * the VP8X animation flag; animated WebP is rejected by callers.
 */

function ascii(buffer, offset, length) {
  return String.fromCharCode(...buffer.subarray(offset, offset + length));
}

function parsePng(buffer) {
  if (buffer.length < 24) return null;
  if (ascii(buffer, 0, 8) !== "\x89PNG\r\n\x1a\n") return null;
  if (ascii(buffer, 12, 4) !== "IHDR") return null;
  return {
    mime: "image/png",
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    animated: false,
  };
}

function parseGif(buffer) {
  if (buffer.length < 10) return null;
  const signature = ascii(buffer, 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  return {
    mime: "image/gif",
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
    animated: null, // frame counting is out of scope; GIF animation is allowed
  };
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function parseJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // standalone markers carry no length
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null; // hit entropy data: give up
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (JPEG_SOF_MARKERS.has(marker)) {
      return {
        mime: "image/jpeg",
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
        animated: false,
      };
    }
    offset += 2 + length;
  }
  return null;
}

function parseWebp(buffer) {
  if (buffer.length < 30) return null;
  if (ascii(buffer, 0, 4) !== "RIFF" || ascii(buffer, 8, 4) !== "WEBP") return null;
  const chunk = ascii(buffer, 12, 4);
  if (chunk === "VP8X") {
    const flags = buffer[20];
    const width = buffer.readUIntLE(24, 3) + 1;
    const height = buffer.readUIntLE(27, 3) + 1;
    return { mime: "image/webp", width, height, animated: (flags & 0x02) !== 0 };
  }
  if (chunk === "VP8 ") {
    if (ascii(buffer, 20, 3) !== "\x9d\x01\x2a") return null;
    return {
      mime: "image/webp",
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
      animated: false,
    };
  }
  if (chunk === "VP8L") {
    if (buffer[20] !== 0x2f) return null;
    const bits = buffer.readUInt32LE(21);
    return {
      mime: "image/webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      animated: false,
    };
  }
  return null;
}

/**
 * Sniff an image buffer. Returns `{ mime, width, height, animated }` or
 * null when the bytes match none of the supported formats. `animated` is
 * false, true, or null (unknown — GIF frame walking is out of scope).
 */
export function detectImageMeta(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) return null;
  return parsePng(buffer) ?? parseJpeg(buffer) ?? parseGif(buffer) ?? parseWebp(buffer);
}

/** Extension for a sniffed MIME type (used for on-disk blob names). */
export function extensionForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return null;
}
