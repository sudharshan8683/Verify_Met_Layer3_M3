/**
 * Generates the Layer 3 demo photos (run: npm run demo:images).
 *   genuine  = the registered ESS nameplate re-photographed in the field
 *              (slightly darker, soft blur, JPEG compression)  -> expect MATCH
 *   swapped  = a DIFFERENT nameplate fitted to the scale        -> expect MISMATCH
 * Files are written to backend/uploads/demo and frontend/public/uploads/demo.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const srcDir = path.join(__dirname, '../uploads/nameplates');
const outDirs = [
  path.join(__dirname, '../uploads/demo'),
  path.join(__dirname, '../../frontend/public/uploads/demo')
];

async function raster(svgName) {
  return sharp(fs.readFileSync(path.join(srcDir, svgName)), { density: 200 })
    .resize(800, 256, { fit: 'fill' })
    .png()
    .toBuffer();
}

(async () => {
  const genuineBase = await raster('ESS-2023-98214_nameplate.svg');
  const genuine = await sharp(genuineBase).modulate({ brightness: 0.85 }).blur(1.2).jpeg({ quality: 55 }).toBuffer();
  const swapped = await sharp(await raster('AVY-2022-44120_nameplate.svg')).blur(0.8).jpeg({ quality: 60 }).toBuffer();

  for (const dir of outDirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ESS-2023-98214_field_genuine.jpg'), genuine);
    fs.writeFileSync(path.join(dir, 'ESS-2023-98214_field_SWAPPED.jpg'), swapped);
  }
  console.log('Demo images written:\n - ESS-2023-98214_field_genuine.jpg (expect MATCH)\n - ESS-2023-98214_field_SWAPPED.jpg (expect MISMATCH)');
})();
