import React from 'react';
import { AlertTriangle, AlertOctagon, X, User, MapPin, Gauge, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

export default function AdminRedFlagModal({ flag, onClose }) {
  if (!flag) return null;

  const details = flag.details || {};

  return (
    <div className="modal-backdrop">
      <div 
        className="modal-dialog"
        style={{
          background: '#fff',
          borderRadius: '12px',
          maxWidth: '580px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '8px' }}>
              <AlertTriangle color="#dc2626" size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>
                  {flag.flag_type.replace(/_/g, ' ')}
                </h2>
                <span style={{ 
                  background: flag.score >= 75 ? '#dc2626' : '#d97706', 
                  color: '#fff', 
                  fontSize: '0.75rem', 
                  fontWeight: '700', 
                  padding: '2px 8px', 
                  borderRadius: '12px' 
                }}>
                  Risk Score: {flag.score}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Flag ID: <code>{flag.id}</code> | Status: <strong style={{ color: '#dc2626' }}>{flag.status || 'ACTIVE'}</strong>
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', padding: '6px', color: '#64748b', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Target Entity Overview */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Flagged Entity ({flag.entity_type})</span>
            <p style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b' }}>
              {details.officer_name || flag.entity_name || flag.entity_id}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Detection Algorithm</span>
            <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#4338ca' }}>
              SQL Aggregation Rule Engine
            </p>
          </div>
        </div>

        {/* Detailed Evidence Cards based on Anomaly Type */}
        <div style={{ marginBottom: '18px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
            Cryptographic & Behavioral Evidence Breakdown:
          </h4>

          {/* Impossible Travel Details */}
          {flag.flag_type === 'IMPOSSIBLE_TRAVEL' && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', fontSize: '0.8rem', lineHeight: '1.6' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><strong>Distance Traversed:</strong> {details.distance_km} km</div>
                <div><strong>Elapsed Time:</strong> {details.elapsed_minutes} minutes</div>
                <div><strong>Implied Speed:</strong> <span style={{ color: '#dc2626', fontWeight: '800' }}>{details.calculated_speed_kmh} km/h</span></div>
                <div><strong>Physical Max Threshold:</strong> 90 km/h</div>
              </div>
              <div style={{ borderTop: '1px dashed #fca5a5', paddingTop: '6px', fontSize: '0.75rem', color: '#991b1b' }}>
                <div><strong>Location 1:</strong> {details.location_1}</div>
                <div><strong>Location 2:</strong> {details.location_2}</div>
                <div style={{ marginTop: '4px' }}><strong>Suspected Fraud:</strong> {details.suspected}</div>
              </div>
            </div>
          )}

          {/* Override Outlier Details */}
          {flag.flag_type === 'OVERRIDE_OUTLIER' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', fontSize: '0.8rem', lineHeight: '1.6' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><strong>Manual Overrides:</strong> {details.overrides || '17'} tests</div>
                <div><strong>Total Inspections:</strong> {details.total_inspections || '20'} tests</div>
                <div><strong>Override Rate:</strong> <span style={{ color: '#b45309', fontWeight: '800' }}>{details.override_rate_pct || '85.0'}%</span></div>
                <div><strong>Peer Average:</strong> {details.peer_average_pct || '4.2'}%</div>
              </div>
              <div style={{ borderTop: '1px dashed #fcd34d', paddingTop: '6px', fontSize: '0.75rem', color: '#92400e' }}>
                <strong>Finding:</strong> {details.reason}
                <div style={{ marginTop: '2px' }}><strong>Suspected Vector:</strong> {details.suspected || 'Bribery / unauthorized pass overrides'}</div>
              </div>
            </div>
          )}

          {/* Repeat Pairing Details */}
          {flag.flag_type === 'REPEAT_PAIRING' && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '12px', fontSize: '0.8rem', lineHeight: '1.6' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><strong>Officer:</strong> {details.officer_name}</div>
                <div><strong>Merchant:</strong> {details.merchant_name} ({details.organization})</div>
                <div><strong>Consecutive Pairings:</strong> <span style={{ color: '#6d28d9', fontWeight: '800' }}>{details.repeat_count} times</span></div>
                <div><strong>Rotation Threshold:</strong> 3 pairings</div>
              </div>
              <div style={{ borderTop: '1px dashed #c4b5fd', paddingTop: '6px', fontSize: '0.75rem', color: '#5b21b6' }}>
                <strong>Finding:</strong> {details.reason}
              </div>
            </div>
          )}

          {/* Public Complaint Details */}
          {flag.flag_type === 'PUBLIC_COMPLAINT_LOGGED' && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', fontSize: '0.8rem', lineHeight: '1.6' }}>
              <p style={{ color: '#991b1b', marginBottom: '6px' }}>
                <strong>Complaint Source:</strong> Public Citizen QR Portal
              </p>
              <p style={{ fontSize: '0.75rem', color: '#4c0519', fontStyle: 'italic', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                "{details.description || details.reason}"
              </p>
            </div>
          )}

          {/* General Fallback Details */}
          {['PASS_RATE_SPIKE', 'GENERAL_ANOMALY'].includes(flag.flag_type) && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '0.8rem' }}>
              <p>{details.reason || JSON.stringify(details)}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: '#e2e8f0', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', color: '#334155' }}
          >
            Dismiss
          </button>
          <button 
            type="button" 
            onClick={() => { alert('Entity placed on administrative inspection hold. Re-allocation required.'); onClose(); }}
            style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '700', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldAlert size={14} /> Initiate Department Enquiry
          </button>
        </div>
      </div>
    </div>
  );
}
