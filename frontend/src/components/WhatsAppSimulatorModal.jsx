import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  CheckCheck, 
  Sparkles, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck,
  Phone,
  Video,
  MoreVertical,
  Check
} from 'lucide-react';

export default function WhatsAppSimulatorModal({ 
  userId = 'usr-mer-01', 
  userName = 'Ramesh Sharma', 
  phone = '+91 9822998811',
  onClose,
  onOpenCertificate
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('RENEWAL_REMINDER');

  const fetchThread = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/notifications/whatsapp-thread/${userId}`);
      const data = await res.json();
      if (data.success && data.thread) {
        setMessages(data.thread);
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp thread:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
  }, [userId]);

  const handleSendTemplate = async (templateName) => {
    try {
      setSending(true);
      const res = await fetch('http://localhost:5000/api/notifications/whatsapp-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          template_name: templateName,
          phone: phone,
          params: {
            merchant_name: userName,
            scale_model: 'Essae-Teraoka DS-215N',
            serial: 'ESS-2023-98214',
            app_no: 'APP-2026-001',
            officer_name: 'Inspector Rajesh Kumar (Badge #401)',
            scheduled_date: 'Tomorrow, 11:30 AM',
            premises_address: '104, Laxmi Road Market, Pune',
            cert_no: 'MH-PUN-2026-00841',
            valid_until: '2027-09-28',
            block_hash: '9f81a7b45e2c1d3f'
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchThread();
      }
    } catch (err) {
      console.error('Failed to dispatch template:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '92vh',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}>
        
        {/* WhatsApp Mobile Top Bar */}
        <div style={{
          backgroundColor: '#075e54',
          color: '#ffffff',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#128c7e',
              border: '2px solid #25d366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              color: '#ffffff',
              fontWeight: '700'
            }}>
              ⚖️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>Legal Metrology Dept</span>
                <span style={{ backgroundColor: '#25d366', color: '#ffffff', borderRadius: '50%', width: '13px', height: '13px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#c7e8df', opacity: 0.9 }}>Official Business Account • {phone}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={onClose} 
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Action Controls for Demo Testing */}
        <div style={{
          backgroundColor: '#f0fdf4',
          borderBottom: '1px solid #bbf7d0',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: '#166534'
        }}>
          <span style={{ fontWeight: '600' }}>WhatsApp Cloud API Live Dispatch:</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => handleSendTemplate('RENEWAL_REMINDER')}
              disabled={sending}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #86efac',
                color: '#15803d',
                borderRadius: '4px',
                padding: '3px 8px',
                fontWeight: '700',
                fontSize: '0.68rem',
                cursor: 'pointer'
              }}
            >
              + Renewal Alert
            </button>
            <button
              onClick={() => handleSendTemplate('CERTIFICATE_ISSUED')}
              disabled={sending}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #86efac',
                color: '#15803d',
                borderRadius: '4px',
                padding: '3px 8px',
                fontWeight: '700',
                fontSize: '0.68rem',
                cursor: 'pointer'
              }}
            >
              + Certificate
            </button>
          </div>
        </div>

        {/* WhatsApp Chat Conversation Canvas */}
        <div style={{
          flex: 1,
          backgroundColor: '#efeae2',
          backgroundImage: 'radial-gradient(#d1d7db 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          padding: '16px 12px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Security Notice */}
          <div style={{
            alignSelf: 'center',
            backgroundColor: '#ffeecd',
            color: '#54656f',
            fontSize: '0.68rem',
            padding: '5px 12px',
            borderRadius: '8px',
            textAlign: 'center',
            maxWidth: '90%',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
          }}>
            🔒 Messages are end-to-end encrypted. Government notices delivered via Meta WhatsApp Business Cloud API under Legal Metrology Act, 2009.
          </div>

          {messages.map((m) => {
            const hasCert = m.text.includes('MH-PUN-2026-00841') || m.text.includes('Certificate');
            return (
              <div 
                key={m.id}
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  borderTopLeftRadius: '2px',
                  padding: '10px 12px',
                  maxWidth: '85%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  position: 'relative'
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#111b21', whiteSpace: 'pre-line', lineHeight: 1.45 }}>
                  {m.text}
                </div>

                {hasCert && onOpenCertificate && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f2f5' }}>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenCertificate('MH-PUN-2026-00841');
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: '#25d366',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <ExternalLink size={12} /> View Certificate in Public Portal
                    </button>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '4px',
                  marginTop: '4px',
                  fontSize: '0.62rem',
                  color: '#667781'
                }}>
                  <span>{m.timestamp ? m.timestamp.split(' ')[1]?.substring(0, 5) || '10:45 AM' : 'Just now'}</span>
                  <CheckCheck size={14} color="#53bdeb" />
                </div>
              </div>
            );
          })}

          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.78rem' }}>
              No messages in thread yet. Click the buttons above to trigger live WhatsApp messages.
            </div>
          )}
        </div>

        {/* WhatsApp Mobile Footer / Status */}
        <div style={{
          backgroundColor: '#f0f2f5',
          padding: '10px 14px',
          borderTop: '1px solid #d1d7db',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: '#54656f'
        }}>
          <span>Recipient: <strong>{phone}</strong></span>
          <span style={{ color: '#059669', fontWeight: '700' }}>● Cloud API Connected</span>
        </div>

      </div>
    </div>
  );
}
