# VerifyMET+ — Online Verification System for Weighing & Measuring Instruments
**SIH Problem Statement ID:** 26036  
**Regulatory Framework:** Legal Metrology Act, 2009 & Legal Metrology (General) Rules, 2011  
**Current Status:** **Layers 1–3 complete** (Layer 3: pHash nameplate comparison + tamper-evident QR stickers — see `docs/LAYER3_PHASH_AND_DEMO.md`)

---

## 🌟 The "Two-Beat" System Architecture

1. **Beat 1: Digitizing Workflow** — Online registration, digital application submission, fee calculation, QR-enabled certificate generation.
2. **Beat 2: The Integrity Layer (Our Core Uniqueness)** — Closes real-world fraud loopholes:
   - **Evidence-Bound Testing:** Live display camera capture + GPS geo-tag + SHA-256 hash chaining.
   - **Physical-Digital Binding:** Mandatory nameplate photo capture + perceptual hash (pHash) tamper detection.
   - **Blind Weighted-Random Allocation:** Algorithmic inspector assignment with cool-down rules preventing bribery/collusion.
   - **Behavioral Red-Flag Engine:** Detects "impossible travel" and suspicious Fail→Pass override spikes.
   - **Public Complaint Loop:** Instant "Report a Concern" on the public QR certificate page feeding inspector risk scores.
   - **WhatsApp-First Channel:** Instant alerts, reminders, and certificates sent via WhatsApp Business Cloud API.

---

## 📁 Repository Structure

```
Online_verify/
├── backend/
│   ├── data/
│   │   └── verifymet.db            # SQLite WAL database (Node 24 built-in)
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js         # Schema definition with Layer 1 deltas
│   │   ├── routes/
│   │   │   ├── auth.js             # Stakeholder roster & profiles
│   │   │   ├── instruments.js      # Register instruments with nameplate
│   │   │   ├── applications.js     # Blind weighted-random assignment
│   │   │   ├── verifications.js    # Evidence-bound test entry + hash chain
│   │   │   ├── certificates.js     # QR certificate verification
│   │   │   ├── integrity.js        # GET /api/integrity/chain-check
│   │   │   ├── riskFlags.js        # Behavioral anomaly queries
│   │   │   ├── complaints.js       # Public citizen complaint loop
│   │   │   └── notifications.js    # WhatsApp notification simulator
│   │   ├── seeds/
│   │   │   └── seed_data.js        # Seeded clean vs flagged inspectors & merchants
│   │   ├── services/
│   │   │   └── integrityService.js # SHA-256 cryptographic chain logic
│   │   └── server.js               # Express API entry point (:5000)
│   └── tests/
│       └── verify_layer1.js        # Automated Layer 1 test suite
├── frontend/                       # React + Vite client portal
│   └── src/
│       ├── App.jsx                 # 4-role switcher dashboard
│       └── index.css               # Clean responsive styling
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Run the Backend API
```bash
cd backend
npm install       # (Already installed)
npm run seed      # Populates test inspectors, shops, hash chains, and flags
npm start         # Starts backend on http://localhost:5000
```

### 2. Run the Layer 1 Automated Verification Suite
```bash
cd backend
node tests/verify_layer1.js
```
Expected output:
- `[PASS] 1. Health Endpoint: HTTP 200`
- `[PASS] 2. Stakeholders Loaded: 7 users in database`
- `[PASS] 3. Instruments Loaded: 3 instruments with physical nameplate metadata`
- `[PASS] 4. Cryptographic Chain Check: Valid = true`
- `[PASS] 5. Public QR Verification: Certificate MH-PUN-2026-00841 status = VALID`
- `[PASS] 6. Behavioral Red-Flag Engine: 2 Clean Inspectors, 2 Flagged with Anomaly Histories`
- `[PASS] 7. Blind Weighted-Random Allocation: Auto-assigned with cool-down rotation`

### 3. Run the Frontend Dashboard
```bash
cd frontend
npm run dev       # Starts Vite dev server on http://localhost:5173
```

---

## 🖥️ Interactive Portal Roles

Switch between roles dynamically in the top navigation bar:
1. **🛡️ Admin & Integrity Dashboard:** Monitor statewide stats, **Cryptographic SHA-256 Hash Chain status**, active **Behavioral Red-Flags** (Impossible travel, override outliers), and inspector integrity leaderboards.
2. **🛒 Shop Owner Portal:** View registered weighing instruments, register a new scale with physical nameplate image, apply for re-verification (triggers blind allocation), and see WhatsApp alerts.
3. **🔍 LMO Field Inspector Portal:** View today's scheduled tests, conduct evidence-bound testing with enforced live camera display and GPS coordinates, and submit hash-chained observations.
4. **📱 Public Citizen QR Scan Portal:** Look up any certificate (e.g. `MH-PUN-2026-00841`) to verify authenticity, view original instrument specs, and click **"Report a Concern"** to crowdsource enforcement!
