// One-off script to generate PWA PNG icons from public/logo.jpg using sharp
const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '..', 'public', 'logo.jpg');
const outDir = path.join(__dirname, '..', 'public', 'icons');

const icons = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

(async () => {
  for (const { name, size } of icons) {
    const dest = path.join(outDir, name);
    await sharp(src)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(dest);
    console.log(`✓ Generated ${name} (${size}x${size})`);
  }
  console.log('All icons generated successfully.');
})();
