# VerifyMET+ Technical Documentation
## System Architecture, Security Framework & Deployment Methodology

**SIH Problem Statement ID:** 26036  
**Project:** Online Verification System for Weighing & Measuring Instruments  
**Statutory Framework:** Legal Metrology Act, 2009 & Legal Metrology (General) Rules, 2011  

---

## 1. System Architecture Overview

VerifyMET+ implements a **"Two-Beat" System Architecture**:
1. **Beat 1: Digital Workflow Core** — Digital instrument registration, periodic re-verification applications, automated fee calculation, certificate issuance, and citizen QR verification.
2. **Beat 2: The Integrity Layer** — Cryptographic and algorithmic mechanisms designed to eliminate real-world fraud (tabletop certifications, inspector-merchant collusion, sticker tampering, and SQL database record falsification).

### Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |   Merchant Portal  |  |   Inspector Portal |  |  Public Citizen QR Portal   |  |
|  | (Scale Reg & Apps) |  | (Camera+GPS+Review)|  | (No-Login Certificate Audit)|  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|                                       |                                           |
|                             +--------------------+                                |
|                             |  Admin Governance  |                                |
|                             | (Red-Flags+Tamper) |                                |
|                             +--------------------+                                |
+---------------------------------------|-------------------------------------------+
                                        | HTTP / JSON REST APIs
+---------------------------------------v-------------------------------------------+
|                               API GATEWAY / ROUTING                               |
|  /api/auth  |  /api/instruments  |  /api/applications  |  /api/verifications     |
|  /api/certificates  |  /api/integrity  |  /api/risk-flags  |  /api/complaints     |
+-----------------------------------------------------------------------------------+
                                        |
