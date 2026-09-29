const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'verifymet.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for high performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Executes the complete schema creation including Layer 1 Foundation and Schema Deltas
 */
function initSchema() {
  const schemaSql = `
    -- 1. Organizations & Jurisdictions
    CREATE TABLE IF NOT EXISTS jurisdictions (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      district TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'COMMERCIAL', 'GATC', 'DEPT'
      gst_number TEXT,
      pan_number TEXT,
      address TEXT,
      district TEXT,
      state TEXT
    );

    -- 2. Users (Stakeholders: Merchants, LMOs, GATCs, Admins)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL, -- 'MERCHANT', 'LMO', 'GATC', 'ADMIN'
      organization_id TEXT REFERENCES organizations(id),
      jurisdiction_id TEXT REFERENCES jurisdictions(id),
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Instruments (with Layer 1 Schema Delta: nameplate photo + match status)
    CREATE TABLE IF NOT EXISTS instruments (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id),
      category TEXT NOT NULL, -- 'ELECTRONIC_WEIGHING', 'BEAM_SCALE', 'PLATFORM_SCALE', 'FUEL_DISPENSER', 'CAPACITY_MEASURE'
      sub_category TEXT,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      serial_number TEXT UNIQUE NOT NULL,
      capacity TEXT NOT NULL,
      accuracy_class TEXT DEFAULT 'Class III (Medium)',
      verification_status TEXT DEFAULT 'PENDING_VERIFICATION', -- 'PENDING_VERIFICATION', 'VERIFIED', 'EXPIRED', 'REJECTED'
      premises_address TEXT NOT NULL,
      geo_lat REAL,
      geo_lng REAL,
      -- Layer 1 Delta for Physical-Digital Binding
      nameplate_photo_url TEXT,
      last_photo_match_status TEXT DEFAULT 'UNVERIFIED', -- 'MATCH', 'MISMATCH', 'UNVERIFIED', 'NEEDS_REVIEW'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Verification Applications (with Layer 1 Delta: assignment method + reason)
    CREATE TABLE IF NOT EXISTS verification_applications (
      id TEXT PRIMARY KEY,
      application_number TEXT UNIQUE NOT NULL,
      applicant_id TEXT NOT NULL REFERENCES users(id),
      instrument_id TEXT NOT NULL REFERENCES instruments(id),
      application_type TEXT NOT NULL, -- 'INITIAL', 'RE_VERIFICATION', 'AFTER_REPAIR'
      fee_amount REAL NOT NULL,
      payment_status TEXT DEFAULT 'PAID', -- 'PENDING', 'PAID', 'FAILED'
      payment_transaction_id TEXT,
      status TEXT DEFAULT 'SUBMITTED', -- 'SUBMITTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'
      assigned_officer_id TEXT REFERENCES users(id),
      -- Layer 1 Delta for Anti-Collusion Blind Assignment
      assignment_method TEXT DEFAULT 'AUTO_WEIGHTED_RANDOM', -- 'MANUAL', 'AUTO_WEIGHTED_RANDOM'
      assignment_reason TEXT,
      scheduled_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Measurement Results & Inspection (with Layer 1 Delta: Hash-Chaining & Evidence Capture)
    CREATE TABLE IF NOT EXISTS measurement_results (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES verification_applications(id),
      instrument_id TEXT NOT NULL REFERENCES instruments(id),
      officer_id TEXT NOT NULL REFERENCES users(id),
      zero_error REAL,
      repeatability_error REAL,
      eccentricity_error REAL,
      discrimination_pass INTEGER DEFAULT 1,
      overall_result TEXT NOT NULL, -- 'PASS', 'FAIL'
      observations_json TEXT,
      -- Layer 1 Delta for Evidence-Bound Testing & Cryptographic Chaining
      photo_url TEXT,
      geo_lat REAL,
      geo_lng REAL,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      record_hash TEXT, -- SHA-256 of (fields + photo_hash + prev_hash)
      prev_hash TEXT,   -- Pointer to previous record's hash
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Digital Certificates (Tamper-Resistant QR enabled)
    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      certificate_number TEXT UNIQUE NOT NULL,
      instrument_id TEXT NOT NULL REFERENCES instruments(id),
      application_id TEXT NOT NULL REFERENCES verification_applications(id),
      officer_id TEXT NOT NULL REFERENCES users(id),
      issue_date TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      qr_payload TEXT NOT NULL,
      status TEXT DEFAULT 'VALID', -- 'VALID', 'EXPIRED', 'REVOKED'
      pdf_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Notifications (with Layer 1 Delta: channel in_app / whatsapp)
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      channel TEXT DEFAULT 'in_app', -- 'in_app', 'whatsapp', 'sms'
      delivery_status TEXT DEFAULT 'DELIVERED', -- 'PENDING', 'DELIVERED', 'FAILED'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Behavioral Red-Flag Engine (Layer 1 Delta: Anti-Collusion & Anomaly Tracking)
    CREATE TABLE IF NOT EXISTS risk_flags (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL, -- 'INSPECTOR', 'OWNER', 'INSTRUMENT'
      entity_id TEXT NOT NULL,
      flag_type TEXT NOT NULL,   -- 'IMPOSSIBLE_TRAVEL', 'OVERRIDE_OUTLIER', 'REPEAT_PAIRING', 'PASS_RATE_SPIKE'
      score REAL NOT NULL,
      details TEXT NOT NULL,     -- JSON string containing evidence details
      status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'INVESTIGATING', 'RESOLVED'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Public Citizen Complaints (Layer 1 Delta: Crowdsourced Enforcement Loop)
    CREATE TABLE IF NOT EXISTS public_complaints (
      id TEXT PRIMARY KEY,
      certificate_id TEXT NOT NULL REFERENCES certificates(id),
      complainant_name TEXT,
      complainant_phone TEXT,
      description TEXT NOT NULL,
      evidence_photo_url TEXT,
      status TEXT DEFAULT 'PENDING_REVIEW', -- 'PENDING_REVIEW', 'VERIFIED_FLAGGED', 'DISMISSED'
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(schemaSql);
  console.log('✅ VerifyMET+ Layer 1 Database Schema & Deltas initialized successfully.');
}

module.exports = {
  db,
  initSchema
};
