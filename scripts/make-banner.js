/**
 * Renders the repo banner.  node scripts/make-banner.js
 *
 * Not a logo on a rectangle: the banner draws the game itself — a street grid,
 * a GPS trace turning corners along it, the runner with their facing cone, and
 * the horde closing in. Same palette and same mark as the app, so the two never
 * drift apart.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');

const VOID = '#05070A';
const NIGHT = '#0A0F14';
const PANEL_EDGE = '#1D2C36';
const TOXIC = '#7CFF4F';
const TOXIC_DIM = '#3E8E2A';
const SODIUM = '#FFA033';
const BLOOD = '#FF3B30';
const BLOOD_DEEP = '#8C0F14';
const ICE = '#4FC3F7';
const BONE = '#E6EDF1';
const ASH = '#7B8A94';

const W = 1280;
const H = 400;

/** Irregular spacing reads as a city; even spacing reads as graph paper. */
const V_STREETS = [40, 96, 168, 212, 300, 356, 424, 470, 540, 596, 668, 712, 790, 868, 924, 980, 1052, 1120, 1176, 1240];
const H_STREETS = [36, 88, 140, 178, 212, 244, 300, 336, 372];
const AVENUES = [212, 712, 1052];

function streets() {
  const parts = [];
  for (const x of V_STREETS) {
    const main = AVENUES.includes(x);
    parts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${PANEL_EDGE}" ` +
        `stroke-width="${main ? 3 : 1.3}" opacity="${main ? 0.95 : 0.6}"/>`
    );
  }
  for (const y of H_STREETS) {
    const main = y === 244;
    parts.push(
      `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${PANEL_EDGE}" ` +
        `stroke-width="${main ? 3 : 1.3}" opacity="${main ? 0.95 : 0.6}"/>`
    );
  }
  // A diagonal cut, the way real cities have one road that ignores the grid.
  parts.push(
    `<line x1="600" y1="${H}" x2="1080" y2="0" stroke="${PANEL_EDGE}" stroke-width="2.4" opacity="0.75"/>`
  );
  return parts.join('');
}

/** A few filled blocks so the grid reads as buildings, not as a wireframe. */
function blocks() {
  const b = [
    [96, 36, 72, 52], [300, 88, 56, 52], [424, 140, 46, 38], [596, 36, 72, 52],
    [790, 88, 78, 52], [924, 140, 56, 38], [1120, 36, 56, 52], [212, 300, 88, 36],
    [712, 300, 78, 36], [980, 244, 72, 56], [356, 178, 68, 34], [1176, 212, 64, 32],
  ];
  return b
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${NIGHT}" opacity="0.75"/>`)
    .join('');
}

// The trace turns corners along the grid, because that is what a GPS track of
// someone running through streets actually looks like.
const TRAIL =
  'M 424 372 L 424 336 L 540 336 L 540 300 L 712 300 L 712 244 L 868 244 L 868 212 L 980 212';
const PX = 980;
const PY = 212;

/** Where the horde is, and how big each one draws. */
const HORDE = [
  { x: 1120, y: 140, r: 7, c: BLOOD, lead: true },
  { x: 1052, y: 300, r: 6, c: TOXIC_DIM, lead: true },
  { x: 868, y: 120, r: 8.5, c: SODIUM, lead: true },
  { x: 1176, y: 244, r: 5.5, c: BLOOD },
  { x: 790, y: 178, r: 5, c: TOXIC_DIM },
  { x: 1240, y: 88, r: 4.5, c: TOXIC_DIM },
  { x: 712, y: 140, r: 4, c: BLOOD },
];

function horde() {
  return HORDE.map((z) => {
    // A dashed vector toward the runner, on the close ones only.
    const dx = PX - z.x;
    const dy = PY - z.y;
    const len = Math.hypot(dx, dy);
    const gap = z.r + 6;
    const stop = Math.min(74, len - 58);
    const vector =
      z.lead && stop > gap
        ? `<line x1="${(z.x + (dx / len) * gap).toFixed(1)}" y1="${(z.y + (dy / len) * gap).toFixed(1)}"
             x2="${(z.x + (dx / len) * stop).toFixed(1)}" y2="${(z.y + (dy / len) * stop).toFixed(1)}"
             stroke="${z.c}" stroke-width="1.6" stroke-dasharray="4 5" opacity="0.5"/>`
        : '';
    return `${vector}
      <circle cx="${z.x}" cy="${z.y}" r="${z.r + 7}" fill="${z.c}" opacity="0.12"/>
      <circle cx="${z.x}" cy="${z.y}" r="${z.r}" fill="${z.c}"/>
      <circle cx="${z.x}" cy="${z.y}" r="${z.r}" fill="none" stroke="${VOID}" stroke-width="1.4" opacity="0.5"/>`;
  }).join('');
}

/** The hex badge from the app, drawn in a 100x100 box. */
const MARK = `
  <polygon points="50,4 89,26 89,74 50,96 11,74 11,26" fill="${VOID}"/>
  <polygon points="50,4 89,26 89,74 50,96 11,74 11,26" fill="none" stroke="url(#ring)" stroke-width="4"/>
  <polygon points="50,13 81,31 81,69 50,87 19,69 19,31" fill="none" stroke="${TOXIC_DIM}" stroke-width="1.4" opacity="0.55"/>
  <g fill="url(#claw)">
    <path d="M17 19 Q43.8 56.4 84 79 Q57.2 41.6 17 19Z" opacity="0.9"/>
    <path d="M33 8 Q57 41.8 92 64 Q68 30.2 33 8Z" opacity="0.6"/>
    <path d="M10 33 Q29.7 66.6 60 91 Q40.3 57.4 10 33Z" opacity="0.45"/>
  </g>
  <g stroke="${BONE}" stroke-width="6.4" stroke-linecap="round" fill="none">
    <path d="M52 34 L43 54"/><path d="M51 39 L66 42 L72 55"/><path d="M48 41 L34 37 L27 45"/>
    <path d="M43 54 L52 65 L47 80"/><path d="M43 54 L30 60 L21 55"/>
  </g>
  <circle cx="56" cy="26" r="7.6" fill="${BONE}"/>`;

