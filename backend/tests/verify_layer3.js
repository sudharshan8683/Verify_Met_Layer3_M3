/**
 * VerifyMET+ Layer 3 (Physical-Digital Binding, Feature 3.2) — automated tests
 * Owner: M3.  Run:  npm run seed && npm start   (terminal 1)
 *                   npm run test:layer3          (terminal 2)
 */
const path = require('node:path');
const fs = require('node:fs');
const {
  computePHash, hammingDistance, classifyDistance, resolveMatchStatus
} = require('../src/services/perceptualHash');

const BASE_URL = process.env.API_BASE || 'http://localhost:5000/api';
const demoDir = path.join(__dirname, '../uploads/demo');
const GENUINE = '/uploads/demo/ESS-2023-98214_field_genuine.jpg';
const SWAPPED = '/uploads/demo/ESS-2023-98214_field_SWAPPED.jpg';

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ PASS  ${name} ${extra}`); }
  else { failed++; console.log(`  ❌ FAIL  ${name} ${extra}`); }
}
async function api(method, url, body) {
  const res = await fetch(BASE_URL + url, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json() };
}

(async () => {
  console.log('==============================================================');
  console.log('🧪 VERIFYMET+ LAYER 3 — Physical–Digital Binding tests (M3)');
  console.log('==============================================================');

  // ---------- A. Unit tests: perceptual hash engine ----------
  console.log('\n▶ A. pHash engine (no server needed)');
  const genuineBuf = fs.readFileSync(path.join(demoDir, 'ESS-2023-98214_field_genuine.jpg'));
  const swappedBuf = fs.readFileSync(path.join(demoDir, 'ESS-2023-98214_field_SWAPPED.jpg'));
  const regSvg = fs.readFileSync(path.join(__dirname, '../uploads/nameplates/ESS-2023-98214_nameplate.svg'));
  const hReg = await computePHash(regSvg);
  const hGen = await computePHash(genuineBuf);
  const hSwp = await computePHash(swappedBuf);
  check('hash is 256 bits (64 hex chars)', hReg.length === 64);
  check('identical image => distance 0', hammingDistance(hReg, await computePHash(regSvg)) === 0);
  const dGen = hammingDistance(hReg, hGen), dSwp = hammingDistance(hReg, hSwp);
  check('same nameplate, new photo => MATCH', classifyDistance(dGen) === 'MATCH', `(distance ${dGen})`);
  check('different nameplate => MISMATCH', classifyDistance(dSwp) === 'MISMATCH', `(distance ${dSwp})`);
  check('resolve: auto MISMATCH cannot be cleared by inspector', resolveMatchStatus('MISMATCH', 'MATCH') === 'MISMATCH');
  check('resolve: auto MATCH can be escalated by inspector', resolveMatchStatus('MATCH', 'MISMATCH') === 'MISMATCH');
  check('resolve: unsure => inspector decides', resolveMatchStatus('NEEDS_REVIEW', 'MATCH') === 'MATCH');
  check('resolve: unsure + no inspector input => NEEDS_REVIEW', resolveMatchStatus('NEEDS_REVIEW', undefined) === 'NEEDS_REVIEW');

  // ---------- B. API tests ----------
  console.log('\n▶ B. Nameplate comparison API');
  let r = await api('POST', '/nameplate/compare', { instrument_id: 'inst-01', candidate_photo_url: GENUINE, persist: false });
  check('genuine field photo => MATCH', r.data.status === 'MATCH', `(distance ${r.data.distance})`);
  check('preview mode does not persist', r.data.persisted === false);

  r = await api('POST', '/nameplate/compare', { instrument_id: 'inst-01', candidate_photo_url: '/uploads/demo/does-not-exist.jpg', persist: false });
  check('unreadable image => NEEDS_REVIEW (fallback to manual)', r.data.status === 'NEEDS_REVIEW' && !!r.data.error);

  r = await api('POST', '/nameplate/compare', { candidate_photo_url: GENUINE });
  check('missing instrument_id => 400', r.status === 400);

  r = await api('POST', '/nameplate/compare', { instrument_id: 'inst-01', candidate_photo_url: SWAPPED, compared_by: 'usr-lmo-01' });
  check('swapped nameplate => MISMATCH', r.data.status === 'MISMATCH', `(distance ${r.data.distance})`);
  r = await api('GET', '/nameplate/inst-01/history');
  check('comparison stored + visible to admin', r.data.count >= 1 && r.data.current_status === 'MISMATCH');
  r = await api('GET', '/risk-flags');
  const flags = (r.data.risk_flags || []).filter(f => f.flag_type === 'NAMEPLATE_MISMATCH' && f.entity_id === 'inst-01');
  check('mismatch raised a NAMEPLATE_MISMATCH risk flag', flags.length === 1);

  // ---------- C. Verification submit uses the server-side nameplate check ----------
  console.log('\n▶ C. Verification submit: server-side nameplate check');
  const inst2 = (await api('GET', '/instruments/inst-02')).data.instrument;
  const evidence = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const baseBody = {
    zero_error: 0, repeatability_error: 0.01, eccentricity_error: 0.01, discrimination_pass: 1,
    overall_result: 'PASS', photo_url: evidence, geo_lat: 18.5204, geo_lng: 73.8567
  };

  // C1. inst-02 carries the AVY nameplate. The inspector photographs the ESS plate (a swapped plate)
  //     but claims MATCH. The server must not trust the claim.
  r = await api('POST', '/verifications', {
    ...baseBody, application_id: 'app-02', instrument_id: 'inst-02', officer_id: 'usr-lmo-02',
    nameplate_photo_url: GENUINE /* = ESS plate, wrong for inst-02 */, nameplate_match_status: 'MATCH'
  });
  check('inspector claiming MATCH cannot clear an automatic MISMATCH', r.data.nameplate_match_status === 'MISMATCH', `(auto ${JSON.stringify(r.data.nameplate_check)})`);
  check('mismatch withholds certificate + sticker', r.data.certificate_withheld === true && !r.data.sticker_id);
  check('mismatch measurement still hash-chained as evidence', r.status === 201 && !!r.data.record_hash);

  // C2. Fresh application, correct nameplate photographed => MATCH, certificate + sticker issued
  const app = await api('POST', '/applications', { applicant_id: inst2.owner_id, instrument_id: 'inst-02', application_type: 'RE_VERIFICATION' });
  const appId = app.data.application_id;
  const officerId = (app.data.assigned_officer && app.data.assigned_officer.id) || 'usr-lmo-02';
  r = await api('POST', '/verifications', {
    ...baseBody, application_id: appId, instrument_id: 'inst-02', officer_id: officerId,
    nameplate_photo_url: SWAPPED /* = AVY plate photo = inst-02's real plate */, nameplate_match_status: 'MATCH'
  });
  check('correct nameplate => MATCH recorded', r.data.nameplate_match_status === 'MATCH', `(auto ${JSON.stringify(r.data.nameplate_check)})`);
  check('submission accepted and hash-chained', r.status === 201 && !!r.data.record_hash);
  const stickerId = r.data.sticker_id;
  check('PASS issues a tamper-evident sticker ID', /^STK-\d{4}-[0-9A-F]{6}$/.test(stickerId || ''), `(${stickerId})`);

  // ---------- D. Sticker lifecycle ----------
  console.log('\n▶ D. Tamper-evident sticker lifecycle');
  r = await api('GET', `/stickers/${stickerId}`);
  check('new sticker is trusted', r.data.trusted === true && r.data.sticker.status === 'ACTIVE');

  r = await api('POST', `/stickers/${stickerId}/report`, { reason: 'BOGUS' });
  check('invalid report reason => 400', r.status === 400);

  r = await api('POST', `/stickers/${stickerId}/report`, { reason: 'MOVED', note: 'Sticker on a scale with a different serial number' });
  check('citizen report => sticker COMPROMISED', r.status === 201 && r.data.new_status === 'COMPROMISED');
  check('MOVED sticker raises STICKER_TAMPER risk flag', r.data.risk_flag_raised === true);
  r = await api('GET', `/stickers/${stickerId}`);
  check('compromised sticker is no longer trusted', r.data.trusted === false && !!r.data.warning);

  r = await api('POST', `/stickers/${stickerId}/replace`, { officer_id: 'usr-mer-01' });
  check('merchant cannot replace a sticker (403)', r.status === 403);
  r = await api('POST', `/stickers/${stickerId}/replace`, { officer_id: officerId });
  check('LMO replaces sticker', r.status === 201 && !!r.data.new_sticker_id);
  const newId = r.data.new_sticker_id;
  r = await api('GET', `/stickers/${stickerId}`);
  check('old sticker marked REPLACED', r.data.sticker.status === 'REPLACED');
  r = await api('GET', `/stickers/${newId}`);
  check('replacement sticker is trusted', r.data.trusted === true);

  // ---------- E. Regression ----------
  console.log('\n▶ E. Regression on Layer 1/2');
  r = await api('GET', '/integrity/chain-check');
  check('hash chain still valid after Layer 3 activity', r.data.report && r.data.report.valid === true, JSON.stringify(r.data).slice(0, 90));
  r = await api('GET', '/certificates/verify/MH-PUN-2026-00841');
  check('public verification page still works (+ sticker info)', r.data.verified === true && !!r.data.sticker);

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('Test run crashed:', e); process.exit(1); });
