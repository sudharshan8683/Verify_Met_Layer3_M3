import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Eye, AlertOctagon } from 'lucide-react';
import NameplateBadge from './NameplateBadge';

export default function NameplateReviewSideBySide({ 
  registeredPhotoUrl, 
  currentPhotoUrl, 
  serialNumber, 
  make, 
  model, 
  selectedStatus, 
  onChange 
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} color="#059669" />
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>
            Physical–Digital Binding (Nameplate Verification)
          </h3>
        </div>
        <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', color: '#475569', fontWeight: '600' }}>
          S/N: {serialNumber || 'N/A'}
        </span>
      </div>

      {/* Side-by-Side Comparison Container */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        {/* Left: Registered Original */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155' }}>Original Nameplate</span>
            <span style={{ fontSize: '0.65rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>Registration Base</span>
          </div>
          <div style={{ borderRadius: '6px', overflow: 'hidden' }}>
            <NameplateBadge 
              photoUrl={registeredPhotoUrl}
              make={make || 'Essae-Teraoka'}
              model={model || 'DS-215N'}
              serial={serialNumber || 'ESS-2023-98214'}
            />
          </div>
        </div>

        {/* Right: Current Live Capture */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155' }}>Current Live Inspection</span>
            <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>Live Field Photo</span>
          </div>
          <div style={{ height: '140px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currentPhotoUrl ? (
              <img 
                src={currentPhotoUrl.startsWith('http') || currentPhotoUrl.startsWith('data:') ? currentPhotoUrl : `http://localhost:5000${currentPhotoUrl}`}
                alt="Field Inspection Display" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerHTML = `<div style="text-align:center;padding:10px;color:#64748b;font-size:0.75rem;">Live scale display captured</div>`;
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '10px', color: '#94a3b8', fontSize: '0.75rem' }}>
                Capture live photo to compare with original
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Review Decision Buttons */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
          Inspector Nameplate Verification Decision:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onChange('MATCH')}
            style={{
              background: selectedStatus === 'MATCH' ? '#dcfce7' : '#f8fafc',
              border: `2px solid ${selectedStatus === 'MATCH' ? '#16a34a' : '#cbd5e1'}`,
              color: selectedStatus === 'MATCH' ? '#15803d' : '#475569',
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <CheckCircle2 size={14} /> MATCH
          </button>

          <button
            type="button"
            onClick={() => onChange('MISMATCH')}
            style={{
              background: selectedStatus === 'MISMATCH' ? '#fee2e2' : '#f8fafc',
              border: `2px solid ${selectedStatus === 'MISMATCH' ? '#dc2626' : '#cbd5e1'}`,
              color: selectedStatus === 'MISMATCH' ? '#991b1b' : '#475569',
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <XCircle size={14} /> MISMATCH
          </button>

          <button
            type="button"
            onClick={() => onChange('NEEDS_REVIEW')}
            style={{
              background: selectedStatus === 'NEEDS_REVIEW' ? '#fef3c7' : '#f8fafc',
              border: `2px solid ${selectedStatus === 'NEEDS_REVIEW' ? '#d97706' : '#cbd5e1'}`,
              color: selectedStatus === 'NEEDS_REVIEW' ? '#92400e' : '#475569',
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <AlertTriangle size={14} /> UNCLEAR
          </button>
        </div>
      </div>

      {/* Visible Warning Alert for Mismatch or Unclear */}
      {selectedStatus === 'MISMATCH' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <AlertOctagon size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>
            <strong>TAMPERING DETECTED:</strong> Physical instrument serial number or metallic plate does NOT match database record. Application will be flagged for investigation.
          </div>
        </div>
      )}

      {selectedStatus === 'NEEDS_REVIEW' && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.75rem', color: '#92400e' }}>
            <strong>WARNING:</strong> Nameplate is worn out, illegible, or damaged. Officer must re-examine metallic stamping before issuing certificate.
          </div>
        </div>
      )}
    </div>
  );
}
