/**
 * Web Mercator plumbing, plus the basemap DEADRUN draws its streets on.
 *
 * The tiles are CARTO's dark basemap rendered from OpenStreetMap data. They
 * need no API key, no billing account and no Play Services, which is the whole
 * reason this file exists instead of a `react-native-maps` MapView: a Google
 * Maps key would have made the app unbuildable without a card on file, and
 * blank until one was pasted in.
 */
import { toRad, type LatLng } from './geo';

/** Tile side in projection units. The @2x rasters are 512 px of the same ground. */
export const TILE_SIZE = 256;

/** Integer zoom of the rasters we fetch. */
export const TILE_ZOOM = 17;
/** Zoom the player actually sees. */
export const VIEW_ZOOM = 17.4;
/**
 * Retina rasters at one zoom below the view, rather than plain rasters at the
 * zoom above: identical sharpness on a 3x screen for a quarter of the tiles,
 * which matters most in course-up, where the layer spins and every corner of
 * the viewport has to stay covered at any angle.
 */
export const RETINA = true;
/** Side of one drawn tile, in dp. */
export const TILE_SCALE = Math.pow(2, VIEW_ZOOM - TILE_ZOOM);
export const TILE_DRAW = TILE_SIZE * TILE_SCALE;

export const TILE_COUNT = Math.pow(2, TILE_ZOOM);
const WORLD_PX = TILE_SIZE * TILE_COUNT;
/** Mercator blows up at the poles; clamp where every tile server clamps. */
const MAX_LAT = 85.05112878;

const SUBDOMAINS = ['a', 'b', 'c', 'd'];

/**
 * CARTO gives basemap keys away: a form at https://carto.com/basemaps/apikey,
 * emailed straight back, no account and no card, 5 million tiles a month.
 *
 * Without one the tiles still load and the game plays exactly the same, but
 * every tile arrives with "API KEY REQUIRED" printed diagonally across it.
 * Put the key in a `.env` file at the project root and rebuild:
 *
 *     EXPO_PUBLIC_CARTO_KEY=your_key_here
 *
 * Expo inlines `EXPO_PUBLIC_*` at bundle time, so nothing reads it at runtime.
 */
const CARTO_KEY = process.env.EXPO_PUBLIC_CARTO_KEY ?? '';

/** True when tiles will come back stamped, i.e. no key was configured. */
export const TILES_WATERMARKED = CARTO_KEY.length === 0;

export type Point = { x: number; y: number };

/** Lat/lng to absolute pixel coordinates at `TILE_ZOOM`. */
export function project(p: LatLng): Point {
  const lat = Math.min(MAX_LAT, Math.max(-MAX_LAT, p.latitude));
  const s = Math.sin(toRad(lat));
  return {
    x: ((p.longitude + 180) / 360) * WORLD_PX,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD_PX,
  };
}

/** Ground metres covered by one on-screen dp at this latitude. */
export function metresPerPixel(latitude: number): number {
  return (156_543.03392 * Math.cos(toRad(latitude))) / Math.pow(2, VIEW_ZOOM);
}

/** Metres to on-screen dp, for drawing radii that mean something in the world. */
export function metresToPx(metres: number, latitude: number): number {
  return metres / metresPerPixel(latitude);
}

export type TileWindow = { minTx: number; maxTx: number; minTy: number; maxTy: number };

/**
 * The block of tiles needed to cover `reachX` by `reachY` dp either side of a
 * centre point. Shared with the tile-budget check in `scripts/check-tiles.ts`,
 * because "how many images is the map about to ask for" is worth pinning down.
 */
export function tileWindow(centre: Point, reachX: number, reachY: number): TileWindow {
  return {
    minTx: Math.floor((centre.x - reachX / TILE_SCALE) / TILE_SIZE),
    maxTx: Math.floor((centre.x + reachX / TILE_SCALE) / TILE_SIZE),
    minTy: Math.floor((centre.y - reachY / TILE_SCALE) / TILE_SIZE),
    maxTy: Math.floor((centre.y + reachY / TILE_SCALE) / TILE_SIZE),
  };
}

export function tileCount(w: TileWindow): number {
  return (w.maxTx - w.minTx + 1) * (w.maxTy - w.minTy + 1);
}

/**
 * How far the runner may drift from the middle of the screen before the map
 * starts pushing back, as a fraction of the screen.
 *
 * A camera welded to the player looks exactly like a frozen one: the arrow sits
 * dead centre and only the map slides, so there is no way to tell a good GPS fix
 * from a dead one by looking at yourself.
 */
export const DRIFT_X = 0.16;
export const DRIFT_Y = 0.12;

/**
 * Where the camera should sit, given where it is now and where the runner has
 * got to. Returns the same object when nothing needs to move, so React can skip
 * the render. Pure, so `npm run check:tiles` can prove the arrow travels
 * without anyone going outside.
 */
export function followCamera(
  cam: Point,
  player: Point,
  screen: { w: number; h: number }
): Point {
  const limX = screen.w * DRIFT_X;
  const limY = screen.h * DRIFT_Y;
  const dx = (player.x - cam.x) * TILE_SCALE;
  const dy = (player.y - cam.y) * TILE_SCALE;
  let { x, y } = cam;
  // Push only as far as it takes to get back inside the box, so the map moves
  // in step with you rather than snapping.
  if (Math.abs(dx) > limX) x = player.x - (Math.sign(dx) * limX) / TILE_SCALE;
  if (Math.abs(dy) > limY) y = player.y - (Math.sign(dy) * limY) / TILE_SCALE;
  return x === cam.x && y === cam.y ? cam : { x, y };
}

/** Where a world point lands on screen, in dp, for a given camera. */
export function screenPos(p: Point, cam: Point, screen: { w: number; h: number }): Point {
  return {
    x: screen.w / 2 + (p.x - cam.x) * TILE_SCALE,
    y: screen.h / 2 + (p.y - cam.y) * TILE_SCALE,
  };
}

export function tileUrl(x: number, y: number, z: number = TILE_ZOOM): string {
  const n = Math.pow(2, z);
  // Wrap east/west so running across the antimeridian still draws.
  const wx = ((x % n) + n) % n;
  const sub = SUBDOMAINS[(wx + y) % SUBDOMAINS.length];
  const scale = RETINA ? '@2x' : '';
  const key = CARTO_KEY ? '?key=' + encodeURIComponent(CARTO_KEY) : '';
  return (
    'https://' +
    sub +
    '.basemaps.cartocdn.com/dark_all/' +
    z +
    '/' +
    wx +
    '/' +
    y +
    scale +
    '.png' +
    key
  );
}

/** Required by both OpenStreetMap's licence and CARTO's terms. Keep it visible. */
export const ATTRIBUTION = '© OpenStreetMap  ·  © CARTO';
