const { db } = require('../config/database');

/**
 * Default configurable thresholds for the Red-Flag Anomaly Engine
 */
const DEFAULT_CONFIG = {
  // Rule 1: Override Outliers
  overrideRateThresholdPct: 20.0,     // Inspector override rate > 20%
  overridePeerMultiplier: 2.5,        // Or 2.5x the peer average
  // Rule 2: Impossible Travel
  maxFeasibleSpeedKmH: 90.0,          // Speeds above 90 km/h in urban zone are flagged
  minTravelDistanceKm: 5.0,           // Only evaluate if distance is >= 5 km
  maxTravelTimeMinutes: 20.0,         // Evaluated within 20 min window
  // Rule 3: Repeat Pairing
  repeatPairingThreshold: 3,          // More than 2 repeated pairings between same owner & inspector
  // Rule 4: Sudden Pass Rate Jump
  passRateJumpThresholdPct: 30.0,     // > 30% increase between baseline and recent window
  minInspectionsForJump: 4            // Minimum tests needed to evaluate jump
};

/**
 * Haversine formula to compute great-circle distance between two GPS coordinates in kilometers
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Rule 1: Override-rate Outlier Detection
 * Flags inspectors who manually override failed measurements to PASS significantly higher than peers
 */
function checkOverrideRateOutliers(config = DEFAULT_CONFIG) {
  const flags = [];

  const inspectors = db.prepare(`
    SELECT u.id, u.name, u.email,
      COUNT(mr.id) as total_tests,
      SUM(CASE WHEN mr.overall_result = 'PASS' AND (
        mr.zero_error > 0.05 OR mr.repeatability_error > 0.05 OR mr.eccentricity_error > 0.05 OR
        mr.observations_json LIKE '%override%' OR mr.observations_json LIKE '%lenient%'
      ) THEN 1 ELSE 0 END) as overrides
    FROM users u
    JOIN measurement_results mr ON mr.officer_id = u.id
    WHERE u.role = 'LMO'
    GROUP BY u.id
    HAVING total_tests >= 1
  `).all();

  if (inspectors.length === 0) return flags;

  // Calculate peer average override percentage
  const totalPeerTests = inspectors.reduce((sum, i) => sum + i.total_tests, 0);
  const totalPeerOverrides = inspectors.reduce((sum, i) => sum + i.overrides, 0);
  const peerAvgPct = totalPeerTests > 0 ? (totalPeerOverrides / totalPeerTests) * 100 : 0;

  for (const insp of inspectors) {
    const overridePct = (insp.overrides / insp.total_tests) * 100;
    const isOutlier = overridePct >= config.overrideRateThresholdPct || 
      (peerAvgPct > 0 && overridePct >= peerAvgPct * config.overridePeerMultiplier);

    if (isOutlier && insp.overrides > 0) {
      const score = Math.min(95, Math.max(65, Math.round(overridePct * 0.9)));
      flags.push({
        id: `flag-override-${insp.id}-${Date.now()}`,
        entity_type: 'INSPECTOR',
        entity_id: insp.id,
        flag_type: 'OVERRIDE_OUTLIER',
        score: score,
        details: JSON.stringify({
          officer_name: insp.name,
          overrides: insp.overrides,
          total_inspections: insp.total_tests,
          override_rate_pct: parseFloat(overridePct.toFixed(1)),
          peer_average_pct: parseFloat(peerAvgPct.toFixed(1)),
          reason: `Inspector manually overrode calculated test results in ${insp.overrides}/${insp.total_tests} inspections (${overridePct.toFixed(1)}% vs department peer average of ${peerAvgPct.toFixed(1)}%).`,
          suspected: 'Bribery / unauthorized pass overrides'
        })
      });
    }
  }

  return flags;
}

/**
 * Rule 2: Impossible Travel Detection
 * Flags consecutive inspections by the same inspector where geographic distance vs elapsed time is physically implausible
 */
