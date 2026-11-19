// Reads a government-ID photo on the server (OCR) and extracts the gender printed on it.
// Nothing is stored: the image is processed in memory and discarded.
import path from 'path';
import sharp from 'sharp';

export type Gender = 'FEMALE' | 'MALE' | 'OTHER';

// ---------- pure text analysis (unit-tested) ----------
const norm = (t: string) => t.toUpperCase().replace(/[|_]/g, ' ').replace(/[^A-Z0-9<:/\- \n]/g, ' ');

export function extractGender(raw: string): { gender: Gender | null; ambiguous: boolean } {
  const t = norm(raw);
  const found = new Set<Gender>();
  if (/\b(FEMALE|FEMAL|FEMAIE|FERNALE|FEMALF|FEMALR)\b/.test(t)) found.add('FEMALE');
  if (/\bMALE\b/.test(t)) found.add('MALE'); // "FEMALE" has no word boundary before "MALE", so this never fires inside it
  if (/\bTRANS\s?GENDER\b/.test(t)) found.add('OTHER');
  // Passports / licences: "SEX  F", "GENDER: M"
  for (const m of t.matchAll(/\b(?:SEX|GENDER)\s*[:/\-]?\s*(M|F|X)\b/g)) found.add(m[1] === 'F' ? 'FEMALE' : m[1] === 'M' ? 'MALE' : 'OTHER');
  // Machine-readable zone: ...<<<<<<<<  line 2 contains birth date, check digit, sex (M/F/<)
  const mrz = t.match(/\d{6}\d[MF<]\d{6}\d/);
  if (mrz) { const s = mrz[0][7]; if (s === 'F') found.add('FEMALE'); else if (s === 'M') found.add('MALE'); }
  if (found.size === 1) return { gender: [...found][0], ambiguous: false };
  return { gender: null, ambiguous: found.size > 1 };
}

const KEYWORDS: Record<string, RegExp> = {
  AADHAAR: /AADHAAR|AADHAR|UNIQUE IDENTIFICATION|GOVERNMENT OF INDIA|\b\d{4} \d{4} \d{4}\b|X{4}[ -]X{4}/,
  PASSPORT: /PASSPORT|REPUBLIC OF INDIA|P<IND/,
  VOTER_ID: /ELECTION COMMISSION|ELECTOR|\bEPIC\b|IDENTITY CARD/,
  DRIVING_LICENCE: /DRIVING|LICEN[CS]E|TRANSPORT|\bDL\b/,
};

export function looksLikeIdType(raw: string, idType: string): boolean {
  const re = KEYWORDS[idType];
  return !!re && re.test(norm(raw).replace(/\s+/g, ' '));
}

const lev = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};

/** At least one meaningful part of the entered name must appear on the ID (tolerates 1 OCR typo per word). */
export function nameOnId(entered: string, raw: string): boolean {
  const words = norm(raw).split(/[\s/:<-]+/).filter((w) => w.length >= 3);
  const parts = norm(entered).split(/\s+/).filter((p) => p.length >= 3);
  if (!parts.length) return false;
  return parts.some((p) => words.some((w) => w === p || (p.length >= 4 && lev(w, p) <= 1)));
}

// ---------- OCR engine ----------
type Worker = import('tesseract.js').Worker;
let workerP: Promise<Worker> | null = null;
let chain: Promise<unknown> = Promise.resolve();

async function getWorker(): Promise<Worker> {
  if (!workerP) {
    workerP = (async () => {
      const { createWorker } = await import('tesseract.js');
      const langPath = path.join(process.cwd(), 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int'); // bundled English model: no network needed
      return createWorker('eng', 1, { langPath, gzip: true, cachePath: path.join(process.env.TMPDIR || '/tmp', 'campuscrew-ocr') });
    })().catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

/** OCR one image; calls are serialised to keep memory flat. */
export function ocrText(png: Buffer): Promise<string> {
  const run = async () => {
    const w = await getWorker();
    const { data } = await w.recognize(png);
    return data.text as string;
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

/** Decodes the upload (rejects corrupt images) and prepares OCR-friendly variants. */
export async function prepareVariants(buf: Buffer): Promise<Buffer[]> {
  const base = sharp(buf, { failOn: 'error' }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error('unreadable');
  const w = Math.min(meta.width, 1800);
  const a = await base.clone().resize({ width: w, withoutEnlargement: true }).greyscale().normalize().png().toBuffer();
  const b = await base.clone().resize({ width: Math.min(2600, Math.max(w, 1600) * 1.4 | 0) }).greyscale().normalize().sharpen().png().toBuffer();
  return [a, b];
}

export type IdReading = { ok: true; gender: Gender } | { ok: false; code: string; message: string };

export async function readGovernmentId(buf: Buffer, opts: { idType: string; name: string }): Promise<IdReading> {
  let variants: Buffer[];
  try { variants = await prepareVariants(buf); } catch { return { ok: false, code: 'ID_UNREADABLE', message: 'We could not open that image. Upload a clear, uncorrupted photo of your ID.' }; }
  let sawText = '';
  for (const v of variants) {
    let text = '';
    try { text = await Promise.race([ocrText(v), new Promise<string>((_, rej) => setTimeout(() => rej(new Error('ocr-timeout')), 45_000))]); }
    catch { return { ok: false, code: 'ID_OCR_FAILED', message: 'ID reading is busy or unavailable right now. Please try again in a minute.' }; }
    sawText += '\n' + text;
    const g = extractGender(text);
    if (g.gender) {
      const all = sawText;
      if (!looksLikeIdType(all, opts.idType)) return { ok: false, code: 'ID_TYPE_MISMATCH', message: 'This does not look like the ID type you selected. Choose the right type or upload the correct document.' };
      if (!nameOnId(opts.name, all)) return { ok: false, code: 'ID_NAME_MISMATCH', message: 'The name on the ID does not match the name you entered. Enter your name exactly as printed on the ID.' };
      return { ok: true, gender: g.gender };
    }
    if (g.ambiguous) return { ok: false, code: 'ID_GENDER_AMBIGUOUS', message: 'We found conflicting gender text on the image. Upload a clear photo of only your own ID.' };
  }
  return { ok: false, code: 'ID_GENDER_UNREADABLE', message: 'We could not read the gender printed on your ID. Retake the photo in good light, flat and fully in frame (the front side that shows name, photo and gender).' };
}