/** DEADRUN, drawn in a 260x44 box. Paths, so no font has to be installed. */
const WORDMARK = `
  <g fill="url(#wm)" fill-rule="evenodd">
    <path d="M2 4h16c9 0 14 7 14 18s-5 18-14 18H2Zm10 8v20h5c4 0 6-4 6-10s-2-10-6-10Z"/>
    <path d="M40 4h26v8H50v6h13v8H50v6h16v8H40Z"/>
    <path d="M72 40 83 4h12l11 36H95l-1.6-6h-7.8L84 40Zm15.5-14h3l-1.5-7Z"/>
    <path d="M112 4h16c9 0 14 7 14 18s-5 18-14 18h-16Zm10 8v20h5c4 0 6-4 6-10s-2-10-6-10Z"/>
    <path d="M150 4h17c8 0 13 5 13 12 0 5-2.5 9-6.5 11l7.5 13h-11.5l-6.5-11h-3v11h-10Zm10 8v9h5c2.4 0 4-1.9 4-4.5S167.4 12 165 12Z"/>
    <path d="M188 4h10v23c0 3.2 2 5.2 5 5.2s5-2 5-5.2V4h10v24c0 8.4-6 13.4-15 13.4S188 36.4 188 28Z"/>
    <path d="M224 4h9.5L244 21V4h9.5v36H244l-10.5-17v17H224Z"/>
  </g>`;

/** Small caps rendered as paths would be overkill; these are plain rects. */
function rule(x, y, w, color, opacity) {
  return `<rect x="${x}" y="${y}" width="${w}" height="2" fill="${color}" opacity="${opacity}"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="ring" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${TOXIC}"/><stop offset="100%" stop-color="${TOXIC_DIM}"/>
    </linearGradient>
    <linearGradient id="claw" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BLOOD}"/><stop offset="100%" stop-color="${BLOOD_DEEP}"/>
    </linearGradient>
    <linearGradient id="wm" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${BONE}"/><stop offset="55%" stop-color="${BONE}"/>
      <stop offset="100%" stop-color="${BLOOD}"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${VOID}" stop-opacity="1"/>
      <stop offset="36%" stop-color="${VOID}" stop-opacity="0.92"/>
      <stop offset="64%" stop-color="${VOID}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
      <stop offset="62%" stop-color="${VOID}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${VOID}" stop-opacity="0.82"/>
    </radialGradient>
    <radialGradient id="cone" cx="0%" cy="50%" r="100%">
      <stop offset="0%" stop-color="${ICE}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${ICE}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pglow" cx="50%" cy="50%" r="50%">
      <stop offset="30%" stop-color="${ICE}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${ICE}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${VOID}"/>
  ${blocks()}
  ${streets()}

  <!-- the run so far -->
  <path d="${TRAIL}" fill="none" stroke="${ICE}" stroke-width="11" opacity="0.14"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${TRAIL}" fill="none" stroke="${ICE}" stroke-width="3.4" opacity="0.95"
        stroke-linecap="round" stroke-linejoin="round"/>

  <!-- proximity ring -->
  <circle cx="${PX}" cy="${PY}" r="66" fill="rgba(255,59,48,0.05)" stroke="rgba(255,59,48,0.38)" stroke-width="1.3"/>

  ${horde()}

  <!-- the runner, facing the way they are travelling -->
  <path d="M ${PX} ${PY} L ${PX + 96} ${PY - 47} A 107 107 0 0 1 ${PX + 96} ${PY + 47} Z"
        fill="url(#cone)"/>
  <circle cx="${PX}" cy="${PY}" r="26" fill="url(#pglow)"/>
  <circle cx="${PX}" cy="${PY}" r="11" fill="${VOID}" opacity="0.9"/>
  <g transform="translate(${PX} ${PY}) rotate(90)">
    <path d="M0 -11 L8 8 L0 3.6 L-8 8 Z" fill="${ICE}"/>
    <path d="M0 -11 L8 8 L0 3.6 Z" fill="${BONE}" opacity="0.85"/>
  </g>

  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>

  <!-- identity -->
  <g transform="translate(64 148) scale(0.92)">${MARK}</g>
  <g transform="translate(186 152) scale(1.32)">${WORDMARK}</g>
  ${rule(188, 246, 344, TOXIC, 0.85)}
  ${rule(188, 246, 96, BLOOD, 0.95)}
  <text x="188" y="284" font-family="Consolas, 'DejaVu Sans Mono', 'Courier New', monospace"
        font-size="17" letter-spacing="1.6" fill="${ASH}">The horde spawns on your real streets.</text>
  <text x="188" y="310" font-family="Consolas, 'DejaVu Sans Mono', 'Courier New', monospace"
        font-size="17" letter-spacing="1.6" fill="${TOXIC}">You escape by running.</text>
</svg>`;

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, 'banner.png'))
  .then((info) => {
    console.log('assets/banner.png  ' + info.width + 'x' + info.height + '  ' + (info.size / 1024).toFixed(0) + ' KB');
    fs.writeFileSync(path.join(OUT, 'banner.svg'), svg);
    console.log('assets/banner.svg  source');
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
