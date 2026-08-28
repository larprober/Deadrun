/**
 * Renders every launcher / store image from the DEADRUN mark.
 * Run with:  node scripts/make-icons.js
 *
 * The mark is defined once here as SVG so the app icon, the adaptive icon and
 * the Play Store graphics can never drift apart.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');
const STORE = path.join(OUT, 'store');

const VOID = '#05070A';
const TOXIC = '#7CFF4F';
const TOXIC_DIM = '#3E8E2A';
const BONE = '#E6EDF1';
const BLOOD = '#FF3B30';
const BLOOD_DEEP = '#8C0F14';

/** The badge, drawn in a 100x100 box. */
function mark({ hex = true, mono = false } = {}) {
  const bone = mono ? '#FFFFFF' : BONE;
  // Thin, and drawn behind the figure: the slashes should read as motion
  // across the badge, not as a bar through the runner.
  const claws = mono
    ? ''
    : `<g>
         <path d="M17 19 Q43.8 56.4 84 79 Q57.2 41.6 17 19Z" fill="url(#claw)" opacity="0.9"/>
         <path d="M33 8 Q57 41.8 92 64 Q68 30.2 33 8Z" fill="url(#claw)" opacity="0.6"/>
         <path d="M10 33 Q29.7 66.6 60 91 Q40.3 57.4 10 33Z" fill="url(#claw)" opacity="0.45"/>
       </g>`;
  const hexRing = hex
    ? `<polygon points="50,4 89,26 89,74 50,96 11,74 11,26" fill="none"
         stroke="${mono ? '#FFFFFF' : 'url(#ring)'}" stroke-width="4"/>
       <polygon points="50,13 81,31 81,69 50,87 19,69 19,31" fill="none"
         stroke="${mono ? '#FFFFFF' : TOXIC_DIM}" stroke-width="1.4" opacity="${mono ? 0.5 : 0.55}"/>`
    : '';

  return `
    <defs>
      <linearGradient id="ring" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${TOXIC}"/>
        <stop offset="100%" stop-color="${TOXIC_DIM}"/>
      </linearGradient>
      <linearGradient id="claw" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${BLOOD}"/>
        <stop offset="100%" stop-color="${BLOOD_DEEP}"/>
      </linearGradient>
    </defs>
    ${hexRing}
    ${claws}
    <g stroke="${bone}" stroke-width="6.4" stroke-linecap="round" fill="none">
      <path d="M52 34 L43 54"/>
      <path d="M51 39 L66 42 L72 55"/>
      <path d="M48 41 L34 37 L27 45"/>
      <path d="M43 54 L52 65 L47 80"/>
      <path d="M43 54 L30 60 L21 55"/>
    </g>
    <circle cx="56" cy="26" r="7.6" fill="${bone}"/>`;
}

/** DEADRUN wordmark, drawn in a 260x44 box. */
const WORDMARK = `
  <g fill="#E6EDF1" fill-rule="evenodd">
    <path d="M2 4h16c9 0 14 7 14 18s-5 18-14 18H2Zm10 8v20h5c4 0 6-4 6-10s-2-10-6-10Z"/>
    <path d="M40 4h26v8H50v6h13v8H50v6h16v8H40Z"/>
    <path d="M72 40 83 4h12l11 36H95l-1.6-6h-7.8L84 40Zm15.5-14h3l-1.5-7Z"/>
    <path d="M112 4h16c9 0 14 7 14 18s-5 18-14 18h-16Zm10 8v20h5c4 0 6-4 6-10s-2-10-6-10Z"/>
    <path d="M150 4h17c8 0 13 5 13 12 0 5-2.5 9-6.5 11l7.5 13h-11.5l-6.5-11h-3v11h-10Zm10 8v9h5c2.4 0 4-1.9 4-4.5S167.4 12 165 12Z"/>
    <path d="M188 4h10v23c0 3.2 2 5.2 5 5.2s5-2 5-5.2V4h10v24c0 8.4-6 13.4-15 13.4S188 36.4 188 28Z"/>
    <path d="M224 4h9.5L244 21V4h9.5v36H244l-10.5-17v17H224Z"/>
  </g>`;

function svg(width, height, body) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
  );
}

async function render(file, buffer, size) {
  const target = path.join(path.dirname(file), '');
  fs.mkdirSync(target, { recursive: true });
  await sharp(buffer, { density: 400 }).resize(size.w, size.h).png().toFile(file);
  console.log('  ' + path.relative(path.join(__dirname, '..'), file));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(STORE, { recursive: true });
  console.log('Rendering launcher and store art');

  // Full-bleed app icon: badge on the void, generous margin.
  const icon = svg(
    1024,
    1024,
    `<rect width="1024" height="1024" fill="${VOID}"/>
     <g transform="translate(152 152) scale(7.2)">${mark()}</g>`
  );
  await render(path.join(OUT, 'icon.png'), icon, { w: 1024, h: 1024 });
  await render(path.join(STORE, 'play-icon-512.png'), icon, { w: 512, h: 512 });
  await render(path.join(OUT, 'favicon.png'), icon, { w: 64, h: 64 });

  // Adaptive foreground: Android crops to a circle, so keep the art inside
  // the middle ~66% safe zone.
  const foreground = svg(
    1024,
    1024,
    `<g transform="translate(266 266) scale(4.92)">${mark()}</g>`
  );
  await render(path.join(OUT, 'android-icon-foreground.png'), foreground, {
    w: 1024,
    h: 1024,
  });

  const background = svg(
    1024,
    1024,
    `<rect width="1024" height="1024" fill="${VOID}"/>
     <circle cx="512" cy="512" r="470" fill="#0B1410"/>`
  );
  await render(path.join(OUT, 'android-icon-background.png'), background, {
    w: 1024,
    h: 1024,
  });

  const monochrome = svg(
    1024,
    1024,
    `<g transform="translate(266 266) scale(4.92)">${mark({ mono: true })}</g>`
  );
  await render(path.join(OUT, 'android-icon-monochrome.png'), monochrome, {
    w: 1024,
    h: 1024,
  });

  // Splash: transparent, the plugin paints the background colour behind it.
  const splash = svg(1024, 1024, `<g transform="translate(212 212) scale(6)">${mark()}</g>`);
  await render(path.join(OUT, 'splash-icon.png'), splash, { w: 1024, h: 1024 });

  // Play Store feature graphic, 1024x500, no transparency allowed.
  const feature = svg(
    1024,
    500,
    `<defs>
       <radialGradient id="glow" cx="26%" cy="50%" r="62%">
         <stop offset="0%" stop-color="#122016"/>
         <stop offset="100%" stop-color="${VOID}"/>
       </radialGradient>
     </defs>
     <rect width="1024" height="500" fill="url(#glow)"/>
     <g transform="translate(74 130) scale(2.4)">${mark()}</g>
     <g transform="translate(370 196) scale(1.5)">${WORDMARK}</g>
     <text x="370" y="300" fill="${TOXIC_DIM}" font-family="monospace" font-size="21"
       letter-spacing="4.4">THEY SPAWN WHERE YOU STAND</text>
     <text x="370" y="344" fill="#7B8A94" font-family="monospace" font-size="17"
       letter-spacing="1.2">A GPS chase game. Real streets. Real running.</text>`
  );
  await render(path.join(STORE, 'play-feature-graphic.png'), feature, { w: 1024, h: 500 });

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
