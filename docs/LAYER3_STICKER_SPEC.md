# Tamper-Evident QR Sticker — Specification (Layer 3, Feature 3.2)

**Owner:** M3 · **Loophole closed:** a valid certificate sticker peeled off one scale and moved to another.

## 1. Why
The QR code on a certificate points to a *database row*, not to the *physical object*. Without protection a shop owner can peel a valid sticker from a genuine scale and stick it on a tampered one. Two controls work together:

| Control | What it proves |
|---|---|
| Nameplate binding (pHash, see `LAYER3_PHASH_AND_DEMO.md`) | the instrument in front of the inspector is the one that was registered |
| Tamper-evident sticker (this document) | the sticker on the instrument was applied by an officer to *this* instrument and has not been moved |

## 2. Physical specification
1. **Material:** destructible ("void") vinyl / eggshell polyester. On peel it fractures into pieces and/or leaves a visible **VOID / OPENED** pattern on the instrument surface. It cannot be removed intact.
2. **Size:** approx. 40 mm x 40 mm (QR) + 40 mm x 12 mm text strip.
3. **Printed content:**
   - QR code -> `https://verifymet.gov.in/verify/<certificate_number>`
   - **Unique sticker ID** in human-readable text, format `STK-<year>-<6 hex>` (e.g. `STK-2026-A1B2C3`), also printed in the QR payload
   - Certificate validity date, "GOVT. OF INDIA – LEGAL METROLOGY"
4. **Security features (recommended):** serial-numbered stock, micro-text border, tamper void message.
5. **Placement:** next to the nameplate on a clean, dry, flat metal/plastic surface, photographed by the officer after application (the "sticker-applied" photo is part of the evidence).

## 3. Lifecycle and data model (implemented)
Table `qr_stickers`: `id, instrument_id, certificate_id, status, applied_by, applied_at, applied_geo_lat/lng, replaced_by, last_report_reason, last_reported_by, last_reported_at`.

| Status | Meaning |
|---|---|
| `ACTIVE` | current valid sticker for the instrument |
| `COMPROMISED` | reported peeled / moved / damaged / missing — **not trusted** until re-verified |
| `REPLACED` | superseded by a newer sticker (`replaced_by`) |
| `REVOKED` | reserved for administrative revocation |

1. **Application:** the sticker ID is generated automatically when a certificate is issued (`POST /api/verifications` with `PASS`). Any earlier `ACTIVE` sticker of that instrument becomes `REPLACED`. The applying officer, time and GPS are stored.
2. **Public check:** anyone can call `GET /api/stickers/:id` (or scan the QR). `trusted = true` only if the sticker is `ACTIVE` **and** the certificate is `VALID`.
3. **Reporting a peeled / replaced sticker** — open to citizens, owners and inspectors (no login, rate-limited):
   `POST /api/stickers/:id/report` `{ "reason": "PEELED | MOVED | DAMAGED | MISSING", "note": "...", "reported_by": "..." }`
   - sticker -> `COMPROMISED`; entry written to `audit_logs` (`STICKER_REPORTED`)
   - `PEELED` / `MOVED` also raise a **`STICKER_TAMPER` risk flag** (score 70 / 85) on the instrument -> visible in the admin Red-Flag panel
4. **Replacement:** only an LMO / GATC / ADMIN user can call `POST /api/stickers/:id/replace`. The old sticker becomes `REPLACED`, a new `ACTIVE` sticker is issued, and `STICKER_REPLACED` is logged. In practice the officer re-verifies the instrument (nameplate photo + test) before applying the new sticker.
5. **Genuine wear** (`DAMAGED` / `MISSING`) is recorded without a risk flag; the owner simply requests a re-application.

## 4. Fraud scenario for the demo script (sticker moved to another scale)
1. Scale A (`inst-01`) is certified. Sticker `STK-…` is applied and shown as *trusted*.
2. The owner peels the sticker and puts it on Scale B, which never passed.
3. A citizen scans the QR on Scale B -> the public page shows serial number **of Scale A** and the sticker's registered serial does not match Scale B's nameplate; the citizen taps *Report sticker moved* -> `POST /api/stickers/:id/report {reason:"MOVED"}`.
4. Sticker becomes `COMPROMISED`, a `STICKER_TAMPER` flag (score 85) appears in the admin panel.
5. At the next visit, the nameplate on Scale B does not match the registered nameplate -> pHash `MISMATCH` -> certificate withheld. The physical peel-void pattern is the second, independent proof.

## 5. Out of scope (documented as roadmap)
Serialised sticker stock inventory per officer, NFC/holographic layer, and DigiLocker linkage (see Compliance roadmap, Layer 6).
