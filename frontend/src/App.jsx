import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Scale, 
  UserCheck, 
  AlertTriangle, 
  QrCode, 
  Search, 
  Camera, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  MessageSquare,
  Lock,
  Layers,
  ArrowRight,
  Eye,
  AlertOctagon,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Info,
  LogOut,
  ChevronRight,
  Building2,
  FileCheck2,
  HelpCircle
} from 'lucide-react';

import CameraCapture from './components/CameraCapture';
import GeoLocationEnforcer from './components/GeoLocationEnforcer';
import AdminRedFlagModal from './components/AdminRedFlagModal';
import PublicConcernModal from './components/PublicConcernModal';
import LoginPage from './components/LoginPage';
import WorkflowGuide from './components/WorkflowGuide';
import NameplateBadge from './components/NameplateBadge';
import NameplateAutoCheck from './components/NameplateAutoCheck';
import WhatsAppSimulatorModal from './components/WhatsAppSimulatorModal';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  // Authentication & Persona state
  const [currentUser, setCurrentUser] = useState(null); // null shows LoginPage
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

  const [activeRole, setActiveRole] = useState('admin'); // 'merchant', 'inspector', 'admin', 'public'
  const [instruments, setInstruments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [riskFlags, setRiskFlags] = useState([]);
  const [inspectorsSummary, setInspectorsSummary] = useState([]);
  const [chainStatus, setChainStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // M2 State: Admin Drill-Down Modal
  const [selectedFlagForDrillDown, setSelectedFlagForDrillDown] = useState(null);

  // M2 State: Public Concern Modal
  const [publicConcernOpen, setPublicConcernOpen] = useState(false);

  // M2 State: Merchant Register Scale with Nameplate
  const [newInstModal, setNewInstModal] = useState(false);
  const [instForm, setInstForm] = useState({
    owner_id: 'usr-mer-01',
    category: 'ELECTRONIC_WEIGHING',
    make: '',
    model: '',
    serial_number: '',
    capacity: '30 kg (e=5g)',
    accuracy_class: 'Class III',
    premises_address: '104, Laxmi Road Market, Pune',
    nameplate_photo_url: ''
  });

  // M2 State: Inspector Test Entry Modal
  const [inspectModal, setInspectModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [inspectForm, setInspectForm] = useState({
    zero_error: '0.0',
    repeatability_error: '0.01',
    eccentricity_error: '0.01',
    discrimination_pass: 1,
    nameplate_match: 'NEEDS_REVIEW',
    nameplate_photo_url: '',
    nameplate_auto: null,
    result: 'PASS',
    photo_url: '',
    geo_lat: 18.5167,
    geo_lng: 73.8562
  });
  const [submittingTest, setSubmittingTest] = useState(false);

  // Public QR Search State
  const [certQuery, setCertQuery] = useState('MH-PUN-2026-00841');
  const [publicCert, setPublicCert] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [instRes, appRes, riskRes, inspRes, chainRes] = await Promise.all([
        fetch(`${API_BASE}/instruments`).then(r => r.json()),
        fetch(`${API_BASE}/applications`).then(r => r.json()),
        fetch(`${API_BASE}/risk-flags`).then(r => r.json()),
        fetch(`${API_BASE}/risk-flags/inspectors-summary`).then(r => r.json()),
        fetch(`${API_BASE}/integrity/chain-check`).then(r => r.json())
      ]);

      if (instRes.success) setInstruments(instRes.instruments);
      if (appRes.success) setApplications(appRes.applications);
      if (riskRes.success) setRiskFlags(riskRes.risk_flags);
      if (inspRes.success) setInspectorsSummary(inspRes.inspectors);
      if (chainRes.success) setChainStatus(chainRes.report);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Workflow Guide Navigation Helper
  const handleNavigateStep = (role, step) => {
    setActiveRole(role);
    if (step === 1) {
      setNewInstModal(true);
    } else if (step === 2) {
      // highlighted merchant view
      showToast('Merchant View: Click "Apply for Verification" on any scale below to trigger anti-collusion allocation.');
    } else if (step === 3) {
      const pendingApp = applications.find(a => a.status === 'ASSIGNED' || a.status === 'PENDING') || applications[0];
      if (pendingApp) {
        setSelectedApp(pendingApp);
        setInspectModal(true);
      }
    } else if (step === 4) {
      handleVerifyCert('MH-PUN-2026-00841');
    } else if (step === 5) {
      showToast('Admin View: Review behavioral anomaly flags and audit SHA-256 chain integrity.');
    }
  };

  // Merchant: Register scale with mandatory nameplate
  const handleRegisterInstrument = async (e) => {
    e.preventDefault();
    if (!instForm.nameplate_photo_url) {
      showToast('Mandatory Nameplate photo required for physical-digital binding', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/instruments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(instForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Weighing Scale registered with physical nameplate metadata!');
        setNewInstModal(false);
        setInstForm({
          owner_id: 'usr-mer-01',
          category: 'ELECTRONIC_WEIGHING',
          make: '',
          model: '',
          serial_number: '',
          capacity: '30 kg (e=5g)',
          accuracy_class: 'Class III',
          premises_address: '104, Laxmi Road Market, Pune',
          nameplate_photo_url: ''
        });
        fetchData();
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Registration failed', 'error');
    }
  };

  // Merchant: Apply for verification
  const handleApplyVerification = async (instrumentId) => {
    try {
      const res = await fetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicant_id: 'usr-mer-01',
          instrument_id: instrumentId,
          application_type: 'RE_VERIFICATION',
          scheduled_date: new Date(Date.now() + 3*86400000).toISOString().split('T')[0]
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Allocated Inspector: ${data.assigned_officer ? data.assigned_officer.name : 'Officer'} via Blind Anti-Collusion Engine!`);
        fetchData();
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Application submission failed', 'error');
    }
  };

  // Public QR: Look up certificate
  const handleVerifyCert = async (certNum) => {
    try {
      const res = await fetch(`${API_BASE}/certificates/verify/${certNum.trim()}`);
      const data = await res.json();
      if (data.success) {
        setPublicCert(data.certificate);
      } else {
        showToast(data.error, 'error');
        setPublicCert(null);
      }
    } catch (err) {
      showToast('Certificate lookup failed', 'error');
    }
  };

  // Inspector: Submit evidence-bound verification
  const handleSubmitInspection = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;

    if (!inspectForm.photo_url) {
      showToast('Integrity Violation: Live display photo proof is mandatory', 'error');
      return;
    }

    if (!inspectForm.nameplate_photo_url) {
      showToast('Physical-Digital Binding: nameplate photo is mandatory at every re-verification', 'error');
      return;
    }

    try {
      setSubmittingTest(true);
      const res = await fetch(`${API_BASE}/verifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: selectedApp.id,
          instrument_id: selectedApp.instrument_id,
          officer_id: selectedApp.assigned_officer_id || 'usr-lmo-01',
          zero_error: parseFloat(inspectForm.zero_error),
          repeatability_error: parseFloat(inspectForm.repeatability_error),
          eccentricity_error: parseFloat(inspectForm.eccentricity_error),
          discrimination_pass: parseInt(inspectForm.discrimination_pass, 10),
          overall_result: inspectForm.result,
          photo_url: inspectForm.photo_url,
          geo_lat: inspectForm.geo_lat,
          geo_lng: inspectForm.geo_lng,
          nameplate_match_status: inspectForm.nameplate_match,
          nameplate_photo_url: inspectForm.nameplate_photo_url
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Verification recorded! Block Hash: ${data.record_hash?.substring(0, 14)}...`);
        setInspectModal(false);
        fetchData();
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Verification submission failed', 'error');
    } finally {
      setSubmittingTest(false);
    }
  };

  // Admin: Simulate Tampering (Demo Feature)
  const handleSimulateTamper = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrity/simulate-tamper`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Simulated DB edit: Record altered directly in SQLite!');
        fetchData();
      }
    } catch (err) {
      showToast('Tamper simulation failed', 'error');
    }
  };

  // Admin: Restore Chain
  const handleRestoreChain = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrity/restore-chain`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Database record restored to authentic state!');
        fetchData();
      }
    } catch (err) {
      showToast('Restore failed', 'error');
    }
  };

  // Admin: Trigger Anomaly Engine On-Demand
  const handleRunAnomalyEngine = async () => {
    try {
      const res = await fetch(`${API_BASE}/risk-flags/run-engine`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Anomaly Engine Executed: ${data.results?.total_anomalies_detected} anomalies analyzed.`);
        fetchData();
      }
    } catch (err) {
      showToast('Failed to run anomaly engine', 'error');
    }
  };

  // If user is not logged in, show the comprehensive multi-role LoginPage!
  if (!currentUser) {
    return (
      <LoginPage
        onLogin={(user) => {
          setCurrentUser(user);
          if (user.role === 'ADMIN') setActiveRole('admin');
          else if (user.role === 'LMO') setActiveRole('inspector');
          else if (user.role === 'MERCHANT') setActiveRole('merchant');
          else setActiveRole('public');
        }}
        onGuestPublic={() => {
          setCurrentUser({ role: 'PUBLIC', name: 'Citizen Consumer' });
          setActiveRole('public');
          handleVerifyCert(certQuery);
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      
      {/* Top Light-Theme Navigation Bar */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Logo & National Emblem Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#2563eb',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Scale size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#0f172a' }}>
                  Verify<span style={{ color: '#2563eb' }}>MET</span><span style={{ color: '#059669' }}>+</span>
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  border: '1px solid #a7f3d0',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontWeight: '700'
                }}>
                  LIGHT THEME
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Legal Metrology Online Verification & Cryptographic Ledger System
              </p>
            </div>
          </div>

          {/* Quick Role Switcher (Light Modern Pills) */}
          <div className="nav-role-switcher" style={{
            display: 'flex',
            backgroundColor: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            gap: '4px'
          }}>
            <button 
              onClick={() => setActiveRole('admin')}
              style={{
                backgroundColor: activeRole === 'admin' ? '#ffffff' : 'transparent',
                color: activeRole === 'admin' ? '#7c3aed' : '#64748b',
                border: activeRole === 'admin' ? '1px solid #ddd6fe' : 'none',
                boxShadow: activeRole === 'admin' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ShieldCheck size={15} /> Admin Surveillance
            </button>
            <button 
              onClick={() => setActiveRole('merchant')}
              style={{
                backgroundColor: activeRole === 'merchant' ? '#ffffff' : 'transparent',
                color: activeRole === 'merchant' ? '#2563eb' : '#64748b',
                border: activeRole === 'merchant' ? '1px solid #bfdbfe' : 'none',
                boxShadow: activeRole === 'merchant' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Scale size={15} /> Shop Owner
            </button>
            <button 
              onClick={() => setActiveRole('inspector')}
              style={{
                backgroundColor: activeRole === 'inspector' ? '#ffffff' : 'transparent',
                color: activeRole === 'inspector' ? '#059669' : '#64748b',
                border: activeRole === 'inspector' ? '1px solid #a7f3d0' : 'none',
                boxShadow: activeRole === 'inspector' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <UserCheck size={15} /> LMO Inspector
            </button>
            <button 
              onClick={() => { setActiveRole('public'); handleVerifyCert(certQuery); }}
              style={{
                backgroundColor: activeRole === 'public' ? '#ffffff' : 'transparent',
                color: activeRole === 'public' ? '#0f172a' : '#64748b',
                border: activeRole === 'public' ? '1px solid #cbd5e1' : 'none',
                boxShadow: activeRole === 'public' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <QrCode size={15} /> Citizen QR
            </button>
          </div>

          {/* Current User Chip & Switch Role / Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '4px 10px',
              borderRadius: '9999px'
            }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: '#e2e8f0',
                color: '#334155',
                fontSize: '0.72rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {currentUser.name ? currentUser.name[0] : 'U'}
              </div>
              <div style={{ fontSize: '0.78rem', lineHeight: 1.2 }}>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>{currentUser.name}</span>
                <span style={{ color: '#64748b', marginLeft: '4px', fontSize: '0.7rem' }}>({currentUser.role})</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentUser(null)}
              title="Logout and select another role"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <LogOut size={13} /> Switch Role
            </button>
          </div>

        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#ffffff',
          padding: '12px 20px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500'
        }}>
          {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Main Container */}
      <main style={{ maxWidth: '1280px', margin: '20px auto', padding: '0 20px', flex: 1, width: '100%' }}>
        
        {/* INTERACTIVE WORKFLOW GUIDE (Visual 5-Step Lifecycle Simulator) */}
        <WorkflowGuide 
          currentRole={activeRole} 
          onNavigateStep={handleNavigateStep} 
          chainValid={chainStatus?.valid !== false}
        />

        {/* ========================================================================= */}
        {/* VIEW 1: STATE ADMIN & INTEGRITY DASHBOARD                                 */}
        {/* ========================================================================= */}
        {activeRole === 'admin' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
                  State Legal Metrology Controller Surveillance
                </h1>
                <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Real-time algorithmic surveillance, behavioral fraud detection & cryptographic tamper audit
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/notifications/trigger-expiry-sweep`, { method: 'POST' });
                      const data = await res.json();
                      if (data.success) {
                        showToast(`WhatsApp Sweep Completed: ${data.dispatched} notices queued!`);
                      }
                    } catch (e) {
                      showToast('Sweep failed', 'error');
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#059669', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}
                >
                  <MessageSquare size={14} /> WhatsApp Expiry Sweep
                </button>
                <button 
                  onClick={handleRunAnomalyEngine}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}
                >
                  <Sparkles size={14} /> Run Anomaly Engine
                </button>
                <button 
                  onClick={fetchData}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>

            {/* Cryptographic Chain Status Banner with Live Tamper Demo Controls */}
            <div style={{
              backgroundColor: chainStatus?.valid ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${chainStatus?.valid ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: chainStatus?.valid ? '#22c55e' : '#ef4444', color: '#ffffff', padding: '10px', borderRadius: '10px' }}>
                  <Lock size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: chainStatus?.valid ? '#166534' : '#991b1b' }}>
                    Cryptographic SHA-256 Hash Chain: {chainStatus?.valid ? 'SECURE & VERIFIED' : 'TAMPERING DETECTED!'}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                    {chainStatus?.message} Head Hash: <code style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>{chainStatus?.head_hash?.substring(0, 20)}...</code>
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ textAlign: 'right', marginRight: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Chained Blocks</span>
                  <p style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{chainStatus?.count || 0}</p>
                </div>
                
                {/* Tamper Simulation Demo Buttons */}
                {chainStatus?.valid ? (
                  <button 
                    onClick={handleSimulateTamper}
                    style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Deliberately edits a DB record to demonstrate cryptographic audit detection"
                  >
                    <AlertOctagon size={13} /> Simulate DB Tamper (Demo)
                  </button>
                ) : (
                  <button 
                    onClick={handleRestoreChain}
                    style={{ backgroundColor: '#22c55e', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RotateCcw size={13} /> Restore Chain
                  </button>
                )}
              </div>
            </div>

            {/* Red-Flag Anomaly Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
              
              {/* Behavioral Anomaly Card with Drill-Down */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle color="#dc2626" size={18} />
                    <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>Active Behavioral Red-Flags</h2>
                  </div>
                  <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: '700', padding: '2px 8px', borderRadius: '9999px' }}>
                    {riskFlags.length} Anomalies
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {riskFlags.map((flag) => (
                    <div 
                      key={flag.id} 
                      onClick={() => setSelectedFlagForDrillDown(flag)}
                      style={{ 
                        backgroundColor: '#fff1f2', 
                        border: '1px solid #fecdd3', 
                        borderRadius: '10px', 
                        padding: '12px', 
                        cursor: 'pointer',
                        transition: 'transform 0.15s, box-shadow 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(225, 29, 72, 0.12)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.82rem', color: '#9f1239' }}>{flag.flag_type}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ backgroundColor: '#be123c', color: '#fff', fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                            Score: {flag.score}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Eye size={12} /> Inspect
                          </span>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: '#4c0519', marginBottom: '4px' }}>
                        <strong>Target:</strong> {flag.details?.officer_name || flag.entity_type}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: '#881337', lineHeight: '1.4' }}>
                        {flag.details?.reason || flag.details?.description}
                      </p>
                    </div>
                  ))}
                  {riskFlags.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', padding: '16px' }}>
                      No active anomalies detected by governance engine.
                    </p>
                  )}
                </div>
              </div>

              {/* Inspector Integrity Leaderboard */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserCheck color="#2563eb" size={18} />
                    <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>Inspector Integrity Leaderboard</h2>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Jurisdiction: Pune Urban</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {inspectorsSummary.map((insp) => (
                    <div key={insp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div>
                        <p style={{ fontWeight: '600', fontSize: '0.82rem', color: '#0f172a' }}>{insp.name}</p>
                        <p style={{ fontSize: '0.72rem', color: '#64748b' }}>Assigned: {insp.total_assigned} | Verified: {insp.completed_tests}</p>
                      </div>
                      <div>
                        {insp.active_flags > 0 ? (
                          <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: '700', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} /> {insp.active_flags} Flags ({insp.max_risk_score} pts)
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: '700', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> Clean Profile
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Applications Surveillance Table */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
                Verification Applications & Anti-Collusion Allocation Log
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '10px' }}>App No.</th>
                      <th style={{ padding: '10px' }}>Applicant</th>
                      <th style={{ padding: '10px' }}>Instrument</th>
                      <th style={{ padding: '10px' }}>Assigned LMO</th>
                      <th style={{ padding: '10px' }}>Allocation Logic</th>
                      <th style={{ padding: '10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(app => (
                      <tr key={app.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>{app.application_number}</td>
                        <td style={{ padding: '10px' }}>{app.applicant_name} ({app.org_name})</td>
                        <td style={{ padding: '10px' }}>{app.make} {app.model}</td>
                        <td style={{ padding: '10px', fontWeight: '500' }}>{app.assigned_officer_name || 'Unassigned'}</td>
                        <td style={{ padding: '10px', color: '#64748b', fontSize: '0.72rem' }}>{app.assignment_reason}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ 
                            backgroundColor: app.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7', 
                            color: app.status === 'COMPLETED' ? '#166534' : '#92400e',
                            padding: '3px 8px', borderRadius: '12px', fontWeight: '700', fontSize: '0.68rem'
                          }}>
                            {app.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: MERCHANT / SHOP OWNER PORTAL                                      */}
        {/* ========================================================================= */}
        {activeRole === 'merchant' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>Sharma Provisions & Retail Pvt Ltd</h1>
                <p style={{ fontSize: '0.82rem', color: '#64748b' }}>GST: 27AABCS1429B1Z2 | Location: Laxmi Road Market, Pune</p>
              </div>
              <button 
                onClick={() => setNewInstModal(true)}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                + Register New Scale (with Nameplate)
              </button>
            </div>

            {/* WhatsApp Integration Banner */}
            <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '14px 18px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: '#25d366', color: '#ffffff', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(37, 211, 102, 0.2)' }}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#065f46' }}>WhatsApp Business Cloud Channel</span>
                    <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.65rem', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', border: '1px solid #86efac' }}>ACTIVE</span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#047857' }}>
                    Automated statutory renewal notices and verified digital certificates delivered to <strong>+91 9822998811</strong>.
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setWhatsAppModalOpen(true)}
                style={{ backgroundColor: '#059669', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <MessageSquare size={14} /> Open Live WhatsApp Thread
              </button>
            </div>

            {/* Registered Instruments Grid */}
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>My Commercial Weighing Instruments</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              {instruments.filter(i => i.owner_id === 'usr-mer-01').map(inst => (
                <div key={inst.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>{inst.make} - {inst.model}</h3>
                      <p style={{ fontSize: '0.72rem', color: '#64748b' }}>Serial No: <code>{inst.serial_number}</code></p>
                    </div>
                    <span style={{ 
                      backgroundColor: inst.verification_status === 'VERIFIED' ? '#dcfce7' : '#fef3c7',
                      color: inst.verification_status === 'VERIFIED' ? '#15803d' : '#92400e',
                      padding: '3px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '700'
                    }}>
                      {inst.verification_status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem', marginBottom: '14px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                    <div><span style={{ color: '#64748b' }}>Capacity:</span> <strong>{inst.capacity}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Accuracy Class:</span> <strong>{inst.accuracy_class}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Last Verified:</span> <strong>{inst.last_verified_date || 'Never'}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Expires:</span> <strong>{inst.reverification_due || 'Pending'}</strong></div>
                  </div>

                  <div style={{ marginBottom: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: '700', padding: '6px 10px', backgroundColor: '#f1f5f9', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Physical Nameplate Binding (Registered Photo):</span>
                      <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        ● Bound
                      </span>
                    </div>
                    <div style={{ padding: '8px', backgroundColor: '#ffffff' }}>
                      <NameplateBadge 
                        photoUrl={inst.nameplate_photo_url}
                        make={inst.make}
                        model={inst.model}
                        serial={inst.serial_number}
                        capacity={inst.capacity}
                        accuracyClass={inst.accuracy_class}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => handleApplyVerification(inst.id)}
                      style={{ flex: 1, backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600' }}
                    >
                      Apply for Re-Verification
                    </button>
                    {inst.current_certificate_number && (
                      <button 
                        onClick={() => {
                          setCertQuery(inst.current_certificate_number);
                          setActiveRole('public');
                          handleVerifyCert(inst.current_certificate_number);
                        }}
                        style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600' }}
                      >
                        View QR
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Merchant New Scale Modal */}
            {newInstModal && (
              <div className="modal-backdrop">
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', maxWidth: '520px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>Register New Scale with Physical Binding</h3>
                    <button onClick={() => setNewInstModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#64748b' }}>×</button>
                  </div>
                  <form onSubmit={handleRegisterInstrument}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', marginBottom: '4px' }}>Manufacturer / Make</label>
                        <input type="text" required value={instForm.make} onChange={e => setInstForm({...instForm, make: e.target.value})} placeholder="e.g. Phoenix Scales" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', marginBottom: '4px' }}>Model</label>
                        <input type="text" required value={instForm.model} onChange={e => setInstForm({...instForm, model: e.target.value})} placeholder="e.g. PX-300" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }} />
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', marginBottom: '4px' }}>Machine Serial Number (Engraved)</label>
                      <input type="text" required value={instForm.serial_number} onChange={e => setInstForm({...instForm, serial_number: e.target.value})} placeholder="e.g. SN-2026-PHX-994" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }} />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', marginBottom: '4px' }}>Mandatory Nameplate Photo Proof (Camera / File)</label>
                      <CameraCapture onCapture={(dataUrl) => setInstForm({...instForm, nameplate_photo_url: dataUrl})} />
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => setNewInstModal(false)} style={{ flex: 1, padding: '10px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem' }}>Cancel</button>
                      <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem' }}>Register Scale</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: INSPECTOR (LMO) VERIFICATION PORTAL                                */}
        {/* ========================================================================= */}
        {activeRole === 'inspector' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
                  LMO Field Verification Portal
                </h1>
                <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Officer: <strong>Rajesh Kumar (Badge #MH-LMO-401)</strong> | Jurisdiction: Pune Central
                </p>
              </div>
              <span style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700' }}>
                Proof of Physical Presence: Camera + GPS Enforced
              </span>
            </div>

            {/* Scheduled Verification Tasks */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
                Assigned Inspection Schedule (Blind Anti-Collusion Allocation)
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '10px' }}>Application</th>
                      <th style={{ padding: '10px' }}>Shop / Merchant</th>
                      <th style={{ padding: '10px' }}>Location</th>
                      <th style={{ padding: '10px' }}>Scale Info</th>
                      <th style={{ padding: '10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(app => (
                      <tr key={app.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: '600' }}>{app.application_number}</td>
                        <td style={{ padding: '10px' }}>{app.applicant_name} ({app.org_name})</td>
                        <td style={{ padding: '10px' }}>{app.premises_address || 'Laxmi Road Market, Pune'}</td>
                        <td style={{ padding: '10px' }}>{app.make} {app.model}</td>
                        <td style={{ padding: '10px' }}>
                          <button 
                            onClick={() => {
                              setSelectedApp(app);
                              setInspectModal(true);
                            }}
                            style={{ backgroundColor: '#059669', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Camera size={13} /> Conduct Physical Verification
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Verification Modal with Camera & GPS & Side-by-Side Review */}
            {inspectModal && selectedApp && (
              <div className="modal-backdrop">
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>Conduct Evidence-Bound Physical Verification</h3>
                      <p style={{ fontSize: '0.72rem', color: '#64748b' }}>App: {selectedApp.application_number} • Scale: {selectedApp.make} {selectedApp.model}</p>
                    </div>
                    <button onClick={() => setInspectModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#64748b' }}>×</button>
                  </div>

                  <form onSubmit={handleSubmitInspection}>
                    
                    {/* Layer 2: Live Viewfinder Camera Snapshot */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                        1. Mandatory Live Display Photo Proof (HTML5 MediaDevices)
                      </label>
                      <CameraCapture onCapture={(url) => setInspectForm({...inspectForm, photo_url: url})} />
                    </div>

                    {/* Layer 2: GPS Location Enforcer */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                        2. Proof of Physical Presence (HTML5 Geolocation API)
                      </label>
                      <GeoLocationEnforcer onLocation={(coords) => setInspectForm({...inspectForm, geo_lat: coords.lat, geo_lng: coords.lng})} />
                    </div>

                    {/* Layer 3: Physical-Digital Binding Side-by-Side Review */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                        3. Physical-Digital Nameplate Review (Side-by-Side Binding)
                      </label>
                      <NameplateAutoCheck
                        instrumentId={selectedApp.instrument_id}
                        registeredPhotoUrl={selectedApp.nameplate_photo_url || 'https://images.unsplash.com/photo-1594911772125-07fc7a2d8d9f?w=600&auto=format&fit=crop&q=60'}
                        serialNumber={selectedApp.serial_number}
                        value={{ photoUrl: inspectForm.nameplate_photo_url, autoResult: inspectForm.nameplate_auto, decision: inspectForm.nameplate_match }}
                        onChange={(v) => setInspectForm(f => ({ ...f, nameplate_photo_url: v.photoUrl, nameplate_auto: v.autoResult, nameplate_match: v.decision }))}
                      />
                    </div>

                    {/* Metrological Calibration Test Readings */}
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>
                        4. Calibration Standard Error Readings (Legal Metrology General Rules, 2011)
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>Zero Error (e)</label>
                          <input type="number" step="0.01" value={inspectForm.zero_error} onChange={e => setInspectForm({...inspectForm, zero_error: e.target.value})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>Repeatability Error (e)</label>
                          <input type="number" step="0.01" value={inspectForm.repeatability_error} onChange={e => setInspectForm({...inspectForm, repeatability_error: e.target.value})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>Eccentricity Error (e)</label>
                          <input type="number" step="0.01" value={inspectForm.eccentricity_error} onChange={e => setInspectForm({...inspectForm, eccentricity_error: e.target.value})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>Discrimination Test</label>
                          <select value={inspectForm.discrimination_pass} onChange={e => setInspectForm({...inspectForm, discrimination_pass: parseInt(e.target.value, 10)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}>
                            <option value={1}>PASS (Conforms to Class III)</option>
                            <option value={0}>FAIL (Below Sensitivity)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '4px' }}>Overall Assessment Result</label>
                      <select 
                        value={inspectForm.result} 
                        onChange={e => setInspectForm({...inspectForm, result: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '600' }}
                      >
                        <option value="PASS">PASS (Conforms to Legal Metrology General Rules)</option>
                        <option value="FAIL">FAIL (Exceeds Maximum Permissible Error)</option>
                      </select>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.7rem', color: '#64748b', marginBottom: '14px' }}>
                      <strong>Cryptographic Chaining:</strong> Submitting will compute a SHA-256 hash linking this inspection to the previous block.
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => setInspectModal(false)} style={{ flex: 1, padding: '10px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem' }}>Cancel</button>
                      <button 
                        type="submit" 
                        disabled={submittingTest}
                        style={{ flex: 1, padding: '10px', backgroundColor: '#059669', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        {submittingTest ? <RefreshCw size={14} className="animate-spin" /> : null}
                        {submittingTest ? 'Chaining Record...' : 'Submit & Hash-Chain'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: PUBLIC CITIZEN QR AUTHENTICATION PORTAL                            */}
        {/* ========================================================================= */}
        {activeRole === 'public' && (
          <div style={{ maxWidth: '680px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '50%', marginBottom: '12px' }}>
                <QrCode size={36} color="#2563eb" />
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>Legal Metrology Certificate Authentication</h1>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Official Government of India Verification Portal under Section 24 of the Act</p>
            </div>

            {/* Search Input Box */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input 
                type="text" 
                value={certQuery} 
                onChange={e => setCertQuery(e.target.value)}
                placeholder="Enter Certificate Number e.g. MH-PUN-2026-00841"
                style={{ flex: 1, padding: '12px 16px', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '600' }}
              />
              <button 
                onClick={() => handleVerifyCert(certQuery)}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Search size={16} /> Verify
              </button>
            </div>

            {/* Certificate Display Card */}
            {publicCert && (
              <div style={{ backgroundColor: '#ffffff', border: '2px solid #059669', borderRadius: '14px', padding: '24px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>Authentic Legal Certificate</span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{publicCert.certificate_number}</h2>
                  </div>
                  <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '20px', fontWeight: '800', fontSize: '0.82rem' }}>
                    ● {publicCert.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.82rem', marginBottom: '20px' }}>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.72rem' }}>Shop / Merchant</p>
                    <p style={{ fontWeight: '700', color: '#0f172a' }}>{publicCert.merchant?.organization || 'Sharma Provisions'}</p>
                    <p style={{ fontSize: '0.72rem', color: '#475569' }}>{publicCert.instrument?.premises_address}</p>
                  </div>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.72rem' }}>Weighing Instrument</p>
                    <p style={{ fontWeight: '700', color: '#0f172a' }}>{publicCert.instrument?.make} {publicCert.instrument?.model}</p>
                    <p style={{ fontSize: '0.72rem', color: '#475569' }}>Serial No: <code>{publicCert.instrument?.serial_number}</code></p>
                  </div>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.72rem' }}>Certificate Validity</p>
                    <p style={{ fontWeight: '700', color: '#15803d' }}>Valid until {publicCert.valid_until}</p>
                  </div>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.72rem' }}>Verified By LMO</p>
                    <p style={{ fontWeight: '700', color: '#0f172a' }}>{publicCert.inspector?.name}</p>
                    <p style={{ fontSize: '0.68rem', color: '#64748b' }}>Block: <code>{publicCert.inspector?.record_hash?.substring(0, 16)}...</code></p>
                  </div>
                </div>

                {/* Report a Concern Button (Citizen Feedback Loop) */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Notice discrepancy or short-weighting?</span>
                  <button 
                    onClick={() => setPublicConcernOpen(true)}
                    style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '8px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <AlertTriangle size={14} /> Report a Concern (No Login)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* M2 Modal: Admin Red-Flag Anomaly Drill-Down Modal */}
      {selectedFlagForDrillDown && (
        <AdminRedFlagModal 
          flag={selectedFlagForDrillDown} 
          onClose={() => setSelectedFlagForDrillDown(null)} 
        />
      )}

      {/* M2 Modal: Public Citizen Concern Modal */}
      {publicConcernOpen && (
        <PublicConcernModal 
          certificateNumber={publicCert?.certificate_number || certQuery}
          certificateId={publicCert?.id}
          onClose={() => setPublicConcernOpen(false)}
          onSubmitSuccess={() => {
            showToast('Concern filed and flagged in enforcement surveillance!');
            fetchData();
          }}
        />
      )}

      {/* M3 Modal: WhatsApp Business Cloud Simulator Modal */}
      {whatsAppModalOpen && (
        <WhatsAppSimulatorModal 
          userId={currentUser?.id || 'usr-mer-01'}
          userName={currentUser?.name || 'Ramesh Sharma'}
          phone={currentUser?.phone || '+91 9822998811'}
          onClose={() => setWhatsAppModalOpen(false)}
          onOpenCertificate={(certNo) => {
            setCertQuery(certNo);
            setActiveRole('public');
            handleVerifyCert(certNo);
          }}
        />
      )}

      {/* Light Theme Clean Footer */}
      <footer style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        color: '#64748b',
        padding: '16px 24px',
        fontSize: '0.75rem',
        marginTop: 'auto'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            VerifyMET+ National Integrity System • Legal Metrology Act, 2009 Standards
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Evidence-Bound Testing (3.1)</span>
            <span>Physical-Digital Binding (3.2)</span>
            <span>Governance Engine (3.3 & 3.4)</span>
            <span>Public Complaint Loop (3.5)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
