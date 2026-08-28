/** Spherical geometry helpers. All distances in metres, all bearings in degrees. */

export type LatLng = { latitude: number; longitude: number };

const EARTH_R = 6371008.8;

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance between two coordinates, in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `a` to `b`, normalised to [0, 360). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point reached by travelling `dist` metres from `origin` along `bearing`. */
export function destination(origin: LatLng, bearing: number, dist: number): LatLng {
  const ang = dist / EARTH_R;
  const brg = toRad(bearing);
  const lat1 = toRad(origin.latitude);
  const lon1 = toRad(origin.longitude);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(brg)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2)
    );
  return {
    latitude: toDeg(lat2),
    longitude: ((toDeg(lon2) + 540) % 360) - 180,
  };
}

/** Step `metres` from `from` toward `to`, never overshooting the target. */
export function moveToward(from: LatLng, to: LatLng, metres: number): LatLng {
  const gap = distanceM(from, to);
  if (gap <= 0.01) return to;
  return destination(from, bearingDeg(from, to), Math.min(metres, gap));
}

/** Signed difference between two bearings, in [-180, 180]. */
export function bearingDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Below a jog, GPS course is mostly noise and the magnetometer wins. */
export const GPS_COURSE_MIN_MS = 1.4;

/**
 * Which way the phone is pointing.
 *
 * GPS reports a course only while you are actually travelling, and it describes
 * where you are *going*, not where you are facing. Standing still it says
 * nothing, so below a jog the compass takes over. That is the difference between
 * the radar knowing which way you are looking and it quietly pointing wherever
 * you happened to be looking at your last position fix.
 */
export function facingDeg(speed: number, fixHeading: number, compass: number): number {
  if (speed > GPS_COURSE_MIN_MS && fixHeading >= 0) return fixHeading;
  if (compass >= 0) return compass;
  return fixHeading >= 0 ? fixHeading : 0;
}

/** Metres-per-degree scale at a given latitude, used to size map viewports. */
export function metresToDelta(metres: number, latitude: number) {
  const latitudeDelta = metres / 111_320;
  const lonScale = Math.max(0.15, Math.cos(toRad(latitude)));
  return { latitudeDelta, longitudeDelta: latitudeDelta / lonScale };
}
