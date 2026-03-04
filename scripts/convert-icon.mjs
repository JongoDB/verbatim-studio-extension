import { readFileSync } from 'fs';
import sharp from 'sharp';

// ICNS files contain chunks with 4-byte type, 4-byte length, then data.
// Larger icons (128x128+) are stored as embedded PNGs.
// We find the largest embedded PNG and resize from that.

const buf = readFileSync('/tmp/icon.icns');

// Find all embedded PNGs (PNG magic: 89 50 4E 47)
const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const pngs = [];

for (let i = 0; i < buf.length - 4; i++) {
  if (buf[i] === 0x89 && buf[i+1] === 0x50 && buf[i+2] === 0x4e && buf[i+3] === 0x47) {
    // Find the end - look for next icns chunk or EOF
    // PNG files end with IEND chunk: 00 00 00 00 49 45 4E 44 AE 42 60 82
    const iend = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    let end = buf.indexOf(iend, i);
    if (end !== -1) {
      end += iend.length;
      const pngBuf = buf.subarray(i, end);
      pngs.push(pngBuf);
      console.log(`Found PNG at offset ${i}, size ${pngBuf.length} bytes`);
    }
  }
}

if (pngs.length === 0) {
  console.error('No embedded PNGs found in ICNS file');
  process.exit(1);
}

// Use the largest PNG as source
const largest = pngs.reduce((a, b) => a.length > b.length ? a : b);
console.log(`Using largest PNG: ${largest.length} bytes`);

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  await sharp(largest)
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`Generated icon-${size}.png`);
}

console.log('Done.');
