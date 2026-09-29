import React, { useState } from 'react';
import { ShieldCheck, Award, CheckCircle2 } from 'lucide-react';

export default function NameplateBadge({ 
  photoUrl, 
  make = 'Essae-Teraoka', 
  model = 'DS-215N', 
  serial = 'ESS-2023-98214', 
  capacity = '30 kg (e=5g)', 
  accuracyClass = 'Class III',
  approvalNo = 'IND/09/2023/412' 
}) {
  const [imgError, setImgError] = useState(false);

  // If photo is a real base64 camera capture or valid external image and hasn't errored
  const isBase64 = photoUrl && (photoUrl.startsWith('data:image/') || photoUrl.startsWith('blob:'));
  const isHttp = photoUrl && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'));

  if ((isBase64 || isHttp) && !imgError) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#0f172a' }}>
        <img 
          src={photoUrl} 
          alt={`Nameplate ${serial}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
        <div style={{
          position: 'absolute',
          bottom: '6px',
          right: '8px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          color: '#34d399',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <CheckCircle2 size={11} /> Physical Binding Active
        </div>
      </div>
    );
  }

  // Pure Vector Metallic Engraved Nameplate (Never breaks, 100% crisp)
  return (
    <div style={{
      width: '100%',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #475569',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 500 140" 
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <linearGradient id={`metal-grad-${serial}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="25%" stopColor="#e2e8f0" />
            <stop offset="60%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>

        {/* Outer Metallic Plate with Screws */}
        <rect x="2" y="2" width="496" height="136" rx="8" fill={`url(#metal-grad-${serial})`} stroke="#334155" strokeWidth="2" />
        <rect x="8" y="8" width="484" height="124" rx="6" fill="#0f172a" stroke="#64748b" strokeWidth="1" />

        {/* 4 Corner Screws */}
        <circle cx="16" cy="16" r="3.5" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
        <circle cx="484" cy="16" r="3.5" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
        <circle cx="16" cy="124" r="3.5" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
        <circle cx="484" cy="124" r="3.5" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />

        {/* Manufacturer & Title */}
        <text x="230" y="28" textAnchor="middle" fill="#f8fafc" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontWeight="800" fontSize="13" letterSpacing="1.2">
          {(make || 'LEGAL METROLOGY SCALE').toUpperCase()}
        </text>
        <text x="230" y="42" textAnchor="middle" fill="#94a3b8" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontWeight="600" fontSize="9.5">
          MODEL: {model || 'STANDARD'} • ACCURACY: {accuracyClass || 'Class III'}
        </text>

        <line x1="20" y1="48" x2="440" y2="48" stroke="#334155" strokeWidth="1" />

        {/* Data Columns */}
        <text x="26" y="66" fill="#94a3b8" fontFamily="monospace" fontSize="10">MAX CAPACITY:</text>
        <text x="135" y="66" fill="#38bdf8" fontFamily="monospace" fontWeight="700" fontSize="11">{capacity}</text>

        <text x="26" y="84" fill="#94a3b8" fontFamily="monospace" fontSize="10">SERIAL NUMBER:</text>
        <text x="135" y="84" fill="#fbbf24" fontFamily="monospace" fontWeight="700" fontSize="11.5" letterSpacing="0.5">{serial}</text>

        <text x="26" y="102" fill="#94a3b8" fontFamily="monospace" fontSize="10">APPROVAL NO:</text>
        <text x="135" y="102" fill="#cbd5e1" fontFamily="monospace" fontSize="10">{approvalNo}</text>

        <text x="26" y="120" fill="#64748b" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="7.5">
          GOVT OF INDIA • LEGAL METROLOGY ACT, 2009 STANDARDS
        </text>

        {/* Official Stamping Hologram Badge */}
        <rect x="365" y="56" width="112" height="66" rx="6" fill="#1e293b" stroke="#059669" strokeWidth="1.5" />
        <circle cx="421" cy="84" r="16" fill="#065f46" stroke="#34d399" strokeWidth="1.5" />
        <text x="421" y="86" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif" fontWeight="800" fontSize="8.5">LM</text>
        <text x="421" y="95" textAnchor="middle" fill="#a7f3d0" fontFamily="sans-serif" fontWeight="700" fontSize="6">DEPT</text>
        <text x="421" y="112" textAnchor="middle" fill="#10b981" fontFamily="sans-serif" fontWeight="700" fontSize="7">VERIFIED</text>
      </svg>
    </div>
  );
}