function checkImpossibleTravel(config = DEFAULT_CONFIG) {
  const flags = [];

  const inspectors = db.prepare(`SELECT DISTINCT id, name FROM users WHERE role = 'LMO'`).all();

  for (const insp of inspectors) {
    const tests = db.prepare(`
      SELECT mr.id, mr.geo_lat, mr.geo_lng, mr.captured_at, mr.instrument_id, i.premises_address
      FROM measurement_results mr
      JOIN instruments i ON mr.instrument_id = i.id
      WHERE mr.officer_id = ? AND mr.geo_lat IS NOT NULL AND mr.geo_lng IS NOT NULL
      ORDER BY mr.captured_at ASC
    `).all(insp.id);

    if (tests.length < 2) continue;

    for (let i = 0; i < tests.length - 1; i++) {
      const t1 = tests[i];
      const t2 = tests[i + 1];

      const d1 = new Date(t1.captured_at).getTime();
      const d2 = new Date(t2.captured_at).getTime();
      const diffMinutes = Math.abs(d2 - d1) / (1000 * 60);

      const distanceKm = calculateDistanceKm(t1.geo_lat, t1.geo_lng, t2.geo_lat, t2.geo_lng);

      if (diffMinutes <= config.maxTravelTimeMinutes && distanceKm >= config.minTravelDistanceKm) {
        const speedKmH = (distanceKm / (diffMinutes / 60));

        if (speedKmH > config.maxFeasibleSpeedKmH || diffMinutes <= 1) {
          const score = Math.min(99, Math.max(75, Math.round(75 + (speedKmH / 10))));
          flags.push({
            id: `flag-travel-${insp.id}-${t1.id}-${Date.now()}`,
            entity_type: 'INSPECTOR',
            entity_id: insp.id,
            flag_type: 'IMPOSSIBLE_TRAVEL',
            score: score,
            details: JSON.stringify({
              officer_name: insp.name,
              location_1: `${t1.geo_lat}, ${t1.geo_lng} (${t1.premises_address || 'Premises 1'})`,
              location_2: `${t2.geo_lat}, ${t2.geo_lng} (${t2.premises_address || 'Premises 2'})`,
              distance_km: parseFloat(distanceKm.toFixed(1)),
              elapsed_minutes: parseFloat(diffMinutes.toFixed(1)),
              calculated_speed_kmh: parseFloat(speedKmH.toFixed(1)),
              reason: `Consecutive inspections conducted ${distanceKm.toFixed(1)} km apart in ${diffMinutes.toFixed(1)} minutes (implied speed ${speedKmH.toFixed(0)} km/h exceeds physical threshold of ${config.maxFeasibleSpeedKmH} km/h).`,
              suspected: 'Desk-certification / ghost inspection'
            })
          });
        }
      }
    }
  }

  return flags;
}

/**
 * Rule 3: Repeat Owner-Inspector Pairing Detection
 * Flags repeated assignments between the same merchant and inspector exceeding threshold
 */
function checkRepeatPairings(config = DEFAULT_CONFIG) {
  const flags = [];

  const pairings = db.prepare(`
    SELECT va.assigned_officer_id, i.owner_id, 
      COUNT(va.id) as pair_count,
      u_off.name as officer_name,
      u_own.name as owner_name,
      o.name as org_name
    FROM verification_applications va
    JOIN instruments i ON va.instrument_id = i.id
    JOIN users u_off ON va.assigned_officer_id = u_off.id
    JOIN users u_own ON i.owner_id = u_own.id
    LEFT JOIN organizations o ON u_own.organization_id = o.id
    WHERE va.assigned_officer_id IS NOT NULL
    GROUP BY va.assigned_officer_id, i.owner_id
    HAVING pair_count >= ?
  `).all(config.repeatPairingThreshold);

  for (const pair of pairings) {
    const score = Math.min(90, 50 + (pair.pair_count * 10));
    flags.push({
      id: `flag-pairing-${pair.assigned_officer_id}-${pair.owner_id}-${Date.now()}`,
      entity_type: 'INSPECTOR',
      entity_id: pair.assigned_officer_id,
      flag_type: 'REPEAT_PAIRING',
      score: score,
      details: JSON.stringify({
        officer_name: pair.officer_name,
        merchant_name: pair.owner_name,
        organization: pair.org_name,
        repeat_count: pair.pair_count,
        threshold: config.repeatPairingThreshold,
        reason: `Officer ${pair.officer_name} and merchant ${pair.owner_name} have been paired ${pair.pair_count} times, exceeding anti-collusion rotation threshold.`,
        suspected: 'Collusion / systematic merchant-officer favoritism'
      })
    });
  }

  return flags;
}

