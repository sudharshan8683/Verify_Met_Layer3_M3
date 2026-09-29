# Layer 3 — Physical–Digital Binding: pHash comparison, API notes & demo (M3)

## What was added
| Area | File(s) |
|---|---|
| pHash engine (DCT, 256-bit) | `backend/src/services/perceptualHash.js` |
| Compare API + history | `backend/src/routes/nameplate.js` |
| Sticker lifecycle | `backend/src/services/stickerService.js`, `backend/src/routes/stickers.js` |
| Additive schema (re-runnable) | `backend/src/config/layer3Schema.js` -> tables `nameplate_comparisons`, `qr_stickers` |
| Server-side check on inspection submit | `backend/src/routes/verifications.js` (edited) |
| Public certificate payload now includes `sticker` | `backend/src/routes/certificates.js` (edited) |
| Inspector UI: nameplate re-capture + auto-check | `frontend/src/components/NameplateAutoCheck.jsx`, `App.jsx` (edited) |
| Demo photos | `npm run demo:images` -> `backend/uploads/demo/*` |
| Tests (32 checks) | `backend/tests/verify_layer3.js` -> `npm run test:layer3` |
| Sticker spec | `docs/LAYER3_STICKER_SPEC.md` |

Nothing in the Layer 1/2 schema was removed or restructured. Rollback: `DROP TABLE nameplate_comparisons; DROP TABLE qr_stickers;`

## How the comparison works
1. Photo -> greyscale, squashed to 128x128, centre 85% kept (drops bezel/background), contrast-normalised, 64x64.
2. 2-D DCT, top-left 16x16 block -> 256 bits (bit = coefficient above the median).
3. **Hamming distance** between the registered and the new hash:

| Distance | Result | Default (env var) |
|---|---|---|
| <= 20 | `MATCH` | `PHASH_MATCH_MAX=20` |
| 21 – 25 | `NEEDS_REVIEW` (inspector decides) | |
| >= 26 | `MISMATCH` | `PHASH_MISMATCH_MIN=26` |
| unreadable image | `NEEDS_REVIEW` | |

Measured on the demo data: same plate re-photographed (darker, blurred, JPEG) = **2**; different plate = **28–42**.

### Server-side rules (anti-collusion)
- `nameplate_match_status` sent by the browser is **not trusted**. If `nameplate_photo_url` is sent, the server compares it itself.
- Automatic `MISMATCH` is final — the inspector cannot clear it. Automatic `MATCH` can be escalated by the inspector. If unsure, the inspector's decision counts.
- On `MISMATCH`: audit-log entry + `NAMEPLATE_MISMATCH` risk flag (score 80) on the instrument, and the **certificate and sticker are withheld** (measurement still hash-chained as evidence; application stays `IN_PROGRESS`).

### Known limitation (say it before the judge does)
pHash is sensitive to framing. Tilted or heavily cropped photos of the *same* plate can score as `MISMATCH`. Mitigation in the product: camera guide frame (M2), the review screen, and the admin can clear a false flag. Real production would add OCR of the serial number.

## API notes
| Method & path | Purpose |
|---|---|
| `POST /api/nameplate/compare` `{instrument_id, candidate_photo_url, application_id?, compared_by?, persist?}` | compare with the registered nameplate. `persist:false` = preview only. `candidate_photo_url` may be a `data:` URI, `/uploads/...` path or http(s) URL |
| `GET /api/nameplate/:instrumentId/history` | stored comparisons + current match status (admin) |
| `POST /api/verifications` (+ `nameplate_photo_url`) | response now has `nameplate_match_status`, `nameplate_check`, `sticker_id`, `certificate_withheld` |
| `GET /api/stickers/:id` | public sticker lookup, `trusted` flag |
| `GET /api/stickers?instrument_id=` | sticker history |
| `POST /api/stickers/:id/report` | PEELED / MOVED / DAMAGED / MISSING (public, rate-limited) |
| `POST /api/stickers/:id/replace` `{officer_id}` | LMO/GATC/ADMIN only |

## Demo script — "swapped nameplate" beat (2 minutes)
1. `cd backend && npm run seed && npm start`, `cd frontend && npm run dev`.
2. Login as inspector, open the scheduled application, step 3 *Physical-Digital Nameplate Review*.
3. Upload `backend/uploads/demo/ESS-2023-98214_field_genuine.jpg` -> green **MATCH**, distance ~2.
4. Upload `ESS-2023-98214_field_SWAPPED.jpg` -> red **MISMATCH**; submit -> certificate withheld, `NAMEPLATE_MISMATCH` appears in the admin Red-Flag panel.
5. Sticker fraud: show `docs/LAYER3_STICKER_SPEC.md` §4 and call `POST /api/stickers/<id>/report {"reason":"MOVED"}` -> `STICKER_TAMPER` flag.
Pitch line: *"The QR proves the certificate is real. The nameplate check and the tamper-evident sticker prove it is on the right scale."*
