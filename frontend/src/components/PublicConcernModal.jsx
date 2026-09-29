import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, X, Upload, Camera, ShieldCheck, AlertOctagon } from 'lucide-react';

export default function PublicConcernModal({ certificateNumber, certificateId, onClose, onSubmitSuccess }) {
  const [category, setCategory] = useState('SHORT_WEIGHING');
  const [description, setDescription] = useState('');
  const [complainantName, setComplainantName] = useState('');
  const [complainantPhone, setComplainantPhone] = useState('');
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [complaintId, setComplaintId] = useState('');
  const [error, setError] = useState(null);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setEvidencePhoto(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError('Please provide at least 10 characters detailing the discrepancy.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch('http://localhost:5000/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificate_number: certificateNumber,
          certificate_id: certificateId,
          description: `[Category: ${category}] ${description.trim()}`,
          complainant_name: complainantName || 'Anonymous Consumer',
          complainant_phone: complainantPhone || 'Confidential',
          evidence_photo_url: evidencePhoto || '/uploads/evidence/consumer_short_weight.jpg'
        })
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setComplaintId(data.complaint_id);
        if (onSubmitSuccess) onSubmitSuccess();
      } else {
        setError(data.error || 'Failed to submit concern. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Could not connect to Legal Metrology complaint engine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div 
        className="modal-dialog"
        style={{
          background: '#fff',
          borderRadius: '12px',
          maxWidth: '520px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button 
          type="button" 
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px', background: '#f1f5f9', border: 'none', borderRadius: '50%', padding: '6px', color: '#64748b', display: 'flex' }}
        >
          <X size={18} />
        </button>

        {/* Confirmation Screen */}
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ display: 'inline-flex', background: '#dcfce7', padding: '16px', borderRadius: '50%', marginBottom: '14px' }}>
              <CheckCircle2 size={42} color="#15803d" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
              Concern Registered Successfully!
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px' }}>
              Your report has been logged under Legal Metrology Enforcement Rules. A surveillance risk flag has been automatically attached to this certificate's inspector.
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '0.8rem', textAlign: 'left' }}>
              <div><strong>Grievance Reference:</strong> <code>{complaintId}</code></div>
              <div style={{ marginTop: '4px' }}><strong>Certificate Targeted:</strong> {certificateNumber}</div>
              <div style={{ marginTop: '4px' }}><strong>Action Initiated:</strong> Automated Red-Flag Inspection Audit Triggered</div>
            </div>
            <button 
              type="button" 
              onClick={onClose}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: '700', fontSize: '0.85rem' }}
            >
              Done
            </button>
          </div>
        ) : (
          /* Submission Form */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#fee2e2', padding: '8px', borderRadius: '8px' }}>
                <AlertTriangle size={22} color="#dc2626" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>
                  Report a Concern / Short-Weighing
                </h2>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  No Login Required | Certificate: <code>{certificateNumber}</code>
                </p>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontSize: '0.75rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertOctagon size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Type of Discrepancy Observed *
                </label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                >
                  <option value="SHORT_WEIGHING">Suspected Short-Weighing (Goods weigh less than shown)</option>
                  <option value="INSTRUMENT_MISMATCH">Scale Mismatch (Physical scale differs from certificate)</option>
                  <option value="PEELED_TAMPERED_STICKER">Damaged / Replaced Verification Sticker</option>
                  <option value="UNSTAMPED_INSTRUMENT">Unverified / Unstamped Scale</option>
                  <option value="OTHER">Other Malpractice</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155' }}>
                    Describe the Concern in Detail *
                  </label>
                  <span style={{ fontSize: '0.7rem', color: description.length < 10 ? '#dc2626' : '#059669' }}>
                    {description.length}/2000 chars (min 10)
                  </span>
                </div>
                <textarea 
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Purchased 1kg sugar; upon re-weighing on certified home scale it showed only 880g. Repeated error observed at counter 2."
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                  required
                />
              </div>

              {/* Photo Proof Upload */}
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Attach Photo Evidence (Optional)
                </span>
                {evidencePhoto ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} /> Image Attached
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setEvidencePhoto(null)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.7rem', fontWeight: '600' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}>
                    <Upload size={14} /> Upload receipt or scale photo
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>

              {/* Optional Contact Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Your Name (Optional)</label>
                  <input 
                    type="text" 
                    value={complainantName} 
                    onChange={e => setComplainantName(e.target.value)}
                    placeholder="Anonymous"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Mobile Number (Optional)</label>
                  <input 
                    type="text" 
                    value={complainantPhone} 
                    onChange={e => setComplainantPhone(e.target.value)}
                    placeholder="Confidential"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button 
                  type="button" 
                  onClick={onClose}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading || description.trim().length < 10}
                  style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
