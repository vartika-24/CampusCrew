// Renders a synthetic ID-card-like image (text only) for end-to-end tests. Not a real ID.
import sharp from 'sharp';

export async function idImage({ name = 'TEST STUDENT', gender = 'Female', type = 'AADHAAR', extra = '' } = {}) {
  const head = { AADHAAR: 'GOVERNMENT OF INDIA', PASSPORT: 'REPUBLIC OF INDIA PASSPORT', VOTER_ID: 'ELECTION COMMISSION OF INDIA', DRIVING_LICENCE: 'DRIVING LICENCE' }[type];
  const lines = [name && `Name: ${name}`, 'DOB: 12/03/2003', gender && `${gender}`, extra, type === 'AADHAAR' ? 'XXXX XXXX 4821' : `No ${Math.floor(Math.random() * 1e8)}`].filter(Boolean);
  const text = lines.map((l, i) => `<text x="60" y="${190 + i * 75}" font-size="36" font-family="DejaVu Sans">${l.replace(/&/g, '&amp;')}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="640"><rect width="1000" height="640" fill="#fff"/><text x="60" y="90" font-size="40" font-weight="bold" font-family="DejaVu Sans">${head}</text>${text}<text x="620" y="600" font-size="22" font-family="DejaVu Sans">Ref ${Math.floor(Math.random() * 1e9)}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const blankImage = () => sharp({ create: { width: 900, height: 600, channels: 3, background: '#ffffff' } }).png().toBuffer();

/** Passes the magic-byte + size checks but cannot be decoded. */
export function corruptPng() {
  const b = Buffer.alloc(2048, 5);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(1000, 16); b.writeUInt32BE(640, 20);
  return b;
}
