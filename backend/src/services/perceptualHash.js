/**
 * VerifyMET+ Layer 3 (Feature 3.2) — Perceptual-hash nameplate comparison
 *
 * Idea: two photos of the SAME nameplate (different light, angle, phone)
 * produce nearly identical perceptual hashes; photos of DIFFERENT nameplates
 * produce hashes that differ in many bits. We measure that with the
 * Hamming distance and map it to MATCH / NEEDS_REVIEW / MISMATCH.
 *
 * Algorithm: DCT-based pHash (256-bit)
 *   1. decode image -> greyscale -> resize to 64x64
 *   2. 2-D DCT-II
 *   3. keep the top-left 16x16 low-frequency block
 *   4. bit = coefficient > median (DC term excluded from the median)
 *
 * The three thresholds are tunable through environment variables:
 *   PHASH_MATCH_MAX     (default 20)  distance <= this  -> MATCH
 *   PHASH_MISMATCH_MIN  (default 26)  distance >= this  -> MISMATCH
 *   anything in between                                  -> NEEDS_REVIEW
 * "Unsure" always falls back to the inspector's manual review (see plan).
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const IMG_SIZE = 64; // working resolution
const HASH_SIZE = 16; // 16x16 = 256 bits
const HASH_BITS = HASH_SIZE * HASH_SIZE;

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const PUBLIC_UPLOADS_DIR = path.join(__dirname, '../../../frontend/public/uploads');

function getThresholds() {
  const matchMax = Number(process.env.PHASH_MATCH_MAX ?? 20);
  const mismatchMin = Number(process.env.PHASH_MISMATCH_MIN ?? 26);
  return { matchMax, mismatchMin };
}

// ---- pre-computed DCT basis (cos table) ----
const COS = (() => {
  const table = [];
  for (let k = 0; k < HASH_SIZE; k++) {
    const row = new Float64Array(IMG_SIZE);
    for (let n = 0; n < IMG_SIZE; n++) {
      row[n] = Math.cos(((2 * n + 1) * k * Math.PI) / (2 * IMG_SIZE));
    }
    table.push(row);
  }
  return table;
})();

/** DCT of the low-frequency HASH_SIZE x HASH_SIZE block only (fast). */
function lowFreqDct(pixels) {
  // rows first: tmp[y][u]
  const tmp = new Float64Array(IMG_SIZE * HASH_SIZE);
  for (let y = 0; y < IMG_SIZE; y++) {
    for (let u = 0; u < HASH_SIZE; u++) {
      let sum = 0;
      for (let x = 0; x < IMG_SIZE; x++) sum += pixels[y * IMG_SIZE + x] * COS[u][x];
      tmp[y * HASH_SIZE + u] = sum;
    }
  }
  // columns: out[v][u]
  const out = new Float64Array(HASH_SIZE * HASH_SIZE);
  for (let v = 0; v < HASH_SIZE; v++) {
    for (let u = 0; u < HASH_SIZE; u++) {
      let sum = 0;
      for (let y = 0; y < IMG_SIZE; y++) sum += tmp[y * HASH_SIZE + u] * COS[v][y];
      out[v * HASH_SIZE + u] = sum;
    }
  }
  return out;
}

/** Compute a 256-bit perceptual hash (64 hex chars) from an image buffer. */
async function computePHash(buffer) {
  // Step 1: normalise geometry. Squash to 128x128 and keep the centre 85%,
  // which drops the background / bezel / hand that surrounds the plate in a
  // real photo and makes the hash focus on the plate itself.
  const resized = await sharp(buffer, { density: 144 })
    .flatten({ background: '#ffffff' })
    .greyscale()
    .resize(128, 128, { fit: 'fill' })
    .png()
    .toBuffer();
  // (separate pipeline on purpose: sharp would otherwise run extract BEFORE resize)
  const squared = await sharp(resized)
    .extract({ left: 10, top: 10, width: 108, height: 108 })
    .png()
    .toBuffer();

  // Step 2: contrast-normalise (robust to lighting) and reduce to 64x64.
  const { data, info } = await sharp(squared)
    .greyscale()
    .normalise()
    .resize(IMG_SIZE, IMG_SIZE, { fit: 'fill' })
    .toColourspace('b-w') // force exactly 1 channel so data[] is one byte per pixel
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1 || data.length !== IMG_SIZE * IMG_SIZE) {
    throw new Error(`Unexpected pixel layout (channels=${info.channels})`);
  }

  const coeffs = lowFreqDct(data);

  // median of coefficients, excluding the DC term (index 0)
  const sorted = Array.from(coeffs.slice(1)).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let bits = '';
  for (let i = 0; i < coeffs.length; i++) bits += coeffs[i] > median ? '1' : '0';

  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Hamming distance between two hex hashes (number of differing bits). */
