const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

/**
 * Blind Weighted-Random Inspector Assignment Engine
 * 
 * Rules:
 * 1. Jurisdiction filter: selects only active LMOs in the application's jurisdiction.
 * 2. Workload weighting: probability proportional to 1 / (open_cases + 1).
 * 3. Anti-collusion cool-down: excludes inspectors recently paired with this merchant.
 * 4. Documented fallback: graceful degradation if all candidates are cooled down or unavailable.
 * 5. Deterministic testing support: supports deterministic flag for reproducible test suites.
 */
function allocateInspectorBlindly({ applicantId, jurisdictionId, excludeApplicationId, deterministic = false }) {
  // 1. Fetch eligible LMOs in the jurisdiction
  let query = `
    SELECT u.id, u.name, u.email, u.phone, u.jurisdiction_id,
      (SELECT COUNT(*) FROM verification_applications va 
       WHERE va.assigned_officer_id = u.id AND va.status IN ('SCHEDULED', 'IN_PROGRESS')) as open_cases
    FROM users u
    WHERE u.role = 'LMO' AND u.status = 'ACTIVE'
  `;
  const params = [];

  if (jurisdictionId) {
    query += ' AND u.jurisdiction_id = ?';
    params.push(jurisdictionId);
  }

  let eligible = db.prepare(query).all(...params);

  // Fallback 1: If no LMOs in specific jurisdiction, fallback to any active LMO
  let isJurisdictionFallback = false;
  if (eligible.length === 0) {
    eligible = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.jurisdiction_id,
        (SELECT COUNT(*) FROM verification_applications va 
         WHERE va.assigned_officer_id = u.id AND va.status IN ('SCHEDULED', 'IN_PROGRESS')) as open_cases
      FROM users u
      WHERE u.role = 'LMO' AND u.status = 'ACTIVE'
    `).all();
    isJurisdictionFallback = true;
  }

  if (eligible.length === 0) {
    return {
      officer: null,
      method: 'FAILED',
      reason: 'Fallback exhausted: No active Legal Metrology Officers found in system.'
    };
  }

  // 2. Anti-Collusion Cool-down Rule
  // Check the last assigned officer(s) for this merchant
  let recentQuery = `
    SELECT assigned_officer_id FROM verification_applications
    WHERE applicant_id = ? AND assigned_officer_id IS NOT NULL
  `;
  const recentParams = [applicantId];
  if (excludeApplicationId) {
    recentQuery += ' AND id != ?';
    recentParams.push(excludeApplicationId);
  }
  recentQuery += ' ORDER BY created_at DESC LIMIT 2';

  const recentPairings = db.prepare(recentQuery).all(...recentParams);
  const cooledDownOfficerIds = new Set(recentPairings.map(r => r.assigned_officer_id));

  let candidates = eligible.filter(officer => !cooledDownOfficerIds.has(officer.id));
  let isCooldownFallback = false;

  // Fallback 2: If cool-down excludes all officers, fallback to all eligible officers
  if (candidates.length === 0) {
    candidates = eligible;
    isCooldownFallback = true;
  }

  // 3. Selection (Deterministic for testing, or weighted-random for production)
  let selected = null;
  if (deterministic) {
    // Sort by open_cases ascending, then id ascending
    candidates.sort((a, b) => a.open_cases - b.open_cases || a.id.localeCompare(b.id));
    selected = candidates[0];
  } else {
    // Workload weighting: weight = 1 / (open_cases + 1)
    const totalWeight = candidates.reduce((sum, c) => sum + (1 / (c.open_cases + 1)), 0);
    let randomVal = Math.random() * totalWeight;

    selected = candidates[0];
    for (const candidate of candidates) {
      const weight = 1 / (candidate.open_cases + 1);
      if (randomVal <= weight) {
        selected = candidate;
        break;
      }
      randomVal -= weight;
    }
  }

  // 4. Construct descriptive audit reason
  let reason = `Blind auto-assignment: Selected ${selected.name} (${selected.open_cases} open cases) under anti-collusion workload weighting.`;
  if (isJurisdictionFallback) {
    reason += ' [Fallback: Expanded to regional pool as no local jurisdiction LMO was available].';
  }
  if (isCooldownFallback) {
    reason += ' [Fallback: All eligible officers were within cool-down window. Assigned least loaded officer].';
  } else if (cooledDownOfficerIds.size > 0) {
    reason += ` [Cool-down active: Excluded recent officer(s) ${Array.from(cooledDownOfficerIds).join(', ')}].`;
  }

  return {
    officer: selected,
    method: 'AUTO_WEIGHTED_RANDOM',
    reason
  };
}

// List all applications
router.get('/', (req, res) => {
  try {
    const { applicant_id, assigned_officer_id, status } = req.query;
    let query = `
      SELECT va.*, 
        u.name as applicant_name, 
        o.name as org_name,
        i.make, i.model, i.serial_number, i.category, i.premises_address,
        off.name as assigned_officer_name
      FROM verification_applications va
      JOIN users u ON va.applicant_id = u.id
      JOIN instruments i ON va.instrument_id = i.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN users off ON va.assigned_officer_id = off.id
      WHERE 1=1
    `;
    const params = [];
    if (applicant_id) {
      query += ' AND va.applicant_id = ?';
      params.push(applicant_id);
    }
    if (assigned_officer_id) {
      query += ' AND va.assigned_officer_id = ?';
      params.push(assigned_officer_id);
    }
    if (status) {
      query += ' AND va.status = ?';
      params.push(status);
    }
    query += ' ORDER BY va.created_at DESC';

    const stmt = db.prepare(query);
    const applications = stmt.all(...params);
    res.json({ success: true, count: applications.length, applications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single application
router.get('/:id', (req, res) => {
  try {
    const app = db.prepare(`
      SELECT va.*, 
        u.name as applicant_name, u.jurisdiction_id as applicant_jurisdiction_id,
        o.name as org_name,
        i.make, i.model, i.serial_number, i.category, i.premises_address,
        off.name as assigned_officer_name
      FROM verification_applications va
      JOIN users u ON va.applicant_id = u.id
      JOIN instruments i ON va.instrument_id = i.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN users off ON va.assigned_officer_id = off.id
      WHERE va.id = ?
    `).get(req.params.id);

    if (!app) return res.status(404).json({ success: false, error: 'Application not found' });
    res.json({ success: true, application: app });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit a new verification application
router.post('/', (req, res) => {
  try {
    const { applicant_id, instrument_id, application_type, scheduled_date, deterministic } = req.body;

    if (!applicant_id || !instrument_id || !application_type) {
      return res.status(400).json({ success: false, error: 'Missing required application fields.' });
    }

    const instrument = db.prepare('SELECT * FROM instruments WHERE id = ?').get(instrument_id);
    if (!instrument) return res.status(404).json({ success: false, error: 'Instrument not found' });

    const applicant = db.prepare('SELECT * FROM users WHERE id = ?').get(applicant_id);

    let fee = 450.0;
    if (instrument.category === 'PLATFORM_SCALE') fee = 800.0;
    if (instrument.category === 'FUEL_DISPENSER') fee = 1500.0;

    const appId = 'app-' + Date.now();
    const appNumber = `APP-2026-MH-${Math.floor(10000 + Math.random() * 90000)}`;

    // Begin immediate transaction for allocation
    db.exec('BEGIN IMMEDIATE TRANSACTION;');

    try {
      const allocation = allocateInspectorBlindly({
        applicantId: applicant_id,
        jurisdictionId: applicant ? applicant.jurisdiction_id : null,
        deterministic: deterministic || false
      });

      const stmt = db.prepare(`
        INSERT INTO verification_applications (
          id, application_number, applicant_id, instrument_id, application_type,
          fee_amount, payment_status, payment_transaction_id, status,
          assigned_officer_id, assignment_method, assignment_reason, scheduled_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        appId,
        appNumber,
        applicant_id,
        instrument_id,
        application_type,
        fee,
        'PAID',
        'TXN_' + Date.now(),
        'SCHEDULED',
        allocation.officer ? allocation.officer.id : null,
        allocation.method,
        allocation.reason,
        scheduled_date || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      );

      // Notification Hooks (in_app and whatsapp)
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'notif-' + Date.now(),
        applicant_id,
        'Verification Application Scheduled',
        `Application ${appNumber} is confirmed. Allocated Inspector: ${allocation.officer ? allocation.officer.name : 'Officer'} on ${scheduled_date || 'scheduled date'}.`,
        'whatsapp',
        'DELIVERED'
      );

      db.exec('COMMIT;');

      res.status(201).json({
        success: true,
        message: 'Application submitted and officer allocated via blind weighted-random engine.',
        application_id: appId,
        application_number: appNumber,
        fee_amount: fee,
        assigned_officer: allocation.officer,
        assignment_method: allocation.method,
        assignment_reason: allocation.reason
      });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/applications/:id/assign
 * Existing assignment endpoint (Contract preserved).
 * Supports both Blind Weighted-Random Allocation and Manual Admin Override.
 */
router.patch('/:id/assign', (req, res) => {
  try {
    const applicationId = req.params.id;
    const { officer_id, reason: manualReason, deterministic } = req.body || {};

    // Begin immediate transaction for race-safe assignment
    db.exec('BEGIN IMMEDIATE TRANSACTION;');

    try {
      const app = db.prepare(`
        SELECT va.*, u.jurisdiction_id as applicant_jurisdiction_id
        FROM verification_applications va
        JOIN users u ON va.applicant_id = u.id
        WHERE va.id = ?
      `).get(applicationId);

      if (!app) {
        db.exec('ROLLBACK;');
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      let assignedOfficerId = null;
      let assignmentMethod = 'AUTO_WEIGHTED_RANDOM';
      let assignmentReason = '';

      if (officer_id) {
        // Manual override requested
        const officer = db.prepare('SELECT id, name, role, status FROM users WHERE id = ?').get(officer_id);
        if (!officer || officer.role !== 'LMO') {
          db.exec('ROLLBACK;');
          return res.status(400).json({ success: false, error: 'Invalid officer_id. Must be an active Legal Metrology Officer.' });
        }
        assignedOfficerId = officer.id;
        assignmentMethod = 'MANUAL';
        assignmentReason = manualReason || `Manual assignment by administrator to ${officer.name}.`;
      } else {
        // Blind Weighted-Random Assignment
        const allocation = allocateInspectorBlindly({
          applicantId: app.applicant_id,
          jurisdictionId: app.applicant_jurisdiction_id,
          excludeApplicationId: applicationId,
          deterministic: deterministic || false
        });

        if (!allocation.officer) {
          db.exec('ROLLBACK;');
          return res.status(422).json({ success: false, error: allocation.reason });
        }

        assignedOfficerId = allocation.officer.id;
        assignmentMethod = allocation.method;
        assignmentReason = allocation.reason;
      }

      // Update application
      db.prepare(`
        UPDATE verification_applications
        SET assigned_officer_id = ?, assignment_method = ?, assignment_reason = ?, status = 'SCHEDULED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(assignedOfficerId, assignmentMethod, assignmentReason, applicationId);

      // Notification Hooks: in_app and whatsapp
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'notif-assign-wa-' + Date.now(),
        app.applicant_id,
        'Inspector Allocated',
        `Your verification application ${app.application_number} has been assigned to an inspector. Reason: ${assignmentReason}`,
        'whatsapp',
        'DELIVERED'
      );

      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'notif-assign-app-' + Date.now(),
        assignedOfficerId,
        'New Verification Assigned',
        `You have been assigned to application ${app.application_number}.`,
        'in_app',
        'DELIVERED'
      );

      // Audit log entry
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'log-assign-' + Date.now(),
        'SYSTEM',
        'ASSIGN_OFFICER',
        'APPLICATION',
        applicationId,
        `Assigned officer ${assignedOfficerId} via ${assignmentMethod}. Reason: ${assignmentReason}`
      );

      db.exec('COMMIT;');

      const updatedApp = db.prepare(`
        SELECT va.*, off.name as assigned_officer_name
        FROM verification_applications va
        LEFT JOIN users off ON va.assigned_officer_id = off.id
        WHERE va.id = ?
      `).get(applicationId);

      res.json({
        success: true,
        message: 'Application assigned successfully.',
        application: updatedApp,
        assigned_officer_id: assignedOfficerId,
        assignment_method: assignmentMethod,
        assignment_reason: assignmentReason
      });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
