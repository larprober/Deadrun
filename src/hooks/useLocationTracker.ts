import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { bearingDelta, facingDeg } from '../geo';
import type { PlayerFix } from '../types';

/**
 * Don't re-render for magnetometer noise. The sensor fires far faster than the
 * screen needs, and every update repaints the map and the radar.
 */
const COMPASS_STEP_DEG = 2;

export type TrackerStatus =
  | 'idle'
  | 'requesting'
  | 'denied'
  | 'disabled'
  | 'acquiring'
  | 'ready'
  | 'error';

export type Tracker = {
  status: TrackerStatus;
  fix: PlayerFix | null;
  /** How many usable satellites-worth of accuracy we have, 0-4, for the HUD. */
  bars: number;
  /**
   * Live compass bearing, -1 until the magnetometer reports. Separate from
   * `fix.heading` on purpose: a fix only arrives when you *move*, so anything
   * that reads heading off the fix freezes the moment you stand still and turn
   * on the spot.
   */
  heading: number;
  error: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
};

function barsFor(accuracy: number): number {
  if (accuracy <= 0) return 0;
  if (accuracy <= 8) return 4;
  if (accuracy <= 16) return 3;
  if (accuracy <= 30) return 2;
  if (accuracy <= 60) return 1;
  return 0;
}

export function useLocationTracker(): Tracker {
  const [status, setStatus] = useState<TrackerStatus>('idle');
  const [fix, setFix] = useState<PlayerFix | null>(null);
  const [heading, setHeading] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);

  const posSub = useRef<Location.LocationSubscription | null>(null);
  const headSub = useRef<Location.LocationSubscription | null>(null);
  /** Compass heading, used when you are too slow for GPS course to mean much. */
  const compass = useRef<number>(-1);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      posSub.current?.remove();
      headSub.current?.remove();
      posSub.current = null;
      headSub.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    posSub.current?.remove();
    headSub.current?.remove();
    posSub.current = null;
    headSub.current = null;
    if (mounted.current) setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus('requesting');

    const enabled = await Location.hasServicesEnabledAsync().catch(() => false);
    if (!enabled) {
      setStatus('disabled');
      setError('Location services are switched off on this device.');
      return false;
    }

    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    if (perm !== 'granted') {
      setStatus('denied');
      setError('DEADRUN needs your location to place the horde around you.');
      return false;
    }

    setStatus('acquiring');
    try {
      posSub.current?.remove();
      posSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (loc) => {
          if (!mounted.current) return;
          const c = loc.coords;
          const gpsHeading = c.heading != null && c.heading >= 0 ? c.heading : -1;
          const speed = c.speed != null && c.speed >= 0 ? c.speed : 0;
          setFix({
            pos: { latitude: c.latitude, longitude: c.longitude },
            accuracy: c.accuracy ?? 999,
            speed,
            heading: facingDeg(speed, gpsHeading, compass.current),
            at: loc.timestamp || Date.now(),
          });
          setStatus('ready');
        }
      );

      headSub.current?.remove();
      headSub.current = await Location.watchHeadingAsync((h) => {
        const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (!mounted.current || value < 0) return;
        compass.current = value;
        // Turning on the spot produces no GPS fix at all, so the compass has to
        // drive its own updates or nothing on screen would ever turn with you.
        setHeading((prev) =>
          prev < 0 || Math.abs(bearingDelta(prev, value)) >= COMPASS_STEP_DEG ? value : prev
        );
      });
      return true;
    } catch (e) {
      if (mounted.current) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Could not start location updates.');
      }
      return false;
    }
  }, []);

  return {
    status,
    fix,
    bars: fix ? barsFor(fix.accuracy) : 0,
    heading,
    error,
    start,
    stop,
  };
}
