import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Scale, 
  UserCheck, 
  QrCode, 
  ArrowRight, 
  Lock, 
  Sparkles, 
  CheckCircle2, 
  Building2, 
  FileCheck2, 
  AlertCircle,
  ChevronRight,
  Eye,
  Info
} from 'lucide-react';

export default function LoginPage({ onLogin, onGuestPublic }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('MERCHANT');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('quick'); // 'quick' or 'form'

  const demoAccounts = [
    {
      role: 'MERCHANT',
      title: 'Shop Owner / Merchant',
      badge: 'Trader Portal',
      name: 'Ramesh Sharma',
      org: 'Sharma Provisions & Retail Pvt Ltd (Pune Central)',
      email: 'ramesh.sharma@gmail.com',
      id: 'usr-mer-01',
      icon: Scale,
      color: '#2563eb',
      lightBg: '#eff6ff',
      borderColor: '#bfdbfe',
      desc: 'Register electronic scales, upload physical nameplate proof, request periodic re-verification, and track digital verification certificates.',
      workflowStep: 'Step 1: Register scale & apply for verification'
    },
    {
      role: 'LMO',
      title: 'Legal Metrology Officer (LMO)',
      badge: 'Field Inspector',
      name: 'Rajesh Kumar (LMO-Pune Central)',
      org: 'Badge #MH-LMO-401 • Dept. of Legal Metrology',
      email: 'rajesh.lmo@gov.in',
      id: 'usr-lmo-01',
      icon: UserCheck,
      color: '#059669',
      lightBg: '#ecfdf5',
      borderColor: '#a7f3d0',
      desc: 'Conduct physical inspections on site. Mandatory live camera snapshot, GPS coordinate lock, side-by-side nameplate check, and error calibration recording.',
      workflowStep: 'Step 3: On-site verification with live photo & GPS'
    },
    {
      role: 'ADMIN',
      title: 'District Controller / Admin',
      badge: 'State Oversight',
      name: 'Controller Amit Joshi',
      org: 'Controller of Legal Metrology, Pune Division',
      email: 'admin@metrology.gov.in',
      id: 'usr-admin-01',
      icon: ShieldCheck,
      color: '#7c3aed',
      lightBg: '#faf5ff',
      borderColor: '#ddd6fe',
      desc: 'Monitor real-time SHA-256 cryptographic chain health, investigate impossible travel anomalies, detect high officer override rates, and manage officer allocation.',
      workflowStep: 'Step 6: Real-time governance & tamper detection'
    }
  ];

  const handleQuickLogin = (acc) => {
    setLoading(true);
    setTimeout(() => {
      onLogin({
        id: acc.id,
        name: acc.name,
        email: acc.email,
        role: acc.role,
        org_name: acc.org,
        jurisdiction_code: 'MH-PUN-01'
      });
      setLoading(false);
    }, 300);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    const matched = demoAccounts.find(a => a.role === selectedRole);
    setTimeout(() => {
      onLogin({
        id: matched?.id || 'usr-custom',
        name: matched?.name || email.split('@')[0],
        email: email || `${selectedRole.toLowerCase()}@metrology.gov.in`,
        role: selectedRole,
        org_name: matched?.org || 'Legal Metrology Department',
        jurisdiction_code: 'MH-PUN-01'
      });
      setLoading(false);
    }, 400);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(5, 150, 105, 0.04) 0px, transparent 50%)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#0f172a',
      padding: '32px 20px'
    }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
        
        {/* Top Government Emblem & Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '9999px',
            padding: '6px 16px',
            fontSize: '0.78rem',
            fontWeight: '600',
            color: '#1e3a8a',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            marginBottom: '16px'
          }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }}></span>
            Government of India • Ministry of Consumer Affairs • Legal Metrology Division
          </div>

          <h1 style={{
            fontSize: '2.4rem',
            fontWeight: '800',
            letterSpacing: '-0.03em',
            color: '#0f172a',
            marginBottom: '8px'
          }}>
            Verify<span style={{ color: '#2563eb' }}>MET</span><span style={{ color: '#059669' }}>+</span> National Integrity Portal
          </h1>
          
          <p style={{
            fontSize: '1.05rem',
            color: '#64748b',
            maxWidth: '680px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Online Verification System for Commercial Weighing & Measuring Instruments under the Legal Metrology Act, 2009.
          </p>
        </div>

        {/* Workflow Explainer Card: HOW IT WORKS */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px 28px',
          marginBottom: '32px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '6px', borderRadius: '8px' }}>
                <Sparkles size={18} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>
                How VerifyMET+ Solves Integrity & Tampering in 4 Connected Roles
              </h2>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontWeight: '500' }}>
              SIH Problem Statement ID: 26036
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px'
          }}>
            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#fff', fontSize: '0.7rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#1e40af' }}>Merchant Registers</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
                Owner registers weighing machine with model, serial number & mandatory photo of the physical nameplate.
              </p>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#059669', color: '#fff', fontSize: '0.7rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#065f46' }}>Blind Allocation</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
                Anti-collusion algorithm automatically assigns an inspector based on weighted random distribution. No officer-merchant collusion.
              </p>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#d97706', color: '#fff', fontSize: '0.7rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#92400e' }}>Proof of Presence</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
                Inspector visits shop. Live camera viewfinder and GPS location enforce physical presence. Nameplate side-by-side match verified.
              </p>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#7c3aed', color: '#fff', fontSize: '0.7rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</span>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#5b21b6' }}>QR Seal & Audit</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
                Cryptographic SHA-256 block chains the test result. Tamper-evident QR code issued. Citizens can scan & file complaints without login.
              </p>
            </div>
          </div>
        </div>

        {/* Login Method Selector */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '4px',
            display: 'flex',
            gap: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('quick')}
              style={{
                backgroundColor: activeTab === 'quick' ? '#2563eb' : 'transparent',
                color: activeTab === 'quick' ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Sparkles size={16} /> Instant Role Demo Login
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              style={{
                backgroundColor: activeTab === 'form' ? '#2563eb' : 'transparent',
                color: activeTab === 'form' ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Lock size={16} /> Standard Credentials Login
            </button>
          </div>
        </div>

        {/* TAB 1: QUICK ROLE DEMO CARDS */}
        {activeTab === 'quick' && (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
              marginBottom: '28px'
            }}>
              {demoAccounts.map((acc) => {
                const IconComponent = acc.icon;
                return (
                  <div
                    key={acc.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: `1px solid ${acc.borderColor}`,
                      padding: '24px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -2px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div>
                      {/* Role Badge & Icon */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div style={{
                          backgroundColor: acc.lightBg,
                          color: acc.color,
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1px solid ${acc.borderColor}`
                        }}>
                          <IconComponent size={22} />
                        </div>
                        <span style={{
                          backgroundColor: acc.lightBg,
                          color: acc.color,
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase'
                        }}>
                          {acc.badge}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                        {acc.title}
                      </h3>
                      
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: acc.color, marginBottom: '2px' }}>
                        {acc.name}
                      </div>
                      
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '14px' }}>
                        {acc.org}
                      </div>

                      <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5, marginBottom: '16px' }}>
                        {acc.desc}
                      </p>

                      <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        marginBottom: '20px'
                      }}>
                        <strong style={{ color: '#334155' }}>Workflow focus:</strong> {acc.workflowStep}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickLogin(acc)}
                      disabled={loading}
                      style={{
                        backgroundColor: acc.color,
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px 18px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '100%',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
                      }}
                    >
                      Login as {acc.title.split(' ')[0]} <ArrowRight size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* SEPARATE CARD: CONSUMER / CITIZEN PUBLIC VERIFICATION */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  backgroundColor: '#f1f5f9',
                  color: '#0f172a',
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #cbd5e1'
                }}>
                  <QrCode size={26} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
                      Citizen & Public Consumer Portal
                    </h3>
                    <span style={{ backgroundColor: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700' }}>
                      NO LOGIN REQUIRED
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '640px' }}>
                    Scan QR stickers physically pasted on butcher, grocery, or jewelry scales. Verify certificate authenticity, check last calibration dates, and report inaccurate weighing directly to the state.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onGuestPublic}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 22px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap'
                }}
              >
                Open Public QR Scanner <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: STANDARD CREDENTIALS FORM */}
        {activeTab === 'form' && (
          <div style={{
            maxWidth: '520px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
              Department Official / Trader Login
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '24px' }}>
              Sign in with your registered email and designated department role.
            </p>

            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Select Your System Role
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'MERCHANT', label: 'Shop Owner' },
                    { id: 'LMO', label: 'Inspector' },
                    { id: 'ADMIN', label: 'Admin' }
                  ].map(r => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setSelectedRole(r.id)}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: '600',
                        border: selectedRole === r.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: selectedRole === r.id ? '#eff6ff' : '#ffffff',
                        color: selectedRole === r.id ? '#1e40af' : '#475569'
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Email Address / Officer ID
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    selectedRole === 'MERCHANT' ? 'ramesh.sharma@gmail.com' :
                    selectedRole === 'LMO' ? 'rajesh.lmo@gov.in' : 'admin@metrology.gov.in'
                  }
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Secure Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In to Portal'} <ArrowRight size={16} />
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setActiveTab('quick')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.8rem',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                ← Back to 1-Click Instant Demo Login
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '0.78rem', color: '#94a3b8' }}>
          Designed for Smart India Hackathon (SIH ID: 26036) • Legal Metrology Act, 2009 Standards Compliance • Immutable Cryptographic Chain Layer
        </div>

      </div>
    </div>
  );
}
