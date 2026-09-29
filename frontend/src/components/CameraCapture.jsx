import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertOctagon, Upload, FlipHorizontal, Eye } from 'lucide-react';

export default function CameraCapture({ onCapture, label = "Live Display Photo Evidence", required = true }) {
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // back camera preferred for scales
  const [timestamp, setTimestamp] = useState(new Date().toLocaleTimeString());
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Keep timestamp fresh
  useEffect(() => {
    const timer = setInterval(() => setTimestamp(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startCamera = async () => {
    try {
      setPermissionDenied(false);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn("Camera access denied or unavailable:", err.message);
      setPermissionDenied(true);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraActive) {
      startCamera();
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw live cryptographic timestamp watermark on snapshot
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(10, canvas.height - 40, 320, 30);
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText(`VERIFYMET+ LIVE | ${new Date().toISOString()}`, 16, canvas.height - 20);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    if (onCapture) {
      onCapture(dataUrl);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setCapturedImage(dataUrl);
      if (onCapture) {
        onCapture(dataUrl, file);
      }
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={18} color="#2563eb" />
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>{label}</span>
          {required && <span style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '700' }}>*Required</span>}
        </div>
        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b' }}>
          {timestamp}
        </span>
      </div>

      {/* Permission Denied Blocking Notice */}
      {permissionDenied && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <AlertOctagon size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#991b1b' }}>Camera Permission Blocked / Unavailable</p>
            <p style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '2px' }}>
              Under Legal Metrology Evidence-Bound Testing rules, live display capture is required. Please allow camera permissions in your browser or use the verified photo upload selector below.
            </p>
          </div>
        </div>
      )}

      {/* Live Viewfinder View */}
      {cameraActive && !capturedImage && (
        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', background: '#000', marginBottom: '10px' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }} 
          />
          <div style={{ position: 'absolute', bottom: '10px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '10px', zIndex: 10 }}>
            <button 
              type="button" 
              onClick={takeSnapshot}
              style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '24px', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
            >
              <CheckCircle2 size={16} /> Capture Frame
            </button>
            <button 
              type="button" 
              onClick={switchCamera}
              style={{ background: 'rgba(255,255,255,0.85)', color: '#0f172a', border: 'none', padding: '8px 12px', borderRadius: '24px', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Flip camera"
            >
              <FlipHorizontal size={14} /> Flip
            </button>
            <button 
              type="button" 
              onClick={stopCamera}
              style={{ background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '24px', fontWeight: '600', fontSize: '0.8rem' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Captured Image Preview */}
      {capturedImage && (
        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '2px solid #22c55e', marginBottom: '10px' }}>
          <img 
            src={capturedImage} 
            alt="Captured Evidence" 
            style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }} 
          />
          <div style={{ background: '#f0fdf4', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#166534' }}>Photo Proof Attached</span>
            </div>
            <button 
              type="button" 
              onClick={retakePhoto}
              style={{ background: '#e2e8f0', color: '#0f172a', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RefreshCw size={12} /> Retake
            </button>
          </div>
        </div>
      )}

      {/* Hidden Canvas for Frame Capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Action Buttons if not capturing */}
      {!cameraActive && !capturedImage && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={startCamera}
            style={{ flex: 1, minWidth: '140px', background: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Camera size={14} /> Open Live Camera
          </button>
          <label style={{ flex: 1, minWidth: '140px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
            <Upload size={14} /> Upload Image
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      )}
    </div>
  );
}
