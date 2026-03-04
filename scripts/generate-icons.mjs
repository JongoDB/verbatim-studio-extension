import sharp from 'sharp';
import { mkdirSync } from 'fs';

const sizes = [16, 32, 48, 128];

mkdirSync('public/icons', { recursive: true });

for (const size of sizes) {
  const padding = Math.round(size * 0.1);
  const fontSize = Math.round(size * 0.65);
  const radius = Math.round(size * 0.2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="hsl(217, 68%, 54%)"/>
  <text x="${size / 2}" y="${size * 0.72}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="white">V</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(`public/icons/icon-${size}.png`);

  console.log(`Generated icon-${size}.png`);
}

console.log('All icons generated.');