function hammingDistance(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== hexB.length) {
    throw new Error('Perceptual hashes must be the same length');
  }
  let dist = 0;
  for (let i = 0; i < hexA.length; i++) {
    let x = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

/** Map a distance to MATCH / NEEDS_REVIEW / MISMATCH. */
function classifyDistance(distance) {
  const { matchMax, mismatchMin } = getThresholds();
  if (distance <= matchMax) return 'MATCH';
  if (distance >= mismatchMin) return 'MISMATCH';
  return 'NEEDS_REVIEW';
}

/**
 * Load image bytes from: data: URI, http(s) URL, or a local /uploads/... path.
 * Throws on anything we cannot read (caller turns that into NEEDS_REVIEW).
 */
async function loadImageBuffer(source) {
  if (!source || typeof source !== 'string') throw new Error('No image source provided');

  if (source.startsWith('data:')) {
    const commaIdx = source.indexOf(',');
    if (commaIdx === -1) throw new Error('Malformed data URI');
    const meta = source.slice(5, commaIdx);
    const payload = source.slice(commaIdx + 1);
    return meta.includes(';base64')
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
  }

  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Could not download image (HTTP ${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  // local path such as /uploads/nameplates/x.jpg or /uploads/evidence/y.jpg
  const clean = path.posix.normalize(source).replace(/^(\.\.(\/|\\|$))+/, '');
  const rel = clean.replace(/^\/?uploads\//, '');
  for (const base of [UPLOADS_DIR, PUBLIC_UPLOADS_DIR]) {
    const full = path.resolve(base, rel);
    if (!full.startsWith(path.resolve(base))) continue; // path-traversal guard
    if (fs.existsSync(full)) return fs.readFileSync(full);
  }
  throw new Error(`Image not found: ${source}`);
}

/**
 * Compare a reference nameplate photo with a new one.
 * Never throws: on any decoding problem the result is NEEDS_REVIEW so the
 * inspector's manual side-by-side review takes over.
 */
async function compareNameplates(referenceSource, candidateSource) {
  const { matchMax, mismatchMin } = getThresholds();
  try {
    const [refBuf, candBuf] = await Promise.all([
      loadImageBuffer(referenceSource),
      loadImageBuffer(candidateSource)
    ]);
    const [refHash, candHash] = await Promise.all([computePHash(refBuf), computePHash(candBuf)]);
    const distance = hammingDistance(refHash, candHash);
    return {
      status: classifyDistance(distance),
      distance,
      similarity_pct: Math.round((1 - distance / HASH_BITS) * 1000) / 10,
      reference_hash: refHash,
      candidate_hash: candHash,
      thresholds: { match_max: matchMax, mismatch_min: mismatchMin, hash_bits: HASH_BITS },
      error: null
    };
  } catch (err) {
    return {
      status: 'NEEDS_REVIEW',
      distance: null,
      similarity_pct: null,
      reference_hash: null,
      candidate_hash: null,
      thresholds: { match_max: matchMax, mismatch_min: mismatchMin, hash_bits: HASH_BITS },
      error: err.message
    };
  }
}

/**
 * Combine the automatic result with the inspector's manual decision.
 *  - auto MISMATCH is final: an inspector cannot clear it (anti-collusion).
 *  - auto MATCH: inspector may still escalate to MISMATCH / NEEDS_REVIEW.
 *  - auto NEEDS_REVIEW: the inspector's decision decides.
 */
function resolveMatchStatus(autoStatus, inspectorStatus) {
  const valid = ['MATCH', 'MISMATCH', 'NEEDS_REVIEW'];
  const manual = valid.includes(inspectorStatus) ? inspectorStatus : null;
  if (!autoStatus) return manual || 'UNVERIFIED';
  if (autoStatus === 'MISMATCH') return 'MISMATCH';
  if (autoStatus === 'MATCH') return manual && manual !== 'MATCH' ? manual : 'MATCH';
  return manual || 'NEEDS_REVIEW';
}

module.exports = {
  computePHash,
  hammingDistance,
  classifyDistance,
  compareNameplates,
  loadImageBuffer,
  resolveMatchStatus,
  getThresholds,
  HASH_BITS
};