/**
 * Rule 4: Sudden Pass-Rate Jump Detection
 * Compares an inspector's historical baseline pass rate to recent pass rate
 */
function checkSuddenPassRateJump(config = DEFAULT_CONFIG) {
  const flags = [];

  const inspectors = db.prepare(`SELECT DISTINCT id, name FROM users WHERE role = 'LMO'`).all();

  for (const insp of inspectors) {
    const tests = db.prepare(`
      SELECT overall_result, captured_at
      FROM measurement_results
      WHERE officer_id = ?
      ORDER BY captured_at ASC
    `).all(insp.id);

    if (tests.length < config.minInspectionsForJump) continue;

    const mid = Math.floor(tests.length / 2);
    const baselineTests = tests.slice(0, mid);
    const recentTests = tests.slice(mid);

    const baselinePasses = baselineTests.filter(t => t.overall_result === 'PASS').length;
    const baselinePassRate = (baselinePasses / baselineTests.length) * 100;

    const recentPasses = recentTests.filter(t => t.overall_result === 'PASS').length;
    const recentPassRate = (recentPasses / recentTests.length) * 100;

    const jumpPct = recentPassRate - baselinePassRate;

    if (jumpPct >= config.passRateJumpThresholdPct && baselinePassRate < 80) {
      const score = Math.min(88, 60 + Math.round(jumpPct * 0.5));
      flags.push({
        id: `flag-jump-${insp.id}-${Date.now()}`,
        entity_type: 'INSPECTOR',
        entity_id: insp.id,
        flag_type: 'PASS_RATE_SPIKE',
        score: score,
        details: JSON.stringify({
          officer_name: insp.name,
          baseline_pass_rate_pct: parseFloat(baselinePassRate.toFixed(1)),
          recent_pass_rate_pct: parseFloat(recentPassRate.toFixed(1)),
          jump_pct: parseFloat(jumpPct.toFixed(1)),
          threshold_pct: config.passRateJumpThresholdPct,
          reason: `Inspector pass rate abruptly increased from ${baselinePassRate.toFixed(1)}% to ${recentPassRate.toFixed(1)}% (+${jumpPct.toFixed(1)}% spike).`,
          suspected: 'Lax inspection standards / sudden non-enforcement'
        })
      });
    }
  }

  return flags;
}

/**
 * Combined function to execute all anomaly rules and write to risk_flags table.
 * Callable on demand, from backend triggers, or scheduled jobs.
 */
function runRedFlagEngine(customConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  const overrideFlags = checkOverrideRateOutliers(config);
  const travelFlags = checkImpossibleTravel(config);
  const pairingFlags = checkRepeatPairings(config);
  const jumpFlags = checkSuddenPassRateJump(config);

  const allFlags = [...overrideFlags, ...travelFlags, ...pairingFlags, ...jumpFlags];

  // Save to database
  const insertStmt = db.prepare(`
    INSERT INTO risk_flags (id, entity_type, entity_id, flag_type, score, details, status)
    VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
  `);

  let newlyInserted = 0;
  for (const flag of allFlags) {
    // Check if an active flag of same type and entity already exists to avoid redundant duplicates
    const existing = db.prepare(`
      SELECT id FROM risk_flags 
      WHERE entity_id = ? AND flag_type = ? AND status = 'ACTIVE'
    `).get(flag.entity_id, flag.flag_type);

    if (!existing) {
      insertStmt.run(flag.id, flag.entity_type, flag.entity_id, flag.flag_type, flag.score, flag.details);
      newlyInserted++;
    }
  }

  return {
    total_anomalies_detected: allFlags.length,
    newly_inserted_flags: newlyInserted,
    breakdown: {
      override_outliers: overrideFlags.length,
      impossible_travel: travelFlags.length,
      repeat_pairings: pairingFlags.length,
      pass_rate_spikes: jumpFlags.length
    },
    flags: allFlags
  };
}

module.exports = {
  DEFAULT_CONFIG,
  calculateDistanceKm,
  checkOverrideRateOutliers,
  checkImpossibleTravel,
  checkRepeatPairings,
  checkSuddenPassRateJump,
  runRedFlagEngine
};
