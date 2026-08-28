/** One palette for the whole app. Sodium-lamp orange over a dead-city green. */
export const C = {
  void: '#05070A',
  night: '#0A0F14',
  panel: '#111A21',
  panelEdge: '#1D2C36',
  ash: '#7B8A94',
  bone: '#E6EDF1',
  toxic: '#7CFF4F',
  toxicDim: '#3E8E2A',
  sodium: '#FFA033',
  blood: '#FF3B30',
  bloodDeep: '#8C0F14',
  hazard: '#FFD400',
  ice: '#4FC3F7',
} as const;

export const KIND_COLOR = {
  walker: C.toxicDim,
  runner: C.blood,
  brute: C.sodium,
} as const;

export const SUPPLY_COLOR = {
  medkit: C.blood,
  adrenaline: C.hazard,
  flare: C.sodium,
} as const;

export const SUPPLY_LABEL = {
  medkit: 'MEDKIT',
  adrenaline: 'ADRENALINE',
  flare: 'FLARE',
} as const;

export const SUPPLY_EFFECT = {
  medkit: '+1 life',
  adrenaline: 'horde slowed 14s',
  flare: 'burns everything within 70 m',
} as const;

/** Monospace stack that actually exists on both platforms. */
export const MONO = { fontFamily: 'monospace' as const };

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return Math.round(metres) + ' m';
  return (metres / 1000).toFixed(2) + ' km';
}

export function formatPace(metresPerSecond: number): string {
  if (metresPerSecond <= 0.2) return '--:-- /km';
  const secPerKm = 1000 / metresPerSecond;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  if (m > 20) return '--:-- /km';
  return m + ':' + String(s).padStart(2, '0') + ' /km';
}