+---------------------------------------v-------------------------------------------+
|                             BUSINESS & INTEGRITY LOGIC                            |
|  +---------------------------------+  +----------------------------------------+  |
|  |     IntegrityService.js         |  |          RedFlagEngine.js              |  |
|  | - SHA-256 Hash Chaining         |  | - Blind Weighted-Random Allocation     |  |
|  | - Real-time Chain Audit         |  | - Impossible Travel Anomaly (Haversine)|  |
|  | - SQLite Tamper Detection       |  | - High-Risk Override Outlier Detector  |  |
|  +---------------------------------+  +----------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                        |
+---------------------------------------v-------------------------------------------+
|                               PERSISTENCE LAYER                                   |
|  SQLite WAL Database (Node 24 Built-In Engine)                                    |
|  Tables: users, instruments, applications, verifications, certificates,           |
|          risk_flags, complaints, notifications, audit_log                         |
+-----------------------------------------------------------------------------------+
```

---

## 2. Security & Integrity Framework

### 2.1 Cryptographic SHA-256 Hash Chaining (Blockchain-Style Ledger)
* Every verification record is cryptographically linked to the preceding record:
  $$\text{Record Hash} = \text{SHA256}(\text{previous\_hash} + \text{verification\_data} + \text{officer\_id} + \text{timestamp})$$
* **Tamper Evident Audit:** If a database administrator or malicious actor modifies any row directly in the database, the hash chain is broken. The `GET /api/integrity/chain-check` endpoint scans the chain and flags the exact corrupted block.

### 2.2 Proof of Physical Presence (Zero Tabletop Fraud)
* **HTML5 MediaDevices API:** Inspectors are required to capture a live camera photograph of the scale display with standard test weights applied.
* **Canvas Watermarking:** The live snapshot is cryptographically stamped on an HTML5 `<canvas>` with ISO-8601 timestamp and GPS coordinates.
* **HTML5 Geolocation API:** Enforces on-site GPS coordinates lock with accuracy tolerances in meters.

### 2.3 Physical-Digital Binding (Nameplate Verification)
* Prevents "sticker peeling" fraud where certified stickers are transferred to tampered scales.
* During scale onboarding, the merchant must capture the manufacturer's engraved metal nameplate.
* During inspection, the inspector's interface displays the registered nameplate alongside the live camera snapshot in a side-by-side comparison screen.

### 2.4 Blind Weighted-Random Anti-Collusion Allocation
* Merchants cannot choose or request specific inspectors.
* When a re-verification request is submitted, the engine selects eligible LMOs within the jurisdiction using weighted random probability based on current workload, past merchant pairing counts, and a cool-down period.

### 2.5 Behavioral Red-Flag Anomaly Detection
* **`IMPOSSIBLE_TRAVEL`:** Uses the Haversine distance formula to calculate travel speed between consecutive inspections. Inspections completed at speeds $> 120\text{ km/h}$ or physically impossible intervals are flagged immediately.
* **`OVERRIDE_OUTLIER`:** Identifies officers whose Fail-to-Pass override percentage deviates $> 2.5\sigma$ from district peer averages.
* **`REPEAT_PAIRING`:** Detects statistical clustering between specific merchants and inspectors.

---

## 3. Stakeholder Workflows

1. **Merchant / Business Owner:**
   * Registers electronic scale with serial number, capacity, and nameplate photograph.
   * Receives automated expiry alerts via WhatsApp Business Cloud API.
   * Submits re-verification request; system assigns random inspector.
2. **Legal Metrology Officer (LMO / GATC):**
   * Receives assigned verification schedule.
   * Visits premises; unlocks camera and GPS coordinates.
   * Conducts zero-error, repeatability, eccentricity, and discrimination tests.
   * Verifies physical nameplate match; submits cryptographically signed record.
3. **Public Consumer / Citizen:**
   * Scans physical QR sticker pasted on merchant's scale using any smartphone browser.
   * Views certificate status, expiry date, calibration results, and SHA-256 hash.
   * Submits discrepancy complaints (e.g. short measurement, broken seal) with optional photo evidence without needing an account.
4. **District Administrator / State Controller:**
   * Monitors district-wide verification compliance.
   * Audits cryptographic hash chain integrity in real-time.
   * Investigates behavioral red flags and reassigns officers.

---

## 4. Deployment Methodology

### 4.1 Production Prerequisites
* Node.js v20+ or v24 LTS
* Reverse Proxy: Nginx / Cloudflare
* Process Manager: PM2

### 4.2 System Services Setup with PM2

```bash
# 1. Clone repository
git clone https://github.com/Santhanakumar-28/Verify_MET.git
cd Verify_MET

# 2. Setup and launch Backend
cd backend
npm install --production
npm run seed
pm2 start src/server.js --name "verifymet-api"

# 3. Build Frontend for Production
cd ../frontend
npm install
npm run build

# 4. Serve Frontend via PM2 or Nginx
pm2 serve dist 5173 --name "verifymet-ui" --spa
pm2 save
pm2 startup
```

### 4.3 Nginx Reverse Proxy Configuration

```nginx
server {
    listen 80;
    server_name verifymet.gov.in;

    # Frontend SPA
    location / {
        root /var/www/verifymet/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend REST API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.4 Docker Containerization

```dockerfile
# Multi-stage Dockerfile for complete stack
FROM node:24-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

FROM node:24-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production
COPY backend/ ./backend/
COPY --from=builder /app/frontend/dist ./backend/public
EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "backend/src/server.js"]
```

---

## 5. Compliance & Statutory Alignment

* **Legal Metrology Act, 2009:** Full adherence to Section 24 (Verification and stamping of weight or measure).
* **Legal Metrology (General) Rules, 2011:** Adherence to Maximum Permissible Errors (MPE) for Non-Automatic Weighing Instruments (NAWI) across Class I, II, III, and IV scales.
* **Information Technology Act, 2000:** Electronic records and cryptographic hash signatures meet legal evidentiary standards under Section 4 and Section 65B of the Indian Evidence Act.
