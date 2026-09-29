const crypto = require('node:crypto');
const { db, initSchema } = require('../config/database');
const { initLayer3Schema } = require('../config/layer3Schema');
const { issueSticker } = require('../services/stickerService');

function runSeeds() {
  initSchema();
  initLayer3Schema();

  console.log('🌱 Seeding VerifyMET+ Layer 1 Foundation Data...');

  // Clear existing data for clean idempotent run
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM public_complaints;
    DELETE FROM risk_flags;
    DELETE FROM nameplate_comparisons;
    DELETE FROM qr_stickers;
    DELETE FROM notifications;
    DELETE FROM certificates;
    DELETE FROM measurement_results;
    DELETE FROM verification_applications;
    DELETE FROM instruments;
    DELETE FROM users;
    DELETE FROM organizations;
    DELETE FROM jurisdictions;
  `);

  // 1. Jurisdictions
  const jurPuneStmt = db.prepare(`
    INSERT INTO jurisdictions (id, state, district, code)
    VALUES (?, ?, ?, ?)
  `);
  jurPuneStmt.run('jur-pune-01', 'Maharashtra', 'Pune Urban', 'MH-PUN-01');
  jurPuneStmt.run('jur-pune-02', 'Maharashtra', 'Pune Pimpri-Chinchwad', 'MH-PUN-02');

  // 2. Organizations
  const orgStmt = db.prepare(`
    INSERT INTO organizations (id, name, type, gst_number, address, district, state)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  orgStmt.run('org-dept-pune', 'Department of Legal Metrology, Pune Zone', 'DEPT', null, 'Administrative Building, Pune', 'Pune Urban', 'Maharashtra');
  orgStmt.run('org-gatc-01', 'Maharashtra Metrology Testing Centre (GATC)', 'GATC', '27AAACG0000A1Z5', 'Bhosari MIDC, Pune', 'Pune Pimpri-Chinchwad', 'Maharashtra');
  orgStmt.run('org-sharma-retail', 'Sharma Provisions & Retail Pvt Ltd', 'COMMERCIAL', '27AABCS1429B1Z2', '104, Laxmi Road, Pune', 'Pune Urban', 'Maharashtra');
  orgStmt.run('org-mahalaxmi', 'MahaLaxmi Daily Supermarket', 'COMMERCIAL', '27AABCM8821C1Z4', 'Sector 24, Pradhikaran, Nigdi', 'Pune Pimpri-Chinchwad', 'Maharashtra');

  // 3. Users (4 Inspectors: 2 clean, 2 seeded with behavioral anomalies)
  const userStmt = db.prepare(`
    INSERT INTO users (id, name, email, phone, role, organization_id, jurisdiction_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Admin
  userStmt.run('usr-admin-01', 'Controller Amit Joshi', 'admin@metrology.gov.in', '+919822011223', 'ADMIN', 'org-dept-pune', 'jur-pune-01', 'ACTIVE');

  // 2 Clean Inspectors
  userStmt.run('usr-lmo-01', 'Rajesh Kumar (LMO-Pune Central)', 'rajesh.lmo@gov.in', '+919822123401', 'LMO', 'org-dept-pune', 'jur-pune-01', 'ACTIVE');
  userStmt.run('usr-lmo-02', 'Pooja Sharma (LMO-Pune North)', 'pooja.lmo@gov.in', '+919822123402', 'LMO', 'org-dept-pune', 'jur-pune-01', 'ACTIVE');

  // 2 Flagged Inspectors (Seeded with Anomaly Histories for Red-Flag Demo)
  userStmt.run('usr-lmo-03', 'Vikram Patil (LMO-Hadapsar)', 'vikram.lmo@gov.in', '+919822123403', 'LMO', 'org-dept-pune', 'jur-pune-01', 'ACTIVE');
  userStmt.run('usr-lmo-04', 'Suresh Deshmukh (LMO-Kothrud)', 'suresh.lmo@gov.in', '+919822123404', 'LMO', 'org-dept-pune', 'jur-pune-01', 'ACTIVE');

  // Merchants (Shop Owners)
  userStmt.run('usr-mer-01', 'Ramesh Sharma (Kirana Owner)', 'ramesh.sharma@gmail.com', '+919822998811', 'MERCHANT', 'org-sharma-retail', 'jur-pune-01', 'ACTIVE');
  userStmt.run('usr-mer-02', 'Sunil Pawar (Supermarket Manager)', 'sunil.pawar@mahalaxmi.com', '+919822998822', 'MERCHANT', 'org-mahalaxmi', 'jur-pune-02', 'ACTIVE');

  // 4. Instruments (with Layer 1 Physical-Digital Binding Nameplate photos)
  const instStmt = db.prepare(`
    INSERT INTO instruments (id, owner_id, category, sub_category, make, model, serial_number, capacity, accuracy_class, verification_status, premises_address, geo_lat, geo_lng, nameplate_photo_url, last_photo_match_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  instStmt.run(
    'inst-01',
    'usr-mer-01',
    'ELECTRONIC_WEIGHING',
    'Tabletop Counter Scale',
    'Essae-Teraoka',
    'DS-215N',
    'ESS-2023-98214',
    '30 kg (e=5g)',
    'Class III',
    'VERIFIED',
    'Shop No. 4, Laxmi Road Market, Pune',
    18.5167,
    73.8562,
    '/uploads/nameplates/ESS-2023-98214_nameplate.jpg',
    'MATCH'
  );

  instStmt.run(
    'inst-02',
    'usr-mer-01',
    'PLATFORM_SCALE',
    'Heavy Goods Platform',
    'Avery India',
    'E1205',
    'AVY-2022-44120',
    '300 kg (e=50g)',
    'Class III',
    'PENDING_VERIFICATION',
    'Shop No. 4 Godown, Laxmi Road, Pune',
    18.5169,
    73.8560,
    '/uploads/nameplates/AVY-2022-44120_nameplate.jpg',
    'UNVERIFIED'
  );

  instStmt.run(
    'inst-03',
    'usr-mer-02',
    'ELECTRONIC_WEIGHING',
    'Barcode Printing Retail Scale',
    'Mettler Toledo',
    'bPlus-T2',
    'MT-2024-11098',
    '15 kg (e=2g)',
    'Class III',
    'VERIFIED',
    'Counter 2, MahaLaxmi Supermarket, Nigdi, Pune',
    18.6512,
    73.7820,
    '/uploads/nameplates/MT-2024-11098_nameplate.jpg',
    'MATCH'
  );

  // 5. Verification Applications
  const appStmt = db.prepare(`
    INSERT INTO verification_applications (id, application_number, applicant_id, instrument_id, application_type, fee_amount, payment_status, payment_transaction_id, status, assigned_officer_id, assignment_method, assignment_reason, scheduled_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  appStmt.run(
    'app-01',
    'APP-2026-MH-00101',
    'usr-mer-01',
    'inst-01',
    'RE_VERIFICATION',
    450.00,
    'PAID',
    'TXN_UPI_98210344',
    'COMPLETED',
    'usr-lmo-01',
    'AUTO_WEIGHTED_RANDOM',
    'Jurisdiction MH-PUN-01 matched, lowest workload officer selected, cool-down valid.',
    '2026-09-15'
  );

  appStmt.run(
    'app-02',
    'APP-2026-MH-00102',
    'usr-mer-01',
    'inst-02',
    'INITIAL',
    800.00,
    'PAID',
    'TXN_UPI_98210399',
    'SCHEDULED',
    'usr-lmo-02',
    'AUTO_WEIGHTED_RANDOM',
    'Blind allocation: rotated from previous officer usr-lmo-01 under anti-collusion rule.',
    '2026-09-30'
  );

  const { getLatestChainHash, computeRecordHash, hashString } = require('../services/integrityService');

  // Compute Genesis Block Hash (Block 0)
  const genesisHash = hashString('GENESIS_BLOCK_VERIFYMET_PUNE_2026');
  
  // Record 1 Hash using standardized formula
  const record1Hash = computeRecordHash({
    instrumentId: 'inst-01',
    applicationId: 'app-01',
    officerId: 'usr-lmo-01',
    overallResult: 'PASS',
    photoUrl: '/uploads/evidence/meas_inst01_display.jpg',
    geoLat: 18.5167,
    geoLng: 73.8562,
    prevHash: genesisHash
  });

  const measStmt = db.prepare(`
    INSERT INTO measurement_results (id, application_id, instrument_id, officer_id, zero_error, repeatability_error, eccentricity_error, discrimination_pass, overall_result, observations_json, photo_url, geo_lat, geo_lng, captured_at, record_hash, prev_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  measStmt.run(
    'meas-01',
    'app-01',
    'inst-01',
    'usr-lmo-01',
    0.0,
    0.02,
    0.01,
    1,
    'PASS',
    JSON.stringify({ zero_error: '0.0g', repeatability: 'within MPE 5g', eccentricity: 'within MPE 5g', stamp_impression: 'IND-MH-26' }),
    '/uploads/evidence/meas_inst01_display.jpg',
    18.5167,
    73.8562,
    '2026-09-15 11:20:30',
    record1Hash,
    genesisHash
  );

  // 7. Digital Certificate
  const certStmt = db.prepare(`
    INSERT INTO certificates (id, certificate_number, instrument_id, application_id, officer_id, issue_date, valid_until, qr_payload, status, pdf_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const qrPayload = JSON.stringify({
    cert_no: 'MH-PUN-2026-00841',
    inst_serial: 'ESS-2023-98214',
    owner: 'Sharma Provisions & Retail',
    valid_until: '2027-09-14',
    hash: record1Hash.substring(0, 16),
    verify_url: 'https://verifymet.gov.in/verify/MH-PUN-2026-00841'
  });

  certStmt.run(
    'cert-01',
    'MH-PUN-2026-00841',
    'inst-01',
    'app-01',
    'usr-lmo-01',
    '2026-09-15',
    '2027-09-14',
    qrPayload,
    'VALID',
    '/certificates/MH-PUN-2026-00841.pdf'
  );

  // 8. Notifications (with WhatsApp channel)
  const notifStmt = db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, channel, delivery_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  notifStmt.run(
    'notif-01',
    'usr-mer-01',
    'Certificate Issued',
    'Your verification certificate MH-PUN-2026-00841 for Essae-Teraoka Scale is ready. Valid until 14-Sep-2027.',
    'whatsapp',
    'DELIVERED',
    '2026-09-15 11:35:00'
  );

  notifStmt.run(
    'notif-02',
    'usr-mer-01',
    'Upcoming Inspection',
    'Inspection for Avery India Scale scheduled for 30-Sep-2026 by Officer Pooja Sharma.',
    'whatsapp',
    'DELIVERED',
    '2026-09-25 09:00:00'
  );

  // 9. Seeded Behavioral Red-Flags (Demonstrates why our Integrity Layer is unique)
  const flagStmt = db.prepare(`
    INSERT INTO risk_flags (id, entity_type, entity_id, flag_type, score, details, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Anomaly 1: Impossible Travel for Inspector Vikram Patil
  flagStmt.run(
    'flag-01',
    'INSPECTOR',
    'usr-lmo-03',
    'IMPOSSIBLE_TRAVEL',
    88.5,
    JSON.stringify({
      officer_name: 'Vikram Patil',
      reason: 'Conducted inspection at Hadapsar (18.5089, 73.9260) and subsequent inspection at Hinjewadi Phase 3 (18.5913, 73.6980) within 7 minutes. Distance 34.2 km is physically impossible.',
      timestamp_gap_minutes: 7,
      distance_km: 34.2,
      suspected: 'Ghost inspection / desk-certification'
    }),
    'ACTIVE'
  );

  // Anomaly 2: Override Outlier for Inspector Suresh Deshmukh
  flagStmt.run(
    'flag-02',
    'INSPECTOR',
    'usr-lmo-04',
    'OVERRIDE_OUTLIER',
    76.0,
    JSON.stringify({
      officer_name: 'Suresh Deshmukh',
      reason: 'Inspector manually overrode calculated Fail test results to Pass in 17 out of 20 recent inspections (85% override rate vs department average of 4.2%).',
      override_rate_pct: 85.0,
      dept_avg_pct: 4.2,
      suspected: 'Bribery / lenient unauthorized approvals'
    }),
    'ACTIVE'
  );

  // 9b. Layer 3: tamper-evident QR sticker applied to the seeded certificate
  const seededStickerId = issueSticker({ instrumentId: 'inst-01', certificateId: 'cert-01', appliedBy: 'usr-lmo-01', geoLat: 18.5167, geoLng: 73.8562 });

  // 10. Seeded Public Citizen Complaint (Crowdsourced Enforcement Loop)
  const complaintStmt = db.prepare(`
    INSERT INTO public_complaints (id, certificate_id, complainant_name, complainant_phone, description, evidence_photo_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  complaintStmt.run(
    'comp-01',
    'cert-01',
    'Anand Deshpande',
    '+919890123888',
    'Purchased 1 kg pulses; verified on home digital scale to be 910 grams. Repeated difference observed on counter scale.',
    '/uploads/evidence/complaint_counter_scale.jpg',
    'PENDING_REVIEW'
  );

  console.log('✅ Seed data created successfully:');
  console.log('   - 2 Jurisdictions & 4 Organizations');
  console.log('   - 1 Admin, 4 Inspectors (2 clean, 2 flagged with anomalies), 2 Merchants');
  console.log('   - 3 Instruments with Nameplate photos');
  console.log('   - 2 Applications (Scheduled & Completed)');
  console.log('   - 1 Hash-Chained Measurement Record with SHA-256');
  console.log('   - 1 QR-Enabled Digital Certificate + tamper-evident sticker ' + seededStickerId);
  console.log('   - 2 Behavioral Risk Flags (Impossible Travel & Override Outlier)');
  console.log('   - 1 Citizen Public Complaint on QR Certificate');
  console.log('   - 2 WhatsApp Outbound Notifications');
}

if (require.main === module) {
  runSeeds();
}

module.exports = { runSeeds };
