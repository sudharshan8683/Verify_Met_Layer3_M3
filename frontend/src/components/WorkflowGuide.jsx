import React, { useState } from 'react';
import { 
  CheckCircle2, 
  ArrowRight, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  Scale, 
  UserCheck, 
  ShieldCheck, 
  QrCode, 
  Sparkles,
  Layers,
  MapPin,
  Camera,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export default function WorkflowGuide({ currentRole, onNavigateStep, chainValid }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const steps = [
    {
      step: 1,
      role: 'merchant',
      actor: 'Shop Owner / Merchant',
      title: '1. Register Scale with Nameplate Photo',
      shortDesc: 'Owner uploads scale specs & physical nameplate photo proof.',
      purpose: 'Enforces Physical-Digital Binding from day zero. Eliminates fake or counterfeit machines.',
      badge: 'Merchant Portal',
      icon: Scale,
      color: '#2563eb',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
      actionLabel: 'Test Merchant Scale Registration'
    },
    {
      step: 2,
      role: 'merchant',
      actor: 'System Anti-Collusion Engine',
      title: '2. Request Verification & Blind Allocation',
      shortDesc: 'Merchant applies; system assigns a random inspector.',
      purpose: 'Weighted-random allocation prevents merchants and officers from colluding or scheduling private deals.',
      badge: 'Automated Algorithm',
      icon: Layers,
      color: '#059669',
      bgColor: '#ecfdf5',
      borderColor: '#a7f3d0',
      actionLabel: 'Test Requesting Verification'
    },
    {
      step: 3,
      role: 'inspector',
      actor: 'Legal Metrology Officer (LMO)',
      title: '3. On-Site Inspection (Camera + GPS + Side-by-Side)',
      shortDesc: 'Officer visits shop, locks GPS coords, captures live photo, and verifies nameplate.',
      purpose: 'Stops "tabletop verification" fraud. Proves inspector was physically at the exact merchant counter.',
      badge: 'Inspector Portal',
      icon: Camera,
      color: '#d97706',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
      actionLabel: 'Test On-Site Inspection Flow'
    },
    {
      step: 4,
      role: 'public',
      actor: 'Consumer / Citizen (Zero-Login)',
      title: '4. Public QR Certificate & Citizen Grievance',
      shortDesc: 'Buyer scans physical QR sticker on scale, verifies certificate, or files a discrepancy complaint.',
      purpose: 'Empowers public consumers as decentralized field auditors without requiring any login.',
      badge: 'Citizen Public QR',
      icon: QrCode,
      color: '#0f172a',
      bgColor: '#f1f5f9',
      borderColor: '#cbd5e1',
      actionLabel: 'Test Citizen QR Verification'
    },
    {
      step: 5,
      role: 'admin',
      actor: 'District Controller / Admin',
      title: '5. Behavioral Governance & Tamper Audit',
      shortDesc: 'Audits SHA-256 chain, investigates impossible travel & officer override outliers.',
      purpose: 'Algorithmic governance detects corrupted records and rogue officers who certify too fast.',
      badge: 'State Admin Portal',
      icon: ShieldCheck,
      color: '#7c3aed',
      bgColor: '#faf5ff',
      borderColor: '#ddd6fe',
      actionLabel: 'Test Admin Governance & Flags'
    }
  ];

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)',
      marginBottom: '24px',
      overflow: 'hidden'
    }}>
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '14px 20px',
          backgroundColor: '#f8fafc',
          borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>
                VerifyMET+ Complete End-to-End Workflow Guide
              </span>
              <span style={{
                fontSize: '0.72rem',
                backgroundColor: chainValid ? '#ecfdf5' : '#fef2f2',
                color: chainValid ? '#047857' : '#b91c1c',
                border: `1px solid ${chainValid ? '#a7f3d0' : '#fecaca'}`,
                padding: '2px 8px',
                borderRadius: '9999px',
                fontWeight: '600'
              }}>
                Ledger: {chainValid ? '100% Intact' : 'TAMPER DETECTED'}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Click any step below to instantly jump to that role and test how the verification lifecycle works.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.8rem' }}>
          <span>{isExpanded ? 'Collapse Guide' : 'Expand 5-Step Flow'}</span>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded Workflow Steps */}
      {isExpanded && (
        <div style={{ padding: '18px 20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '12px',
            position: 'relative'
          }}>
            {steps.map((st) => {
              const isCurrent = currentRole === st.role;
              const IconComp = st.icon;

              return (
                <div 
                  key={st.step}
                  style={{
                    backgroundColor: isCurrent ? st.bgColor : '#ffffff',
                    border: isCurrent ? `2px solid ${st.color}` : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isCurrent && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '12px',
                      backgroundColor: st.color,
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      textTransform: 'uppercase'
                    }}>
                      Current View
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        backgroundColor: st.bgColor,
                        color: st.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${st.borderColor}`,
                        flexShrink: 0
                      }}>
                        <IconComp size={15} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: st.color }}>
                        {st.badge}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', marginBottom: '4px', lineHeight: 1.3 }}>
                      {st.title}
                    </h4>

                    <p style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '8px', lineHeight: 1.4 }}>
                      {st.shortDesc}
                    </p>

                    <div style={{
                      backgroundColor: isCurrent ? '#ffffff' : '#f8fafc',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      fontSize: '0.68rem',
                      color: '#64748b',
                      lineHeight: 1.3,
                      marginBottom: '12px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <strong style={{ color: '#1e293b' }}>Why it matters:</strong> {st.purpose}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateStep(st.role, st.step)}
                    style={{
                      backgroundColor: isCurrent ? st.color : '#f1f5f9',
                      color: isCurrent ? '#ffffff' : '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '7px 10px',
                      fontSize: '0.72rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      width: '100%',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{st.actionLabel}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
