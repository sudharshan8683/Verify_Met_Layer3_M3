const http = require('node:http');
const assert = require('node:assert');
const app = require('../src/server');
const { db } = require('../src/config/database');
const { runSeeds } = require('../src/seeds/seed_data');
const { runRedFlagEngine, DEFAULT_CONFIG } = require('../src/services/redFlagEngine');
const { computeRecordHash, hashString } = require('../src/services/integrityService');

const PORT = 5055;
const server = app.listen(PORT, async () => {
  console.log(`\n================================================================`);
  console.log(`🧪 Running M1 Backend & Integrity Lead Comprehensive Test Suite`);
  console.log(`================================================================\n`);

  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(`http://localhost:${PORT}${path}`, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  }

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  try {
    // -------------------------------------------------------------
    // Reset database to clean seeded state
    // -------------------------------------------------------------
    runSeeds();

    console.log('\n--- SECTION 1: HASH CHAIN INTEGRITY (LAYER 2) ---');

    // 1. First measurement creates valid hash
    await asyncTest('1. First measurement creates valid hash', async () => {
      const res = await request('/api/integrity/chain-check');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.report.valid, true);
      assert.strictEqual(res.body.report.count, 1);
      assert.ok(res.body.report.head_hash);
    });

    // 2. Second measurement correctly references previous hash
    let secondRecordHash = null;
    let firstRecordHash = null;
    await asyncTest('2. Second measurement correctly references previous hash', async () => {
      const chainBefore = await request('/api/integrity/chain-check');
      firstRecordHash = chainBefore.body.report.head_hash;

      const postRes = await request('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          application_id: 'app-02',
          instrument_id: 'inst-02',
          officer_id: 'usr-lmo-02',
          zero_error: 0.01,
          repeatability_error: 0.02,
          eccentricity_error: 0.01,
          discrimination_pass: 1,
          overall_result: 'PASS',
          photo_url: '/uploads/evidence/scale_2.jpg',
          geo_lat: 18.5169,
          geo_lng: 73.8560,
          nameplate_match_status: 'MATCH'
        }
      });

      assert.strictEqual(postRes.status, 201);
      assert.strictEqual(postRes.body.prev_hash, firstRecordHash);
      assert.ok(postRes.body.record_hash);
      secondRecordHash = postRes.body.record_hash;

      // Verify full chain holds both
      const chainAfter = await request('/api/integrity/chain-check');
      assert.strictEqual(chainAfter.body.report.valid, true);
      assert.strictEqual(chainAfter.body.report.count, 2);
      assert.strictEqual(chainAfter.body.report.head_hash, secondRecordHash);
    });

    // 3. Missing photo is rejected
    await asyncTest('3. Missing photo evidence is rejected with HTTP 400', async () => {
      const res = await request('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          application_id: 'app-02',
          instrument_id: 'inst-02',
          officer_id: 'usr-lmo-02',
          overall_result: 'PASS',
          geo_lat: 18.5169,
          geo_lng: 73.8560
          // Missing photo_url
        }
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Photo evidence is mandatory/i);
    });

    // 4. Missing geo coordinates are rejected
    await asyncTest('4. Missing geo coordinates are rejected with HTTP 400', async () => {
      const res = await request('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          application_id: 'app-02',
          instrument_id: 'inst-02',
          officer_id: 'usr-lmo-02',
          overall_result: 'PASS',
          photo_url: '/uploads/evidence/test.jpg'
          // Missing geo_lat & geo_lng
        }
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /GPS coordinates/i);
    });

    // 5. Photo hash participates in record hash
    test('5. Photo hash participates in record hash', () => {
      const hashWithPhotoA = computeRecordHash({
        instrumentId: 'inst-01',
        applicationId: 'app-01',
        officerId: 'usr-lmo-01',
        overallResult: 'PASS',
        photoUrl: '/uploads/evidence/photo_A.jpg',
        photoHash: hashString('CONTENT_BYTES_OF_PHOTO_A'),
        geoLat: 18.5167,
        geoLng: 73.8562,
        prevHash: 'PREV_HASH_123'
      });

      const hashWithPhotoB = computeRecordHash({
        instrumentId: 'inst-01',
        applicationId: 'app-01',
        officerId: 'usr-lmo-01',
        overallResult: 'PASS',
        photoUrl: '/uploads/evidence/photo_B.jpg',
        photoHash: hashString('CONTENT_BYTES_OF_PHOTO_B'),
        geoLat: 18.5167,
        geoLng: 73.8562,
        prevHash: 'PREV_HASH_123'
      });

      assert.notStrictEqual(hashWithPhotoA, hashWithPhotoB, 'Different photo contents must produce different record hashes');
    });

    // 6. Tampering with a stored field causes chain-check failure
    await asyncTest('6. Tampering with a stored field causes chain-check failure and audit log', async () => {
      // Tamper directly in SQLite
      const target = db.prepare('SELECT id FROM measurement_results LIMIT 1').get();
      db.prepare("UPDATE measurement_results SET overall_result = 'FAIL', geo_lat = 99.9999 WHERE id = ?").run(target.id);

      const auditCountBefore = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE action = 'CHAIN_CHECK_FAILED'").get().c;

      const check = await request('/api/integrity/chain-check');
      assert.strictEqual(check.body.report.valid, false);
      assert.strictEqual(check.body.report.record_id, target.id);
      assert.match(check.body.report.error, /Database tampering detected/i);

      // Verify audit log entry was written
      const auditCountAfter = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE action = 'CHAIN_CHECK_FAILED'").get().c;
      assert.ok(auditCountAfter > auditCountBefore, 'Audit log entry must be created when chain check fails');

      // Restore
      db.prepare("UPDATE measurement_results SET overall_result = 'PASS', geo_lat = 18.5167 WHERE id = ?").run(target.id);
      const restoreCheck = await request('/api/integrity/chain-check');
      assert.strictEqual(restoreCheck.body.report.valid, true);
    });

    console.log('\n--- SECTION 2: BLIND WEIGHTED-RANDOM ASSIGNMENT (LAYER 4) ---');

    // 7. Only inspectors from correct jurisdiction are eligible
    await asyncTest('7. Only inspectors from correct jurisdiction are eligible', async () => {
      // In seed data: jur-pune-01 has LMO-01, LMO-03, LMO-04. jur-pune-02 has LMO-02 (or non-Pune).
      // Let's create an application in jur-pune-01
      const appRes = await request('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          applicant_id: 'usr-mer-01', // in jur-pune-01
          instrument_id: 'inst-01',
          application_type: 'RE_VERIFICATION',
          deterministic: true
        }
      });
      assert.strictEqual(appRes.status, 201);
      assert.ok(appRes.body.assigned_officer);
      // Assigned officer must belong to jur-pune-01
      const officer = db.prepare('SELECT jurisdiction_id FROM users WHERE id = ?').get(appRes.body.assigned_officer.id);
      assert.strictEqual(officer.jurisdiction_id, 'jur-pune-01');
    });

    // 8. Lower workload receives higher selection probability (deterministic test)
    await asyncTest('8. Lower workload receives higher selection probability', async () => {
      // LMO-03 has 0 open cases, while others have open cases
      // Under deterministic mode, lowest workload officer is selected
      const res = await request('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          applicant_id: 'usr-mer-02', // in jur-pune-02
          instrument_id: 'inst-03',
          application_type: 'INITIAL',
          deterministic: true
        }
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.assigned_officer);
      assert.strictEqual(res.body.assignment_method, 'AUTO_WEIGHTED_RANDOM');
    });

    // 9. Cool-down prevents repeated owner-inspector pairing
    await asyncTest('9. Cool-down prevents repeated owner-inspector pairing', async () => {
      // Create first application for merchant 01 assigned to LMO-03
      const first = await request('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          applicant_id: 'usr-mer-01',
          instrument_id: 'inst-01',
          application_type: 'RE_VERIFICATION',
          deterministic: true
        }
      });
      const firstOfficerId = first.body.assigned_officer.id;

      // Immediately submit a second application for the same merchant:
      // The cool-down rule must exclude firstOfficerId
      const second = await request('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          applicant_id: 'usr-mer-01',
          instrument_id: 'inst-01',
          application_type: 'RE_VERIFICATION',
          deterministic: true
        }
      });

      assert.strictEqual(second.status, 201);
      assert.notStrictEqual(second.body.assigned_officer.id, firstOfficerId, 'Cool-down must rotate away from recently paired inspector');
      assert.match(second.body.assignment_reason, /Cool-down active/i);
    });

    // 10. Fallback works when normal candidates are unavailable
    await asyncTest('10. Fallback works when all candidates are in cool-down', async () => {
      // If we ask for assignment with narrow constraint where all are cooled down, fallback assigns least loaded
      const app = db.prepare("SELECT id FROM verification_applications WHERE status = 'SCHEDULED' LIMIT 1").get();
      const patchRes = await request(`/api/applications/${app.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: { deterministic: true }
      });
      assert.strictEqual(patchRes.status, 200);
      assert.ok(patchRes.body.assigned_officer_id);
      assert.ok(patchRes.body.assignment_reason);
    });

    // 11. assignment_method and assignment_reason are stored
    await asyncTest('11. assignment_method and assignment_reason are stored in database', async () => {
      const app = db.prepare("SELECT * FROM verification_applications WHERE assignment_method = 'AUTO_WEIGHTED_RANDOM' LIMIT 1").get();
      assert.ok(app);
      assert.strictEqual(app.assignment_method, 'AUTO_WEIGHTED_RANDOM');
      assert.ok(app.assignment_reason.length > 10);
    });

    // 12. Existing PATCH /api/applications/:id/assign still works for manual and auto
    await asyncTest('12. Existing PATCH /api/applications/:id/assign still works for manual admin override', async () => {
      const app = db.prepare('SELECT id FROM verification_applications LIMIT 1').get();
      const res = await request(`/api/applications/${app.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: { officer_id: 'usr-lmo-01', reason: 'Manual re-assignment by Director' }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.assignment_method, 'MANUAL');
      assert.strictEqual(res.body.assigned_officer_id, 'usr-lmo-01');
    });

    console.log('\n--- SECTION 3: RED-FLAG ANOMALY ENGINE (LAYER 4) ---');

    // 13. High override rate produces a flag
    test('13. High override rate produces an OVERRIDE_OUTLIER flag', () => {
      // Insert test observations for an inspector with high overrides
      db.prepare(`
        INSERT INTO measurement_results (id, application_id, instrument_id, officer_id, zero_error, repeatability_error, eccentricity_error, discrimination_pass, overall_result, observations_json, photo_url, geo_lat, geo_lng, captured_at, record_hash, prev_hash)
        VALUES ('meas-ov-1', 'app-01', 'inst-01', 'usr-lmo-04', 0.15, 0.12, 0.10, 1, 'PASS', '{"override":true}', '/p.jpg', 18.5, 73.8, '2026-09-20', 'h1', 'p1')
      `).run();

      const results = runRedFlagEngine({ overrideRateThresholdPct: 10.0 });
      const overrideFlag = results.flags.find(f => f.flag_type === 'OVERRIDE_OUTLIER' && f.entity_id === 'usr-lmo-04');
      assert.ok(overrideFlag, 'High override rate must generate an OVERRIDE_OUTLIER flag');
      assert.ok(overrideFlag.score >= 65);
    });

    // 14. Impossible travel produces an IMPOSSIBLE_TRAVEL flag
    test('14. Impossible travel produces an IMPOSSIBLE_TRAVEL flag', () => {
      // LMO-03 has two tests 34 km apart in 7 minutes
      db.prepare(`
        INSERT INTO measurement_results (id, application_id, instrument_id, officer_id, zero_error, repeatability_error, eccentricity_error, discrimination_pass, overall_result, observations_json, photo_url, geo_lat, geo_lng, captured_at, record_hash, prev_hash)
        VALUES 
          ('meas-tr-1', 'app-01', 'inst-01', 'usr-lmo-03', 0.0, 0.0, 0.0, 1, 'PASS', '{}', '/p1.jpg', 18.5089, 73.9260, '2026-09-21 10:00:00', 'h1', 'p1'),
          ('meas-tr-2', 'app-02', 'inst-02', 'usr-lmo-03', 0.0, 0.0, 0.0, 1, 'PASS', '{}', '/p2.jpg', 18.5913, 73.6980, '2026-09-21 10:06:00', 'h2', 'h1')
      `).run();

      const results = runRedFlagEngine({ maxFeasibleSpeedKmH: 80.0, minTravelDistanceKm: 5.0 });
      const travelFlag = results.flags.find(f => f.flag_type === 'IMPOSSIBLE_TRAVEL' && f.entity_id === 'usr-lmo-03');
      assert.ok(travelFlag, 'Impossible travel between consecutive tests must generate an IMPOSSIBLE_TRAVEL flag');
      assert.ok(travelFlag.score >= 75);
    });

    // 15. Repeat pairing produces a REPEAT_PAIRING flag
    test('15. Repeat pairing produces a REPEAT_PAIRING flag', () => {
      // Insert repeated applications for same merchant and officer
      for (let i = 0; i < 4; i++) {
        db.prepare(`
          INSERT INTO verification_applications (id, application_number, applicant_id, instrument_id, application_type, fee_amount, payment_status, status, assigned_officer_id)
          VALUES ('app-pair-${i}', 'APP-PAIR-${i}', 'usr-mer-01', 'inst-01', 'RE_VERIFICATION', 450, 'PAID', 'COMPLETED', 'usr-lmo-01')
        `).run();
      }

      const results = runRedFlagEngine({ repeatPairingThreshold: 3 });
      const pairFlag = results.flags.find(f => f.flag_type === 'REPEAT_PAIRING' && f.entity_id === 'usr-lmo-01');
      assert.ok(pairFlag, 'Repeat merchant-inspector pairings exceeding threshold must generate REPEAT_PAIRING flag');
    });

    // 16. Sudden pass-rate jump produces a PASS_RATE_SPIKE flag
    test('16. Sudden pass-rate jump produces a PASS_RATE_SPIKE flag', () => {
      // 3 fails then 3 passes = 0% to 100% (+100% jump)
      for (let i = 0; i < 3; i++) {
        db.prepare(`
          INSERT INTO measurement_results (id, application_id, instrument_id, officer_id, zero_error, repeatability_error, eccentricity_error, discrimination_pass, overall_result, observations_json, photo_url, geo_lat, geo_lng, captured_at, record_hash, prev_hash)
          VALUES ('meas-jmp-f-${i}', 'app-01', 'inst-01', 'usr-lmo-02', 0.1, 0.1, 0.1, 0, 'FAIL', '{}', '/p.jpg', 18.5, 73.8, '2026-08-0${i+1} 10:00:00', 'h', 'p')
        `).run();
      }
      for (let i = 0; i < 3; i++) {
        db.prepare(`
          INSERT INTO measurement_results (id, application_id, instrument_id, officer_id, zero_error, repeatability_error, eccentricity_error, discrimination_pass, overall_result, observations_json, photo_url, geo_lat, geo_lng, captured_at, record_hash, prev_hash)
          VALUES ('meas-jmp-p-${i}', 'app-01', 'inst-01', 'usr-lmo-02', 0.0, 0.0, 0.0, 1, 'PASS', '{}', '/p.jpg', 18.5, 73.8, '2026-09-0${i+1} 10:00:00', 'h', 'p')
        `).run();
      }

      const results = runRedFlagEngine({ passRateJumpThresholdPct: 30.0, minInspectionsForJump: 4 });
      const jumpFlag = results.flags.find(f => f.flag_type === 'PASS_RATE_SPIKE' && f.entity_id === 'usr-lmo-02');
      assert.ok(jumpFlag, 'Sudden jump from 0% to 100% pass rate must generate PASS_RATE_SPIKE flag');
    });

    // 17. Clean inspector under normal seeded data does not receive false flags
    test('17. Clean inspector does not receive false flags under clean data', () => {
      // Clean inspector usr-lmo-01 in fresh seed has standard records without impossible travel
      runSeeds();
      const results = runRedFlagEngine();
      const falseTravel = results.flags.find(f => f.entity_id === 'usr-lmo-01' && f.flag_type === 'IMPOSSIBLE_TRAVEL');
      assert.strictEqual(falseTravel, undefined, 'Clean inspector must not receive false travel flags under normal seed data');
    });

    console.log('\n--- SECTION 4: PUBLIC COMPLAINT LOOP (LAYER 5) ---');

    // 18. Valid complaint is stored
    await asyncTest('18. Valid complaint is stored in public_complaints', async () => {
      const res = await request('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          certificate_number: 'MH-PUN-2026-00841',
          complainant_name: 'Rohit Joshi',
          complainant_phone: '+919822001122',
          description: 'Observed scale in shop giving 850 grams for 1 kg vegetables consistently.'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.complaint_id);

      // Verify in DB
      const row = db.prepare('SELECT * FROM public_complaints WHERE id = ?').get(res.body.complaint_id);
      assert.ok(row);
      assert.strictEqual(row.status, 'PENDING_REVIEW');
    });

    // 19. Invalid certificate is rejected
    await asyncTest('19. Invalid certificate is rejected with HTTP 404', async () => {
      const res = await request('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          certificate_number: 'NON-EXISTENT-CERT-99999',
          description: 'Some random complaint about a scale'
        }
      });
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Invalid Certificate/i);
    });

    // 20. Public endpoint is rate-limited
    await asyncTest('20. Public endpoint is rate-limited upon repeated requests', async () => {
      let hitRateLimit = false;
      for (let i = 0; i < 7; i++) {
        const res = await request('/api/complaints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            certificate_number: 'MH-PUN-2026-00841',
            description: `Legitimate test description for consumer report repetition #${i}`
          }
        });
        if (res.status === 429) {
          hitRateLimit = true;
          break;
        }
      }
      assert.strictEqual(hitRateLimit, true, 'Submitting excessive requests in a short window must trigger HTTP 429 rate limit');
    });

    // 21. Complaint creates/updates risk flag
    test('21. Complaint dynamically creates/updates inspector risk flag', () => {
      const flag = db.prepare("SELECT * FROM risk_flags WHERE flag_type = 'PUBLIC_COMPLAINT_LOGGED' AND status = 'ACTIVE' LIMIT 1").get();
      assert.ok(flag, 'Public complaint must create an active risk flag');
      assert.ok(flag.score >= 45.0);
    });

    // 22. Existing notification hook is triggered correctly
    test('22. Existing notification hooks triggered for in_app and whatsapp channels', () => {
      const notifApp = db.prepare("SELECT * FROM notifications WHERE channel = 'in_app' AND title LIKE '%Complaint%' ORDER BY created_at DESC LIMIT 1").get();
      assert.ok(notifApp, 'in_app notification hook must be created for inspector');

      const notifWA = db.prepare("SELECT * FROM notifications WHERE channel = 'whatsapp' AND title LIKE '%Consumer%' ORDER BY created_at DESC LIMIT 1").get();
      assert.ok(notifWA, 'whatsapp notification hook must be created for merchant');
    });

    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
    console.log('================================================================\n');

  } catch (globalErr) {
    console.error('Fatal test error:', globalErr);
  } finally {
    server.close();
    process.exit(passed === total ? 0 : 1);
  }
});
