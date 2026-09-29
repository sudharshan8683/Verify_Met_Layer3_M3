import React, { useState } from 'react';
import { Cpu, Loader2, ShieldCheck, ShieldAlert, HelpCircle } from 'lucide-react';
import CameraCapture from './CameraCapture';
import NameplateReviewSideBySide from './NameplateReviewSideBySide';

const API_BASE = 'http://localhost:5000/api';

const STATUS_STYLE = {
  MATCH: { bg: '#dcfce7', border: '#16a34a', color: '#166534', Icon: ShieldCheck, text: 'Automatic check: nameplate MATCHES the registered plate' },
  MISMATCH: { bg: '#fee2e2', border: '#dc2626', color: '#991b1b', Icon: ShieldAlert, text: 'Automatic check: nameplate does NOT match the registered plate' },
  NEEDS_REVIEW: { bg: '#fef3c7', border: '#d97706', color: '#92400e', Icon: HelpCircle, text: 'Automatic check unsure — please decide manually below' }
};

/**
 * Layer 3 (3.2) — mandatory nameplate re-capture at every (re-)verification.
 * 1. Inspector photographs the nameplate on the instrument
 * 2. Server compares it to the registered plate (perceptual hash) — preview only
 * 3. Inspector confirms MATCH / MISMATCH / UNCLEAR (an automatic MISMATCH is final on the server)
 */
export default function NameplateAutoCheck({ instrumentId, registeredPhotoUrl, serialNumber, value, onChange }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const auto = value.autoResult;

  const handleCapture = async (dataUrl) => {
    onChange({ ...value, photoUrl: dataUrl, autoResult: null, decision: 'NEEDS_REVIEW' });
    setError('');
    if (!instrumentId) return;
    try {
      setChecking(true);
      const res = await fetch(`${API_BASE}/nameplate/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrument_id: instrumentId, candidate_photo_url: dataUrl, persist: false })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Comparison failed');
      // Pre-select the automatic result as the inspector's starting decision
      onChange({ photoUrl: dataUrl, autoResult: data, decision: data.status });
    } catch (e) {
      setError(e.message + ' — use manual review below.');
      onChange({ photoUrl: dataUrl, autoResult: null, decision: 'NEEDS_REVIEW' });
    } finally {
      setChecking(false);
    }
  };

  const st = auto ? STATUS_STYLE[auto.status] : null;

  return (
    <div>
      <CameraCapture label="Nameplate / Serial Number Photo (mandatory at every re-verification)" onCapture={handleCapture} />

      {checking && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569', margin: '8px 0' }}>
          <Loader2 size={14} className="spin" /> Comparing with registered nameplate…
        </div>
      )}

      {st && (
        <div style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color, borderRadius: '8px', padding: '8px 12px', margin: '10px 0', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <st.Icon size={16} />
          <div>
            <strong>{st.text}</strong>
            {auto.distance !== null && (
              <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>
                <Cpu size={10} style={{ verticalAlign: 'middle' }} /> pHash distance {auto.distance}/{auto.thresholds.hash_bits} · similarity {auto.similarity_pct}%
              </div>
            )}
          </div>
        </div>
      )}
      {error && <div style={{ fontSize: '0.72rem', color: '#b45309', margin: '8px 0' }}>{error}</div>}

      <NameplateReviewSideBySide
        registeredPhotoUrl={registeredPhotoUrl}
        currentPhotoUrl={value.photoUrl}
        serialNumber={serialNumber}
        selectedStatus={value.decision}
        onChange={(decision) => onChange({ ...value, decision })}
      />
      {auto && auto.status === 'MISMATCH' && value.decision !== 'MISMATCH' && (
        <div style={{ fontSize: '0.72rem', color: '#991b1b', marginTop: '-8px', marginBottom: '10px' }}>
          Note: the server keeps the automatic MISMATCH regardless of this selection (anti-collusion rule).
        </div>
      )}
    </div>
  );
}
