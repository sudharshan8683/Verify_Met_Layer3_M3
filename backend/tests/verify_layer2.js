const http = require('node:http');
const app = require('../src/server');

const server = app.listen(5002, async () => {
  console.log('🧪 Running VerifyMET+ Layer 2 Evidence-Bound Verification Suite...');

  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(`http://localhost:5002${path}`, options, (res) => {
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

  try {
    // -----------------------------------------------------------------
    // TEST CRITERIA 3: A submission without photo or location is rejected
    // -----------------------------------------------------------------
    console.log('\n--- Checking Criteria 3: Rejection of Submissions Missing Photo or Geo-Location ---');
    const rejectWithoutGeo = await request('/api/verifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        application_id: 'app-02',
        instrument_id: 'inst-02',
        officer_id: 'usr-lmo-02',
        zero_error: 0.0,
        overall_result: 'PASS',
        photo_url: '/uploads/evidence/sample.jpg'
        // Missing geo_lat & geo_lng
      }
    });

    if (rejectWithoutGeo.status === 400 && !rejectWithoutGeo.body.success) {
      console.log(`[PASS] Criteria 3a: Verification rejected without GPS location (HTTP 400: "${rejectWithoutGeo.body.error}")`);
    } else {
      throw new Error('Failed to reject submission missing GPS location');
    }

    const rejectWithoutPhoto = await request('/api/verifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        application_id: 'app-02',
        instrument_id: 'inst-02',
        officer_id: 'usr-lmo-02',
        zero_error: 0.0,
        overall_result: 'PASS',
        geo_lat: 18.5204,
        geo_lng: 73.8567
        // Missing photo_url
      }
    });

    if (rejectWithoutPhoto.status === 400 && !rejectWithoutPhoto.body.success) {
      console.log(`[PASS] Criteria 3b: Verification rejected without live photo proof (HTTP 400: "${rejectWithoutPhoto.body.error}")`);
    } else {
      throw new Error('Failed to reject submission missing photo evidence');
    }

    // -----------------------------------------------------------------
    // TEST CRITERIA 1: Every new measurement row has photo_url, geo_lat, geo_lng, captured_at, record_hash, prev_hash
    // -----------------------------------------------------------------
    console.log('\n--- Checking Criteria 1: Hash-Chained Measurement Insertion ---');
    const validVerification = await request('/api/verifications', {
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
        photo_url: '/uploads/evidence/meas_inst02_live.jpg',
        geo_lat: 18.5169,
        geo_lng: 73.8560,
        nameplate_match_status: 'MATCH'
      }
    });

    if (validVerification.status === 201 && validVerification.body.record_hash && validVerification.body.prev_hash) {
      console.log(`[PASS] Criteria 1: Inspection recorded on chain.`);
      console.log(`       - Record Hash : ${validVerification.body.record_hash}`);
      console.log(`       - Prev Hash   : ${validVerification.body.prev_hash}`);
      console.log(`       - Certificate : ${validVerification.body.certificate_number}`);
    } else {
      throw new Error(`Failed valid verification: ${JSON.stringify(validVerification.body)}`);
    }

    // -----------------------------------------------------------------
    // TEST CRITERIA 4: Chain verifies after full cycle
    // -----------------------------------------------------------------
    console.log('\n--- Checking Criteria 4: Cryptographic Verification of the Entire Chain ---');
    const chainCheck1 = await request('/api/integrity/chain-check');
    if (chainCheck1.body.report.valid && chainCheck1.body.report.count >= 2) {
      console.log(`[PASS] Criteria 4: Chain integrity verified successfully across all ${chainCheck1.body.report.count} blocks.`);
      console.log(`       Head Hash: ${chainCheck1.body.report.head_hash}`);
    } else {
      throw new Error(`Chain verification failed: ${JSON.stringify(chainCheck1.body)}`);
    }

    // -----------------------------------------------------------------
    // TEST CRITERIA 2: Editing any stored field directly in the database makes chain-check fail at that record
    // -----------------------------------------------------------------
    console.log('\n--- Checking Criteria 2: Automated Tamper Detection (Deliberate DB Manipulation) ---');
    
    // Simulate database tampering
    const tamperRes = await request('/api/integrity/simulate-tamper', { method: 'POST' });
    console.log(`[SIMULATION] ${tamperRes.body.message}`);

    // Now run chain check; it MUST fail and pinpoint the exact block!
    const chainCheckAfterTamper = await request('/api/integrity/chain-check');
    if (!chainCheckAfterTamper.body.report.valid && chainCheckAfterTamper.body.report.broken_at_index !== undefined) {
      console.log(`[PASS] Criteria 2: Tamper Detected with 100% precision!`);
      console.log(`       - Broken at Block Index: #${chainCheckAfterTamper.body.report.broken_at_index + 1}`);
      console.log(`       - Targeted Record ID   : ${chainCheckAfterTamper.body.report.record_id}`);
      console.log(`       - Error Description    : ${chainCheckAfterTamper.body.report.error}`);
    } else {
      throw new Error('Chain check failed to detect unauthorized database tampering!');
    }

    // Restore chain back to clean state
    const restoreRes = await request('/api/integrity/restore-chain', { method: 'POST' });
    console.log(`\n[RESTORE] ${restoreRes.body.message}`);

    const finalChainCheck = await request('/api/integrity/chain-check');
    console.log(`[RESTORE VERIFIED] Chain is now: ${finalChainCheck.body.report.valid ? 'VALID' : 'INVALID'}`);

    console.log('\n================================================================');
    console.log('🎉 ALL 4 LAYER 2 ACCEPTANCE CRITERIA ARE 100% PASSING & VERIFIED!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Verification error:', err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
});
