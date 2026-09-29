// App icons for the site edition, drawn as vectors in the game's style and encoded as PNG with
// node:zlib only, so the build stays dependency-free and reproducible. The ship is the game's own
// wireframe (render.js ship()), heading for an amber NAV-7 waypoint on a faint orbit.
import { deflateSync } from 'node:zlib';

const GROUND = [0x14, 0x16, 0x1f];   // Slate --hh-ground
const YOU = [0xb0, 0xa6, 0xff];      // pilot periwinkle (render.js COL.you)
const NAV = [0xe8, 0xb5, 0x76];      // NAV-7 amber (COL.nav)
const DIM = [0x3a, 0x40, 0x60];      // COL.dim
const SHIP = [[11, 0], [-7, -7], [-3, 0], [-7, 7]];

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Unit-square geometry. Maskable icons keep everything inside the 0.4-radius safe zone.
function scene(maskable) {
  const k = maskable ? 0.019 : 0.024, ring = maskable ? 0.31 : 0.39, ang = -Math.PI / 4;
  const c = Math.cos(ang), s = Math.sin(ang);
  const pts = SHIP.map(([x, y]) => [0.5 + (x - 2) * k * c - y * k * s, 0.5 + (x - 2) * k * s + y * k * c]);
  const segs = pts.map((p, i) => [...p, ...pts[(i + 1) % pts.length]]);
  const way = [0.5 + ring * Math.cos(ang), 0.5 + ring * Math.sin(ang)];
  return { segs, ring, way };
}

function render(size, maskable) {
  const { segs, ring, way } = scene(maskable);
  const px = 1 / size, half = Math.max(0.0075, 1.1 * px), ringHalf = Math.max(0.003, 0.6 * px);
  const rows = Buffer.alloc((size * 3 + 1) * size);
  for (let j = 0; j < size; j++) {
    rows[j * (size * 3 + 1)] = 0; // filter: none
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) / size, y = (j + 0.5) / size;
      const col = GROUND.slice();
      const add = (rgb, a) => { for (let q = 0; q < 3; q++) col[q] += (rgb[q] - col[q]) * Math.min(1, a); };
      const cover = (d, hw) => Math.max(0, Math.min(1, (hw - d) / px + 0.5));
      add(DIM, cover(Math.abs(Math.hypot(x - 0.5, y - 0.5) - ring), ringHalf));
      const dw = Math.hypot(x - way[0], y - way[1]);
      add(NAV, 0.45 * Math.exp(-((dw / 0.045) ** 2)));
      add(NAV, cover(dw, 0.022));
      let d = Infinity;
      for (const sg of segs) d = Math.min(d, segDist(x, y, ...sg));
      add(YOU, 0.4 * Math.exp(-((d / 0.03) ** 2)));
      add(YOU, cover(d, half));
      const o = j * (size * 3 + 1) + 1 + i * 3;
      rows[o] = Math.round(col[0]); rows[o + 1] = Math.round(col[1]); rows[o + 2] = Math.round(col[2]);
    }
  }
  return png(size, size, rows);
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rows) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const ICONS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
];
export const drawIcon = (icon) => render(icon.size, icon.maskable);
