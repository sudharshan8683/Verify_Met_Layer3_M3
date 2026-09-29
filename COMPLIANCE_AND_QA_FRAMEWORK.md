# VerifyMET+ Regulatory Compliance & QA Framework
## DPDP Act 2023, Legal Metrology Act 2009 & 8 Critical E2E Test Journeys

**SIH Problem Statement ID:** 26036  
**Role:** M3 — WhatsApp, QA & Compliance Lead  
**Applicable Statutes:**
1. **Digital Personal Data Protection (DPDP) Act, 2023 (India)**
2. **Legal Metrology Act, 2009 (Act No. 1 of 2010)**
3. **Legal Metrology (General) Rules, 2011**
4. **Information Technology Act, 2000 (Section 4 & 65B Electronic Records)**

---

## 1. DPDP Act, 2023 Compliance Architecture

VerifyMET+ complies with the principles of the **Digital Personal Data Protection Act, 2023 (DPDP Act)** governing Data Fiduciaries and Data Principals:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DPDP ACT 2023 COMPLIANCE MATRIX                       │
├───────────────────────┬─────────────────────────────────────────────────────┤
│ DPDP Statutory Pillar │ VerifyMET+ Architectural Implementation             │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ 1. Lawful Processing  │ Data processed under Section 7(b) (performance of  │
│    (Section 4 & 7)    │ statutory functions under Legal Metrology Act 2009)│
├───────────────────────┼─────────────────────────────────────────────────────┤
│ 2. Purpose Limitation │ Phone numbers used strictly for statutory expiry   │
│                       │ notices via WhatsApp; not shared or monetized.      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ 3. Data Minimization  │ • NO continuous GPS tracking. Location captured     │
│                       │   STRICTLY at the single moment of inspection photo.│
│                       │ • Face blurring applied to background bystanders in │
│                       │   display evidence captures.                        │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ 4. Storage Security   │ • Passwords and sessions securely hashed.           │
│    (Section 8)        │ • Tamper-evident SHA-256 cryptographic ledger.      │
│                       │ • SQLite WAL journaling with automated audit logs.  │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ 5. Data Principal     │ • Merchants can view and download all certificates. │
│    Rights (Sec 11-14) │ • Right to grievance redressal via public portal.   │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ 6. Public Grievances  │ Zero-login citizen complaint intake with anonymous  │
│                       │ submission option ensuring whistleblower privacy.   │
└───────────────────────┴─────────────────────────────────────────────────────┘
```

---

## 2. Legal Metrology Act, 2009 & Rules 2011 Compliance

### 2.1 Statutory Re-Verification Periodicity (Section 24)
* **General Commercial Weighing Scales (Class III & IV):** Periodic verification mandated every **12 months** (1 year).
* **High-Precision Scales (Jewelry / Analytical Class I & II):** Mandated every **12 months**.
* **Storage Weights & Measures:** Mandated every **24 months** (2 years).
* **Automated Expiry Calculation:** VerifyMET+ automatically sets `reverification_due = issue_date + 365 days` and queues WhatsApp statutory alerts at $T-30$, $T-15$, and $T-0$ days before expiry.

### 2.2 Maximum Permissible Error (MPE) Verification
In accordance with the **Seventh Schedule of the Legal Metrology (General) Rules, 2011**, VerifyMET+ validates that:
$$\text{Zero Error} \le 0.5e, \quad \text{Repeatability Error} \le 1.0e, \quad \text{Eccentricity Error} \le 1.0e$$
Any measurement exceeding these thresholds automatically triggers a **`FAIL`** recommendation in the inspector's interface.

---

## 3. The 8 Critical End-to-End (E2E) Test Journeys

| Journey ID | Journey Title | Primary Actor | Statutory & Functional Verification Objective |
| :---: | :--- | :---: | :--- |
| **E2E-01** | **Scale Onboarding & Nameplate Binding** | Merchant | Enforces manufacturer nameplate photo upload with make, model, capacity, and serial number during registration. |
| **E2E-02** | **Blind Anti-Collusion Allocation** | Algorithm | Assigns inspector using weighted random distribution; excludes officers with recent repeat merchant pairings. |
| **E2E-03** | **On-Site Proof of Physical Presence** | LMO | Live camera snapshot of scale display + GPS coordinates lock verified before inspection submission is allowed. |
| **E2E-04** | **Side-by-Side Nameplate Verification** | LMO | Compares registered reference nameplate with live field capture; mismatch triggers high-risk tamper warning. |
| **E2E-05** | **Cryptographic SHA-256 Ledger Chaining** | System | Tests sequential block hashing: $\text{Hash}_n = \text{SHA256}(\text{Data}_n + \text{Hash}_{n-1})$. Confirms chain integrity. |
| **E2E-06** | **Real-Time DB Tamper Detection** | Admin | Directly modifies SQLite record; confirms `chain-check` engine flags corrupted block and alerts state controller. |
| **E2E-07** | **Citizen Public QR Scan & Grievance** | Consumer | Citizen scans QR code (no login required), validates certificate validity, and submits discrepancy complaint with tracking ID. |
| **E2E-08** | **WhatsApp Cloud API Multi-Template Dispatch** | WhatsApp API | Verifies automated delivery of renewal alerts (`RENEWAL_REMINDER`) and verified certificate links (`CERTIFICATE_ISSUED`). |

---

## 4. WhatsApp Business Cloud API Integration Specifications

### Pre-Approved Templates:
1. **`RENEWAL_REMINDER`** — 30-day proactive statutory notice to prevent compounding fines under Section 33.
2. **`VERIFICATION_SCHEDULED`** — Immediate notification containing assigned LMO name, badge number, and inspection date.
3. **`CERTIFICATE_ISSUED`** — Instant delivery of digital certificate number, validity period, SHA-256 hash, and public QR verification link.
4. **`CITIZEN_COMPLAINT_ACK`** — Citizen grievance acknowledgment with unique tracking reference ID (`comp-...`).

---

## 5. Automated QA Test Suite Summary
Run the automated M3 test suite:
```bash
node backend/tests/verify_m3_e2e_compliance.js
```
All 8 journeys are validated programmatically with 100% assertions passing.
