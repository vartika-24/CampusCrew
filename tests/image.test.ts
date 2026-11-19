import test from 'node:test';
import assert from 'node:assert/strict';
import { imageInfo, validateIdImage } from '../src/lib/image';

function png(w: number, h: number, pad = 64) {
  const b = Buffer.alloc(33 + pad);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
function jpeg(w: number, h: number) {
  const b = Buffer.alloc(64);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0; b.writeUInt16BE(16, 4); // APP0 len 16
  const o = 4 + 16; b[o] = 0xff; b[o + 1] = 0xc0; b.writeUInt16BE(11, o + 2); b[o + 4] = 8; b.writeUInt16BE(h, o + 5); b.writeUInt16BE(w, o + 7);
  return b;
}

test('detects real PNG / JPEG signatures and dimensions', () => {
  assert.deepEqual(imageInfo(png(800, 500)), { mime: 'image/png', width: 800, height: 500 });
  assert.deepEqual(imageInfo(jpeg(1000, 640)), { mime: 'image/jpeg', width: 1000, height: 640 });
});
test('rejects non-images, even with an image-like name', () => {
  assert.equal(imageInfo(Buffer.from('this is definitely not an image file at all, just text')), null);
  assert.equal(validateIdImage(Buffer.from('%PDF-1.4 ................................................')).ok, false);
});
test('rejects tiny images and empty uploads', () => {
  const small = validateIdImage(png(100, 80));
  assert.equal(small.ok, false);
  assert.equal(validateIdImage(Buffer.alloc(0)).ok, false);
});
test('accepts a plausibly sized ID photo', () => {
  assert.equal(validateIdImage(png(900, 600)).ok, true);
});
