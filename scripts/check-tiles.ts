/**
 * Sanity-checks the map projection against the real tile server.
 *
 * The map is hand-rolled now, so nothing else catches a sign flip or an
 * off-by-one in the tile index — the symptom would be a map of the wrong
 * city, discovered outdoors, mid-run.
 *
 *   npm run check:tiles
 */
import { destination, distanceM, facingDeg, type LatLng } from '../src/geo';
import {
  metresPerPixel,
  metresToPx,
  project,
  TILE_DRAW,
  TILE_SCALE,
  TILE_SIZE,
  RETINA,
  TILE_ZOOM,
  tileCount,
  tileUrl,
  tileWindow,
  followCamera,
  screenPos,
  DRIFT_Y,
  VIEW_ZOOM,
} from '../src/tiles';

let failures = 0;

function check(name: string, ok: boolean, detail = '') {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

function near(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol;
}

/** The textbook slippy-map formula, written independently of src/tiles.ts. */
function referenceTile(p: LatLng, z: number) {
  const n = Math.pow(2, z);
  const rad = (p.latitude * Math.PI) / 180;
  return {
    x: Math.floor(((p.longitude + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
}

const PLACES: { name: string; at: LatLng }[] = [
  { name: 'Galata Tower', at: { latitude: 41.0256, longitude: 28.9744 } },
  { name: 'Null Island', at: { latitude: 0, longitude: 0 } },
  { name: 'Sydney Opera House', at: { latitude: -33.8568, longitude: 151.2153 } },
  { name: 'Reykjavik', at: { latitude: 64.1466, longitude: -21.9426 } },
];

console.log('\nprojection');
for (const place of PLACES) {
  const p = project(place.at);
  const mine = { x: Math.floor(p.x / TILE_SIZE), y: Math.floor(p.y / TILE_SIZE) };
  const ref = referenceTile(place.at, TILE_ZOOM);
  check(
    place.name + ' lands on the right tile',
    mine.x === ref.x && mine.y === ref.y,
    'z' + TILE_ZOOM + ' ' + mine.x + '/' + mine.y
  );
}

const origin = project({ latitude: 0, longitude: 0 });
const world = TILE_SIZE * Math.pow(2, TILE_ZOOM);
check('null island sits at the world centre', near(origin.x, world / 2, 0.5) && near(origin.y, world / 2, 0.5));

console.log('\nscale');
const lat = 41.0256;
const mpp = metresPerPixel(lat);
check('one dp is a sane number of metres', mpp > 0.4 && mpp < 1.2, mpp.toFixed(3) + ' m/dp');
// Whatever zoom the rasters come from, they must not end up stretched below
// screen-logical resolution, or the streets go to mush.
const rasterPx = TILE_SIZE * (RETINA ? 2 : 1);
const pxPerDp = rasterPx / TILE_DRAW;
check('tiles keep at least one raster pixel per dp', pxPerDp >= 1,
  pxPerDp.toFixed(2) + ' px/dp, zoom ' + VIEW_ZOOM + ' from z' + TILE_ZOOM + (RETINA ? ' @2x' : '') + ' rasters');

// A point 100 m north should land 100 m worth of pixels up the screen, and the
// screen's y axis must run the opposite way to latitude.
const here = { latitude: lat, longitude: 28.9744 };
const north = destination(here, 0, 100);
const east = destination(here, 90, 100);
const pHere = project(here);
const pNorth = project(north);
const pEast = project(east);
const dyPx = (pNorth.y - pHere.y) * TILE_SCALE;
const dxPx = (pEast.x - pHere.x) * TILE_SCALE;
check('100 m north is 100 m of pixels, upward', near(dyPx, -metresToPx(100, lat), 1.5), dyPx.toFixed(1) + ' dp');
check('100 m east is 100 m of pixels, rightward', near(dxPx, metresToPx(100, lat), 1.5), dxPx.toFixed(1) + ' dp');

// Spawn distances have to be reachable on screen or the game is unplayable.
const spawn = metresToPx(175, lat);
check('a 175 m spawn fits on a phone screen', spawn < 420, Math.round(spawn) + ' dp from centre');

console.log('\ntile budget');
// Every tile in the window is an image view and an HTTPS request, on a phone
// that is also running the horde, the GPS and the audio. Keep it honest: this
// mirrors what MapCanvas asks for on a mid-size phone screen.
const MARGIN_DP = 120;
const SCREEN = { w: 411, h: 867 };
const centre = project(here);

for (const mode of ['north', 'course'] as const) {
  const spun = mode === 'course';
  const half = Math.hypot(SCREEN.w, SCREEN.h) / 2;
  const rx = (spun ? half : SCREEN.w / 2) + MARGIN_DP;
  const ry = (spun ? half : SCREEN.h / 2) + MARGIN_DP;
  const w = tileWindow(centre, rx, ry);
  const n = tileCount(w);
  const cols = w.maxTx - w.minTx + 1;
  const rows = w.maxTy - w.minTy + 1;
  check(mode + '-up stays under 30 tiles', n <= 30, cols + 'x' + rows + ' = ' + n + ' tiles');

  // The window has to actually cover the screen, margin included, or corners
  // show bare grid while the camera catches up.
  const coveredX = (w.maxTx + 1) * TILE_SIZE * TILE_SCALE - centre.x * TILE_SCALE;
  const coveredY = (w.maxTy + 1) * TILE_SIZE * TILE_SCALE - centre.y * TILE_SCALE;
  check(mode + '-up covers the screen plus margin', coveredX >= rx && coveredY >= ry,
    Math.round(coveredX) + '/' + Math.round(coveredY) + ' dp vs ' + Math.round(rx) + '/' + Math.round(ry));
}

console.log('\ncamera');
// The reported bug was "the arrow doesn't move". It could not: the camera was
// welded to the player, so the glyph sat at the exact centre of the screen for
// ever and looked identical whether GPS was perfect or dead. Walk a runner up a
// street and insist the arrow actually travels across the screen.
{
  let cam = project(here);
  const start = screenPos(cam, cam, SCREEN);
  let at = here;
  const seen: number[] = [];
  let leftScreen = false;

  // 60 fixes of a 3 m/s runner heading north-east: three minutes, 540 m.
  for (let i = 0; i < 60; i++) {
    at = destination(at, 45, 3);
    const p = project(at);
    cam = followCamera(cam, p, SCREEN);
    const s = screenPos(p, cam, SCREEN);
    seen.push(s.y);
    if (s.x < 0 || s.x > SCREEN.w || s.y < 0 || s.y > SCREEN.h) leftScreen = true;
  }

  const travelled = Math.max(...seen.map((y) => Math.abs(y - start.y)));
  check('the arrow actually moves on screen', travelled > 40, Math.round(travelled) + ' dp of travel');
  check('the arrow never leaves the screen', !leftScreen);

  // And it must settle rather than drift away for ever.
  const finalOffset = Math.abs(seen[seen.length - 1] - SCREEN.h / 2);
  check('the map takes over before the edge', finalOffset <= SCREEN.h * DRIFT_Y + 1,
    Math.round(finalOffset) + ' dp from centre, limit ' + Math.round(SCREEN.h * DRIFT_Y));
}

// Standing still must not creep. GPS jitter of a couple of metres should leave
// the camera exactly where it was, or the map would wander while you rest.
{
  const cam0 = project(here);
  let cam = cam0;
  for (let i = 0; i < 20; i++) {
    cam = followCamera(cam, project(destination(here, i * 37, 2)), SCREEN);
  }
  check('the map holds still when you do', cam === cam0);
}

console.log('\nfacing');
// GPS course says where you are *going*; it says nothing at all when you are
// standing still. If the compass does not take over below a jog, the radar and
// every direction arrow keep pointing wherever you were looking at your last
// position fix — which is the bug this exists to prevent coming back.
check('standing still, the compass decides', facingDeg(0, 90, 270) === 270);
check('walking slowly, the compass still decides', facingDeg(1.0, 90, 270) === 270);
check('running, the GPS course wins', facingDeg(3.0, 90, 270) === 90);
check('no compass yet, fall back to the fix', facingDeg(0, 90, -1) === 90);
check('nothing known at all is due north', facingDeg(0, -1, -1) === 0);
check('a still runner turning on the spot turns the display',
  facingDeg(0, 90, 0) !== facingDeg(0, 90, 180),
  'compass 0 vs 180 gives ' + facingDeg(0, 90, 0) + ' vs ' + facingDeg(0, 90, 180));

console.log('\ntile server');
// Metro inlines EXPO_PUBLIC_* from .env when it bundles; tsx does not, so read
// the file directly just to report which way a real build would come out.
try {
  process.loadEnvFile('.env');
} catch {
  /* no .env, which is the unkeyed case */
}
console.log(
  process.env.EXPO_PUBLIC_CARTO_KEY
    ? '  note   CARTO key configured — built tiles come back clean'
    : '  note   no CARTO key — built tiles are stamped "API KEY REQUIRED" (see .env.example)'
);

async function fetchTile(p: LatLng, label: string, expectBusy: boolean) {
  const q = project(p);
  const url = tileUrl(Math.floor(q.x / TILE_SIZE), Math.floor(q.y / TILE_SIZE));
  const res = await fetch(url);
  const bytes = (await res.arrayBuffer()).byteLength;
  const png = res.headers.get('content-type') === 'image/png';
  check(
    label + ' tile downloads',
    res.ok && png && (expectBusy ? bytes > 3000 : true),
    res.status + ' ' + bytes + ' B'
  );
  return bytes;
}

(async () => {
  const city = await fetchTile(PLACES[0].at, 'Galata Tower', true);
  const ocean = await fetchTile({ latitude: -30, longitude: -140 }, 'open Pacific', false);
  // If the indexing were wrong, a downtown tile would come back as blank as
  // the middle of the ocean.
  check('a city tile carries more detail than open ocean', city > ocean * 2,
    city + ' B vs ' + ocean + ' B');

  console.log('\n' + (failures ? failures + ' FAILED' : 'all checks passed') + '\n');
  process.exit(failures ? 1 : 0);
})();
