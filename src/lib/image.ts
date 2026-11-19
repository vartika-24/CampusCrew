// Minimal, dependency-free image sniffing: real file signature + pixel dimensions.
export type ImageInfo = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; width: number; height: number };

export function imageInfo(b: Buffer): ImageInfo | null {
  if (b.length < 32) return null;
  // PNG
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (b.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { mime: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker >= 0xd0 && marker <= 0xd9) { i += 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  // WebP
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const fmt = b.toString('ascii', 12, 16);
    if (fmt === 'VP8X') return { mime: 'image/webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (fmt === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { mime: 'image/webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (fmt === 'VP8L' && b[20] === 0x2f) {
      const bits = b.readUInt32LE(21);
      return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

export const ID_IMAGE = { maxBytes: 4 * 1024 * 1024, minWidth: 400, minHeight: 250 } as const;

export function validateIdImage(buf: Buffer): { ok: true; info: ImageInfo } | { ok: false; error: string } {
  if (buf.length === 0) return { ok: false, error: 'The ID image is empty' };
  if (buf.length > ID_IMAGE.maxBytes) return { ok: false, error: 'ID image must be smaller than 4 MB' };
  const info = imageInfo(buf);
  if (!info) return { ok: false, error: 'Upload a real JPG, PNG or WebP photo of your ID' };
  if (info.width < ID_IMAGE.minWidth || info.height < ID_IMAGE.minHeight) {
    return { ok: false, error: `Image is too small to read (${info.width}×${info.height}). Use at least ${ID_IMAGE.minWidth}×${ID_IMAGE.minHeight} pixels.` };
  }
  return { ok: true, info };
}
