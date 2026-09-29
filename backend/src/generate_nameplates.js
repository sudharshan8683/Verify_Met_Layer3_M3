const fs = require('fs');
const path = require('path');

function createNameplateSVG(make, model, serial, capacity, accClass, approvalNo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 160" width="100%" height="100%">
  <defs>
    <linearGradient id="metal-${serial}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="30%" stop-color="#e2e8f0"/>
      <stop offset="70%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <filter id="shadow-${serial}" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Metallic Nameplate Plate -->
  <rect x="4" y="4" width="492" height="152" rx="10" fill="url(#metal-${serial})" stroke="#475569" stroke-width="2.5" filter="url(#shadow-${serial})"/>
  <rect x="12" y="12" width="476" height="136" rx="6" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>

  <!-- Corner Rivets -->
  <circle cx="22" cy="22" r="4" fill="#cbd5e1" stroke="#334155" stroke-width="1"/>
  <circle cx="478" cy="22" r="4" fill="#cbd5e1" stroke="#334155" stroke-width="1"/>
  <circle cx="22" cy="138" r="4" fill="#cbd5e1" stroke="#334155" stroke-width="1"/>
  <circle cx="478" cy="138" r="4" fill="#cbd5e1" stroke="#334155" stroke-width="1"/>

  <!-- Top Title: Manufacturer & Brand -->
  <text x="250" y="34" text-anchor="middle" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="15" letter-spacing="1.5">${make.toUpperCase()}</text>
  <text x="250" y="50" text-anchor="middle" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="10">MODEL: ${model} • ACCURACY: ${accClass}</text>

  <line x1="28" y1="58" x2="472" y2="58" stroke="#334155" stroke-width="1"/>

  <!-- Left Column: Specs -->
  <text x="36" y="78" fill="#94a3b8" font-family="monospace" font-size="11">CAPACITY / MAX:</text>
  <text x="160" y="78" fill="#38bdf8" font-family="monospace" font-weight="700" font-size="12">${capacity}</text>

  <text x="36" y="98" fill="#94a3b8" font-family="monospace" font-size="11">SERIAL NUMBER:</text>
  <text x="160" y="98" fill="#fbbf24" font-family="monospace" font-weight="700" font-size="13" letter-spacing="0.5">${serial}</text>

  <text x="36" y="118" fill="#94a3b8" font-family="monospace" font-size="11">MODEL APPROVAL:</text>
  <text x="160" y="118" fill="#cbd5e1" font-family="monospace" font-size="11">${approvalNo}</text>

  <text x="36" y="136" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="8">GOVT OF INDIA • LEGAL METROLOGY ACT, 2009 STANDARDS</text>

  <!-- Right: Verification Seal Hologram Badge -->
  <rect x="366" y="68" width="102" height="66" rx="8" fill="#1e293b" stroke="#059669" stroke-width="1.5"/>
  <circle cx="417" cy="94" r="17" fill="#065f46" stroke="#34d399" stroke-width="1.5"/>
  <text x="417" y="97" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="800" font-size="9">LM</text>
  <text x="417" y="106" text-anchor="middle" fill="#a7f3d0" font-family="sans-serif" font-weight="700" font-size="6">DEPT</text>
  <text x="417" y="124" text-anchor="middle" fill="#10b981" font-family="sans-serif" font-weight="700" font-size="7">AUTHENTIC</text>
</svg>`;
}

const items = [
  { file: 'ESS-2023-98214_nameplate.jpg', make: 'Essae-Teraoka', model: 'DS-215N', serial: 'ESS-2023-98214', cap: '30 kg (e=5g)', cls: 'Class III', appr: 'IND/09/2023/412' },
  { file: 'AVY-2022-44120_nameplate.jpg', make: 'Avery India', model: 'E1205', serial: 'AVY-2022-44120', cap: '300 kg (e=50g)', cls: 'Class III', appr: 'IND/09/2022/881' },
  { file: 'MT-2024-11098_nameplate.jpg', make: 'Mettler Toledo', model: 'BBA231', serial: 'MT-2024-11098', cap: '15 kg (e=2g)', cls: 'Class II', appr: 'IND/09/2024/099' }
];

const dirs = [
  path.join(__dirname, '../uploads/nameplates'),
  path.join(__dirname, '../../frontend/public/uploads/nameplates')
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  for (const item of items) {
    const svg = createNameplateSVG(item.make, item.model, item.serial, item.cap, item.cls, item.appr);
    fs.writeFileSync(path.join(dir, item.file), svg, 'utf8');
    fs.writeFileSync(path.join(dir, item.file.replace('.jpg', '.svg')), svg, 'utf8');
  }
}

console.log('✅ Generated official SVG nameplate badges in both backend/uploads and frontend/public!');
