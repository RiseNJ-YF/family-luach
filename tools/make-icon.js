/* Draws apple-touch-icon.png (180×180), the home-screen icon: the same little family tree as the
   favicon in src/app.html, full-bleed (iPhones round the corners themselves).
   Run: node tools/make-icon.js */
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const S = 180, K = S / 64, SS = 4;            // design is on a 64-unit grid; 4×4 supersampling
const BLUE = [0x23, 0x57, 0x8C], WHITE = [255, 255, 255], GOLD = [0xF2, 0xC1, 0x4E];
const segs = [[32, 20, 32, 32], [17, 32, 47, 32], [17, 32, 17, 41], [47, 32, 47, 41]]; // stroke 4.5, round caps
const circles = [[32, 15, WHITE], [17, 47, GOLD], [47, 47, GOLD]];                     // r 7.5

function distSeg(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function colorAt(x, y) {                        // x, y in design units
  for (const [cx, cy, c] of circles) if (Math.hypot(x - cx, y - cy) <= 7.5) return c;
  for (const s of segs) if (distSeg(x, y, s) <= 2.25) return WHITE;
  return BLUE;
}

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;                     // PNG filter: none
  for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const c = colorAt((x + (sx + 0.5) / SS) / K, (y + (sy + 0.5) / SS) / K);
      r += c[0]; g += c[1]; b += c[2];
    }
    const o = y * (S * 4 + 1) + 1 + x * 4, n = SS * SS;
    raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n); raw[o + 3] = 255;
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xFFFFFFFF; for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = path.join(__dirname, '..', 'apple-touch-icon.png');
fs.writeFileSync(out, png);
console.log('apple-touch-icon.png written:', png.length, 'bytes');
