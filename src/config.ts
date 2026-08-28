import type { Difficulty } from './types';

/** Engine tick rate. The GPS updates slower than this; zombies are interpolated. */
export const TICK_MS = 400;

/** How long a wave lasts before the next one spawns. */
export const WAVE_MS = 45_000;

/** A fix worse than this is treated as unusable for scoring or collision. */
export const MAX_USABLE_ACCURACY_M = 40;

/** GPS jitter floor: movement below this is noise, not running. */
export const MIN_STEP_M = 2.5;

/** Sustained speed above this means a vehicle, not legs (m/s ~= 32 km/h). */
export const VEHICLE_SPEED_MS = 9;
/** Time at vehicle speed before the run is voided. */
export const VEHICLE_GRACE_MS = 12_000;

/** Distance at which a supply drop is collected. */
export const PICKUP_RADIUS_M = 14;
/** Supply drops land this far away, so you have to commit to a direction. */
export const SUPPLY_MIN_M = 70;
export const SUPPLY_MAX_M = 140;
export const SUPPLY_LIFETIME_MS = 75_000;
export const SUPPLY_COOLDOWN_MS = 20_000;

/** Zombies that fall this far behind lose the scent. */
export const DESPAWN_M = 420;

/** Grace window after taking a hit. */
export const INVULNERABLE_MS = 5_000;
export const ADRENALINE_MS = 14_000;
/** Flares clear everything inside this radius. */
export const FLARE_RADIUS_M = 70;

/** Warn the player when the nearest zombie is inside this ring. */
export const PROXIMITY_WARN_M = 45;

export const MAX_ZOMBIES = 26;

export type DifficultyProfile = {
  key: Difficulty;
  label: string;
  blurb: string;
  lives: number;
  /** base horde speed in m/s at wave 1 */
  baseSpeed: number;
  /** m/s added per wave */
  speedPerWave: number;
  /** hard ceiling on horde speed */
  maxSpeed: number;
  /** zombies added on wave 1 */
  baseSpawn: number;
  /** extra zombies added per wave */
  spawnPerWave: number;
  spawnMinM: number;
  spawnMaxM: number;
  /** how many of each wave spawn in your path instead of behind you */
  ambushFrom: number;
  scoreMultiplier: number;
};

export const DIFFICULTIES: Record<Difficulty, DifficultyProfile> = {
  shambler: {
    key: 'shambler',
    label: 'Shambler',
    blurb: 'A brisk walk keeps you alive. Learn the map.',
    lives: 3,
    baseSpeed: 1.1,
    speedPerWave: 0.1,
    maxSpeed: 3.0,
    baseSpawn: 2,
    spawnPerWave: 1,
    spawnMinM: 130,
    spawnMaxM: 200,
    ambushFrom: 4,
    scoreMultiplier: 1,
  },
  runner: {
    key: 'runner',
    label: 'Runner',
    blurb: 'They jog. So do you. Standard outbreak.',
    lives: 3,
    baseSpeed: 1.5,
    speedPerWave: 0.14,
    maxSpeed: 3.7,
    baseSpawn: 3,
    spawnPerWave: 1,
    spawnMinM: 110,
    spawnMaxM: 175,
    ambushFrom: 3,
    scoreMultiplier: 1.5,
  },
  nightmare: {
    key: 'nightmare',
    label: 'Nightmare',
    blurb: 'They are faster than you. Plan every corner.',
    lives: 2,
    baseSpeed: 1.9,
    speedPerWave: 0.18,
    maxSpeed: 4.4,
    baseSpawn: 4,
    spawnPerWave: 2,
    spawnMinM: 95,
    spawnMaxM: 150,
    ambushFrom: 2,
    scoreMultiplier: 2.25,
  },
};

export const KIND_STATS: Record<
  string,
  { speedMul: number; reach: number; lifetimeMs: number | null }
> = {
  walker: { speedMul: 0.85, reach: 11, lifetimeMs: null },
  runner: { speedMul: 1.35, reach: 9, lifetimeMs: 70_000 },
  brute: { speedMul: 0.7, reach: 20, lifetimeMs: null },
};
