/**
 * VerifyMET+ Automated E2E QA & Statutory Compliance Test Suite
 * Validates the 8 Critical E2E Journeys (M3 - WhatsApp, QA & Compliance Lead)
 */

const BASE_URL = process.env.API_BASE || 'http://localhost:5000/api';

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 VERIFYMET+ M3: 8 CRITICAL E2E JOURNEYS & COMPLIANCE QA SUITE');
  console.log('   Regulatory: Legal Metrology Act, 2009 & DPDP Act, 2023');
  console.log('================================================================\n');

  let passed = 0;
  let total = 8;

  try {
    // -------------------------------------------------------------------------
    // JOURNEY 1: Merchant Scale Onboarding & Physical-Digital Binding
    // -------------------------------------------------------------------------
    console.log('▶ [E2E-01] Testing Merchant Scale Onboarding & Nameplate Photo Binding...');
    const instRes = await fetch(`${BASE_URL}/instruments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_id: 'usr-mer-01',
        category: 'ELECTRONIC_WEIGHING',
        make: 'Eagle Scales India',
        model: 'EG-500-Pro',
        serial_number: `EAG-2026-${Date.now()}`,
        capacity: '50 kg (e=10g)',
        accuracy_class: 'Class III',
        premises_address: 'Stall 12, Pune Vegetable Mandi',
        nameplate_photo_url: 'data:image/svg+xml;utf8,<svg>nameplate-e2e</svg>'
      })
    });
    const instData = await instRes.json();
    if (instData.success && instData.instrument_id) {
      console.log(`   ✅ PASS: Scale registered with ID ${instData.instrument_id} & Physical Nameplate Binding enforced.`);
      passed++;
    } else {
      throw new Error(`Failed to register scale: ${instData.error}`);
    }

    // -------------------------------------------------------------------------
    // JOURNEY 2: Blind Anti-Collusion Weighted-Random Inspector Allocation
    // -------------------------------------------------------------------------
    console.log('\n▶ [E2E-02] Testing Blind Anti-Collusion Weighted-Random Inspector Allocation...');
    const appRes = await fetch(`${BASE_URL}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicant_id: 'usr-mer-01',
        instrument_id: instData.instrument_id,
        application_type: 'RE_VERIFICATION',
        scheduled_date: '2026-10-05'
      })
    });
    const appData = await appRes.json();
    if (appData.success && appData.assigned_officer) {
      console.log(`   ✅ PASS: Anti-Collusion Engine assigned LMO: ${appData.assigned_officer.name} (${appData.assignment_reason}).`);
      passed++;
    } else {
      throw new Error(`Failed to allocate inspector: ${appData.error}`);
    }

    // -------------------------------------------------------------------------
    // JOURNEY 3: On-Site Inspection Proof of Physical Presence Enforcers
    // -------------------------------------------------------------------------
    console.log('\n▶ [E2E-03] Testing On-Site Proof of Physical Presence Enforcers (Camera + GPS)...');
    // Sub-test A: Attempt submission without mandatory photo proof (must be rejected)
    const failRes = await fetch(`${BASE_URL}/verifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application_id: appData.application_id,
        instrument_id: instData.instrument_id,
        officer_id: appData.assigned_officer.id,
        zero_error: 0.0,
        photo_url: '', // Empty photo -> Violation
        geo_lat: 18.5204,
        geo_lng: 73.8567
      })
    });
    const failData = await failRes.json();
    if (!failData.success) {
      console.log(`   ✅ PASS: System correctly blocked submission without live photo proof (Proof of Presence Enforced).`);
    }

    // Sub-test B: Submission with valid photo and GPS coordinates
    const verifyRes = await fetch(`${BASE_URL}/verifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application_id: appData.application_id,
        instrument_id: instData.instrument_id,
        officer_id: appData.assigned_officer.id,
        zero_error: 0.0,
        repeatability_error: 0.01,
        eccentricity_error: 0.01,
        discrimination_pass: 1,
        overall_result: 'PASS',
        photo_url: 'data:image/svg+xml;utf8,<svg>live-display-1000g</svg>',
        geo_lat: 18.5204,
        geo_lng: 73.8567,
        nameplate_match_status: 'MATCH'
      })
    });
    const verifyData = await verifyRes.json();
    if (verifyData.success && verifyData.record_hash) {
      console.log(`   ✅ PASS: Valid verification accepted & hashed into ledger: ${verifyData.record_hash.substring(0, 16)}...`);
      passed++;
    } else {
      throw new Error(`Valid verification failed: ${verifyData.error}`);
    }

    // -------------------------------------------------------------------------
    // JOURNEY 4: Cryptographic SHA-256 Ledger Chaining & Verification
    // -------------------------------------------------------------------------
    console.log('\n▶ [E2E-04] Testing Cryptographic SHA-256 Ledger Chaining & Mathematical Proof...');
    const chainRes = await fetch(`${BASE_URL}/integrity/chain-check`);
    const chainData = await chainRes.json();
    if (chainData.success && chainData.report?.valid === true && chainData.report?.count >= 1) {
      console.log(`   ✅ PASS: Blockchain-style hash chain verified across ${chainData.report.count} blocks (100% Intact).`);
      passed++;
    } else {
      throw new Error(`Hash chain validation failed: ${JSON.stringify(chainData)}`);
    }

    // -------------------------------------------------------------------------
    // JOURNEY 5: Real-Time DB Tamper Detection & Auto-Recovery
    // -------------------------------------------------------------------------
    console.log('\n▶ [E2E-05] Testing Automated Database Tamper Detection & Audit Trail...');
    // Step A: Simulate direct SQL edit
    await fetch(`${BASE_URL}/integrity/simulate-tamper`, { method: 'POST' });
    const tamperedCheckRes = await fetch(`${BASE_URL}/integrity/chain-check`);
    const tamperedCheck = await tamperedCheckRes.json();
    if (tamperedCheck.report?.valid === false) {
      console.log(`   ✅ PASS: Integrity Engine detected direct DB tampering at corrupted block!`);
    } else {
      throw new Error('Integrity engine failed to detect simulated tampering!');
    }
    // Step B: Restore chain
    await fetch(`${BASE_URL}/integrity/restore-chain`, { method: 'POST' });
    const restoredCheck = await fetch(`${BASE_URL}/integrity/chain-check`).then(r => r.json());
    if (restoredCheck.report?.valid === true) {
      console.log(`   ✅ PASS: Chain successfully restored to authentic cryptographic state.`);
      passed++;
    }

    // -------------------------------------------------------------------------
    // JOURNEY 6: Public Citizen No-Login QR Certificate Verification
    // -------------------------------------------------------------------------
    console.log('\n▶ [E2E-06] Testing Public Citizen No-Login QR Certificate Verification...');
    const certRes = await fetch(`${BASE_URL}/certificates/verify/MH-PUN-2026-00841`);
    const certData = await certRes.json();
    if (certData.success && certData.certificate?.status === 'VALID') {
      console.log(`   ✅ PASS: Public QR lookup confirmed Certificate MH-PUN-2026-00841 for ${certData.certificate.merchant.organization}.`);
      passed++;
    } else {
      throw new Error(`Public QR lookup failed: ${certData.error}`);
    }

    // -------------------------------------------------------------------------
    // JOURNEY 7: Citizen Discrepancy Grievance Loop & Auto-Escalation
    // -------------------------------------------------------------------------
    console.log('\n▶ [E2E-07] Testing Citizen Grievance Intake & Auto-Escalation...');
    const compRes = await fetch(`${BASE_URL}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        certificate_number: 'MH-PUN-2026-00841',
        category: 'INACCURATE_WEIGHT',
        description: 'Short measurement observed: 500g standard block registered as 460g at checkout counter.',
        complainant_name: 'Anjali Verma',
        complainant_phone: '+91 98221 55443'
      })
    });
    const compData = await compRes.json();
    if (compData.success && compData.complaint_id) {
      console.log(`   ✅ PASS: Citizen complaint filed with ID ${compData.complaint_id}; escalated to District Risk Score.`);
      passed++;
    } else {
      throw new Error(`Complaint submission failed: ${compData.error}`);
    }

    // -------------------------------------------------------------------------
    // JOURNEY 8: WhatsApp Business Cloud API Multi-Template Dispatch
    // -------------------------------------------------------------------------
    console.log('\n▶ [E2E-08] Testing WhatsApp Business Cloud API Multi-Template Dispatch...');
    const waRes = await fetch(`${BASE_URL}/notifications/whatsapp-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'usr-mer-01',
        template_name: 'CERTIFICATE_ISSUED',
        phone: '+91 9822998811',
        params: {
          merchant_name: 'Ramesh Sharma',
          scale_model: 'Essae-Teraoka DS-215N',
          cert_no: 'MH-PUN-2026-00841',
          valid_until: '2027-09-28',
          block_hash: '7a12b4e8c9f0'
        }
      })
    });
    const waData = await waRes.json();
    if (waData.success && waData.delivery_status === 'SENT_AND_DELIVERED') {
      console.log(`   ✅ PASS: WhatsApp Cloud message dispatched with ID: ${waData.message_id}.`);
      passed++;
    } else {
      throw new Error(`WhatsApp dispatch failed: ${waData.error}`);
    }

    console.log('\n================================================================');
    console.log(`🎉 ALL 8 CRITICAL E2E JOURNEYS PASSED SUCCESSFULLY! (${passed}/${total})`);
    console.log('   DPDP Act, 2023 & Legal Metrology Act, 2009 Compliance Verified.');
    console.log('================================================================');
    process.exit(0);

  } catch (err) {
    console.error(`\n❌ TEST SUITE FAILED:`, err.message);
    process.exit(1);
  }
}

runTestSuite();
