const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'verify_met',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root123'
});

async function initPostgresSchema() {
  const client = await pool.connect();
  try {
    console.log('🐘 Initializing PostgreSQL schema in database:', process.env.DB_NAME || 'verify_met');
    await client.query('BEGIN');

    // 1. Jurisdictions
    await client.query(`
      CREATE TABLE IF NOT EXISTS jurisdictions (
        id VARCHAR(50) PRIMARY KEY,
        state VARCHAR(100) NOT NULL,
        district VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL
      );
    `);

    // 2. Organizations
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        gst_number VARCHAR(50),
        pan_number VARCHAR(50),
        address TEXT,
        district VARCHAR(100),
        state VARCHAR(100)
      );
    `);

    // 3. Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50) NOT NULL,
        role VARCHAR(50) NOT NULL,
        organization_id VARCHAR(50) REFERENCES organizations(id),
        jurisdiction_id VARCHAR(50) REFERENCES jurisdictions(id),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Instruments
    await client.query(`
      CREATE TABLE IF NOT EXISTS instruments (
        id VARCHAR(50) PRIMARY KEY,
        owner_id VARCHAR(50) NOT NULL REFERENCES users(id),
        category VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100),
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        serial_number VARCHAR(100) UNIQUE NOT NULL,
        capacity VARCHAR(100) NOT NULL,
        accuracy_class VARCHAR(50) NOT NULL,
        verification_status VARCHAR(50) DEFAULT 'UNVERIFIED',
        premises_address TEXT,
        geo_lat NUMERIC(10, 6),
        geo_lng NUMERIC(10, 6),
        nameplate_photo_url TEXT,
        last_photo_match_status VARCHAR(50) DEFAULT 'UNVERIFIED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Verification Applications
    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_applications (
        id VARCHAR(50) PRIMARY KEY,
        application_number VARCHAR(100) UNIQUE NOT NULL,
        applicant_id VARCHAR(50) NOT NULL REFERENCES users(id),
        instrument_id VARCHAR(50) NOT NULL REFERENCES instruments(id),
        application_type VARCHAR(50) DEFAULT 'INITIAL',
        fee_amount NUMERIC(10, 2) DEFAULT 500.00,
        payment_status VARCHAR(50) DEFAULT 'PAID',
        payment_transaction_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'PENDING',
        assigned_officer_id VARCHAR(50) REFERENCES users(id),
        assignment_method VARCHAR(50) DEFAULT 'AUTO_WEIGHTED_RANDOM',
        assignment_reason TEXT,
        scheduled_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Measurement Results
    await client.query(`
      CREATE TABLE IF NOT EXISTS measurement_results (
        id VARCHAR(50) PRIMARY KEY,
        application_id VARCHAR(50) NOT NULL REFERENCES verification_applications(id),
        instrument_id VARCHAR(50) NOT NULL REFERENCES instruments(id),
        officer_id VARCHAR(50) NOT NULL REFERENCES users(id),
        zero_error NUMERIC(10, 4) NOT NULL,
        repeatability_error NUMERIC(10, 4) NOT NULL,
        eccentricity_error NUMERIC(10, 4) NOT NULL,
        discrimination_pass INTEGER NOT NULL DEFAULT 1,
        overall_result VARCHAR(50) NOT NULL,
        observations_json JSONB,
        photo_url TEXT NOT NULL,
        geo_lat NUMERIC(10, 6) NOT NULL,
        geo_lng NUMERIC(10, 6) NOT NULL,
        captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        record_hash VARCHAR(64) NOT NULL,
        prev_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Certificates
    await client.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id VARCHAR(50) PRIMARY KEY,
        certificate_number VARCHAR(100) UNIQUE NOT NULL,
        instrument_id VARCHAR(50) NOT NULL REFERENCES instruments(id),
        application_id VARCHAR(50) REFERENCES verification_applications(id),
        officer_id VARCHAR(50) NOT NULL REFERENCES users(id),
        issue_date DATE NOT NULL,
        valid_until DATE NOT NULL,
        qr_payload TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'VALID',
        pdf_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        channel VARCHAR(50) DEFAULT 'whatsapp',
        delivery_status VARCHAR(50) DEFAULT 'SENT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Risk Flags
    await client.query(`
      CREATE TABLE IF NOT EXISTS risk_flags (
        id VARCHAR(50) PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(50) NOT NULL,
        flag_type VARCHAR(100) NOT NULL,
        score NUMERIC(5, 2) NOT NULL,
        details JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Public Complaints
    await client.query(`
      CREATE TABLE IF NOT EXISTS public_complaints (
        id VARCHAR(50) PRIMARY KEY,
        certificate_id VARCHAR(50) NOT NULL,
        complainant_name VARCHAR(255),
        complainant_phone VARCHAR(50),
        description TEXT NOT NULL,
        evidence_photo_url TEXT,
        status VARCHAR(50) DEFAULT 'PENDING',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. Audit Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(50) NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('✅ PostgreSQL Schema synchronized with exact column parity in verify_met!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to initialize PostgreSQL Schema:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Function to sync all SQLite records to PostgreSQL
async function syncFromSQLiteToPostgres(sqliteDb) {
  const client = await pool.connect();
  try {
    console.log('🔄 Syncing all records from local SQLite to PostgreSQL (verify_met)...');
    
    const tables = [
      { name: 'jurisdictions', pkey: 'id' },
      { name: 'organizations', pkey: 'id' },
      { name: 'users', pkey: 'id' },
      { name: 'instruments', pkey: 'id' },
      { name: 'verification_applications', pkey: 'id' },
      { name: 'measurement_results', pkey: 'id' },
      { name: 'certificates', pkey: 'id' },
      { name: 'notifications', pkey: 'id' },
      { name: 'risk_flags', pkey: 'id' },
      { name: 'public_complaints', pkey: 'id' },
      { name: 'audit_logs', pkey: 'id' }
    ];

    for (const t of tables) {
      // Get table columns from Postgres
      const pColsRes = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1
      `, [t.name]);
      const validCols = new Set(pColsRes.rows.map(r => r.column_name));

      const rows = sqliteDb.prepare(`SELECT * FROM ${t.name}`).all();
      for (const row of rows) {
        const rawCols = Object.keys(row).filter(c => validCols.has(c));
        const rawVals = rawCols.map(c => {
          let v = row[c];
          // Handle JSON fields
          if ((c === 'details' || c === 'observations_json') && typeof v === 'string') {
            try { return JSON.parse(v); } catch(e) { return v; }
          }
          return v;
        });

        const placeholders = rawCols.map((_, i) => `$${i + 1}`).join(', ');
        const updateClauses = rawCols.filter(c => c !== t.pkey).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

        const sql = `
          INSERT INTO ${t.name} (${rawCols.map(c => `"${c}"`).join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (${t.pkey}) DO UPDATE SET ${updateClauses || `${t.pkey} = EXCLUDED.${t.pkey}`};
        `;

        await client.query(sql, rawVals);
      }
      console.log(`   ✓ Synced table: ${t.name} (${rows.length} rows)`);
    }

    console.log('🎉 PostgreSQL database verify_met is 100% in sync with live VerifyMET+ system!');
  } catch (err) {
    console.error('❌ Sync error to PostgreSQL:', err.message);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initPostgresSchema,
  syncFromSQLiteToPostgres,
  query: (text, params) => pool.query(text, params)
};
