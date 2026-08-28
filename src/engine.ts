/**
 * The horde simulation. Pure: every call takes state in and hands state out,
 * so a whole run can be replayed from a seed without a GPS chip.
 */
import {
  ADRENALINE_MS,
  DESPAWN_M,
  DIFFICULTIES,
  FLARE_RADIUS_M,
  INVULNERABLE_MS,
  KIND_STATS,
  MAX_USABLE_ACCURACY_M,
  MAX_ZOMBIES,
  MIN_STEP_M,
  PICKUP_RADIUS_M,
  PROXIMITY_WARN_M,
  SUPPLY_COOLDOWN_MS,
  SUPPLY_LIFETIME_MS,
  SUPPLY_MAX_M,
  SUPPLY_MIN_M,
  VEHICLE_GRACE_MS,
  VEHICLE_SPEED_MS,
  WAVE_MS,
} from './config';
import { bearingDeg, destination, distanceM, moveToward, type LatLng } from './geo';
import type {
  Difficulty,
  EndReason,
  EngineEvent,
  GameState,
  PlayerFix,
  Supply,
  SupplyKind,
  TickInput,
  Zombie,
  ZombieKind,
} from './types';

/* ------------------------------------------------------------------ random */

class Rng {
  constructor(public s: number) {}
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return prefix + '-' + idSeq;
}

/* ------------------------------------------------------------------- setup */

export function createGame(difficulty: Difficulty, seed = Date.now()): GameState {
  const profile = DIFFICULTIES[difficulty];
  return {
    status: 'idle',
    difficulty,
    startedAt: 0,
    now: 0,
    elapsedMs: 0,
    wave: 0,
    nextWaveInMs: WAVE_MS,
    zombies: [],
    supplies: [],
    lives: profile.lives,
    maxLives: profile.lives,
    score: 0,
    distanceM: 0,
    topSpeed: 0,
    suppliesTaken: 0,
    kills: 0,
    player: null,
    origin: null,
    anchor: null,
    effects: { adrenalineUntil: 0, invulnerableUntil: 0 },
    vehicleMs: 0,
    lastSupplyAt: 0,
    seed: seed >>> 0,
    endReason: null,
  };
}

/** Drop the player into the world at their current fix and open wave 1. */
export function beginRun(state: GameState, fix: PlayerFix, now: number): GameState {
  return {
    ...state,
    status: 'running',
    startedAt: now,
    now,
    elapsedMs: 0,
    wave: 0,
    nextWaveInMs: 0,
    player: fix,
    origin: fix.pos,
    anchor: fix.pos,
    lastSupplyAt: now - SUPPLY_COOLDOWN_MS + 8_000,
    effects: { adrenalineUntil: 0, invulnerableUntil: now + 3_000 },
  };
}

export function endRun(state: GameState, reason: EndReason): GameState {
  if (state.status === 'over') return state;
  return { ...state, status: 'over', endReason: reason };
}

/**
 * Push every absolute timestamp forward by `delta` ms. Used when coming back
 * from a pause so the horde does not teleport and the clock does not jump.
 */
export function shiftClocks(state: GameState, delta: number): GameState {
  if (delta <= 0) return state;
  return {
    ...state,
    startedAt: state.startedAt + delta,
    lastSupplyAt: state.lastSupplyAt + delta,
    // Keep the fix "fresh" so resuming does not trip the lost-signal check.
    player: state.player ? { ...state.player, at: state.player.at + delta } : null,
    effects: {
      adrenalineUntil: state.effects.adrenalineUntil + delta,
      invulnerableUntil: state.effects.invulnerableUntil + delta,
    },
    zombies: state.zombies.map((z) => ({
      ...z,
      spawnedAt: z.spawnedAt + delta,
      expiresAt: z.expiresAt === null ? null : z.expiresAt + delta,
      stunUntil: z.stunUntil + delta,
    })),
    supplies: state.supplies.map((s) => ({ ...s, expiresAt: s.expiresAt + delta })),
  };
}

/**
 * Adopt a fix without crediting the distance between it and the last one.
 * Used after a pause, so ground covered while the game was frozen is not
 * counted as ground you ran from the horde.
 */
export function resyncPlayer(state: GameState, fix: PlayerFix): GameState {
  return { ...state, player: fix, anchor: fix.pos };
}

/* ---------------------------------------------------------------- spawning */

function pickKind(wave: number, rng: Rng): ZombieKind {
  const roll = rng.next();
  if (wave >= 5 && roll > 0.88) return 'brute';
  if (wave >= 7 && roll > 0.45) return 'runner';
  if (wave >= 3 && roll > 0.6) return 'runner';
  return 'walker';
}

function makeZombie(
  pos: LatLng,
  kind: ZombieKind,
  wave: number,
  difficulty: Difficulty,
  now: number,
  rng: Rng
): Zombie {
  const profile = DIFFICULTIES[difficulty];
  const stats = KIND_STATS[kind];
  // The ceiling keeps the mid game fair. Past wave 20 it lifts again, without
  // limit, so no pace outruns the outbreak forever.
  const capped = Math.min(
    profile.maxSpeed,
    profile.baseSpeed + (wave - 1) * profile.speedPerWave
  );
  const hordeSpeed = capped + Math.max(0, wave - 20) * 0.06;
  return {
    id: nextId(kind),
    kind,
    pos,
    speed: hordeSpeed * stats.speedMul * rng.range(0.92, 1.08),
    reach: stats.reach,
    spawnedAt: now,
    expiresAt: stats.lifetimeMs ? now + stats.lifetimeMs : null,
    stunUntil: 0,
  };
}

/**
 * Spawns a wave around the player. Most of the horde appears behind and to the
 * sides; from `ambushFrom` onward some are placed in the direction the player
 * is already travelling, so a straight sprint stops being a winning strategy.
 */
function spawnWave(state: GameState, wave: number, now: number, rng: Rng): Zombie[] {
  const player = state.player;
  if (!player) return [];
  const profile = DIFFICULTIES[state.difficulty];
  const want = profile.baseSpawn + (wave - 1) * profile.spawnPerWave;
  const room = Math.max(0, MAX_ZOMBIES - state.zombies.length);
  const count = Math.min(want, room);
  const ambushes = wave >= profile.ambushFrom ? Math.max(1, Math.floor(count / 3)) : 0;
  const heading = player.heading >= 0 ? player.heading : rng.range(0, 360);

  const spawned: Zombie[] = [];
  for (let i = 0; i < count; i += 1) {
    const isAmbush = i < ambushes;
    const bearing = isAmbush
      ? (heading + rng.range(-38, 38) + 360) % 360
      : rng.range(0, 360);
    const range = isAmbush
      ? rng.range(profile.spawnMinM * 0.8, profile.spawnMinM * 1.25)
      : rng.range(profile.spawnMinM, profile.spawnMaxM);
    const pos = destination(player.pos, bearing, range);
    spawned.push(makeZombie(pos, pickKind(wave, rng), wave, state.difficulty, now, rng));
  }
  return spawned;
}

function pickSupplyKind(state: GameState, rng: Rng): SupplyKind {
  if (state.lives < state.maxLives && rng.next() < 0.45) return 'medkit';
  const roll = rng.next();
  if (roll < 0.42) return 'adrenaline';
  if (roll < 0.78) return 'flare';
  return 'medkit';
}

function spawnSupply(state: GameState, now: number, rng: Rng): Supply {
  const player = state.player as PlayerFix;
  // Try a handful of spots and keep the one furthest from the horde, so the
  // drop is a real detour rather than a freebie sitting on top of you.
  let best: LatLng | null = null;
  let bestClearance = -Infinity;
  for (let i = 0; i < 6; i += 1) {
    const candidate = destination(
      player.pos,
      rng.range(0, 360),
      rng.range(SUPPLY_MIN_M, SUPPLY_MAX_M)
    );
    let clearance = Infinity;
    for (const z of state.zombies) {
      clearance = Math.min(clearance, distanceM(candidate, z.pos));
    }
    if (clearance > bestClearance) {
      bestClearance = clearance;
      best = candidate;
    }
  }
  return {
    id: nextId('supply'),
    kind: pickSupplyKind(state, rng),
    pos: best as LatLng,
    expiresAt: now + SUPPLY_LIFETIME_MS,
  };
}

/* ---------------------------------------------------------------- movement */

/**
 * Where a zombie steers. Early waves chase your last known position; later
 * waves lead the target, cutting the corner you are about to turn.
 */
function aimPoint(player: PlayerFix, wave: number): LatLng {
  if (wave < 4 || player.speed <= 0.8 || player.heading < 0) return player.pos;
  const lead = Math.min(2.2, 0.6 + wave * 0.12);
  return destination(player.pos, player.heading, player.speed * lead);
}

/* -------------------------------------------------------------------- tick */

export function tick(
  state: GameState,
  input: TickInput
): { state: GameState; events: EngineEvent[] } {
  const events: EngineEvent[] = [];
  if (state.status !== 'running') return { state, events };

  const { now, dtMs, fix } = input;
  const dt = Math.min(dtMs, 2_000) / 1000;
  const rng = new Rng(state.seed);
  const next: GameState = { ...state, now };

  /* --- absorb the new GPS fix ------------------------------------------- */
  const previous = state.player;
  if (fix && (!previous || fix.at !== previous.at)) {
    // Measure against the last position that counted, not the last fix.
    // Comparing fix-to-fix throws away every step smaller than the noise
    // floor, which silently credits a walker with zero distance.
    if (fix.accuracy <= MAX_USABLE_ACCURACY_M) {
      const anchor = state.anchor ?? fix.pos;
      const step = distanceM(anchor, fix.pos);
      const noiseFloor = Math.max(MIN_STEP_M, fix.accuracy * 0.5);
      if (step > noiseFloor) {
        next.distanceM = state.distanceM + step;
        next.anchor = fix.pos;
      } else if (!state.anchor) {
        next.anchor = fix.pos;
      }
    }
    next.player = fix;
    if (fix.speed > 0) next.topSpeed = Math.max(state.topSpeed, fix.speed);
  }
  const player = next.player;
  if (!player) return { state: next, events };

  /* --- lost signal ------------------------------------------------------- */
  if (now - player.at > 60_000) {
    return {
      state: endRun(next, 'signal'),
      events: [{ type: 'gameover', reason: 'signal' }],
    };
  }

  /* --- riding is not running --------------------------------------------- */
  const movingTooFast = player.speed > VEHICLE_SPEED_MS;
  next.vehicleMs = Math.max(0, state.vehicleMs + (movingTooFast ? dtMs : -dtMs * 2));
  if (next.vehicleMs >= VEHICLE_GRACE_MS) {
    return {
      state: endRun(next, 'vehicle'),
      events: [{ type: 'gameover', reason: 'vehicle' }],
    };
  }

  /* --- clock and waves ---------------------------------------------------- */
  next.elapsedMs = now - state.startedAt;
  const dueWave = Math.floor(next.elapsedMs / WAVE_MS) + 1;
  next.nextWaveInMs = WAVE_MS - (next.elapsedMs % WAVE_MS);

  let zombies = state.zombies;
  if (dueWave > state.wave) {
    const fresh = spawnWave(next, dueWave, now, rng);
    zombies = zombies.concat(fresh);
    next.wave = dueWave;
    events.push({ type: 'wave', wave: dueWave, spawned: fresh.length });
  }

  /* --- move the horde ----------------------------------------------------- */
  const adrenaline = now < state.effects.adrenalineUntil;
  const target = aimPoint(player, next.wave);
  const survivors: Zombie[] = [];
  let nearest = Infinity;
  let grabbed = false;

  for (const z of zombies) {
    if (z.expiresAt && now > z.expiresAt) continue;
    const stunned = now < z.stunUntil;
    const factor = adrenaline ? 0.42 : 1;
    const moved =
      stunned || dt <= 0
        ? z
        : { ...z, pos: moveToward(z.pos, target, z.speed * factor * dt) };
    const gap = distanceM(moved.pos, player.pos);
    if (gap > DESPAWN_M) continue;
    if (gap < nearest) nearest = gap;
    if (gap <= moved.reach && !grabbed && now > state.effects.invulnerableUntil) {
      grabbed = true;
      continue; // the one that reached you is spent
    }
    survivors.push(moved);
  }
  zombies = survivors;

  /* --- taking a hit -------------------------------------------------------- */
  if (grabbed) {
    next.lives = state.lives - 1;
    next.effects = { ...next.effects, invulnerableUntil: now + INVULNERABLE_MS };
    // Shove the pile back so the next tick is survivable.
    zombies = zombies.map((z) => {
      const gap = distanceM(z.pos, player.pos);
      if (gap >= 45) return z;
      return { ...z, pos: destination(player.pos, bearingDeg(player.pos, z.pos), 45) };
    });
    if (next.lives <= 0) {
      next.zombies = zombies;
      next.seed = rng.s;
      events.push({ type: 'hit', livesLeft: 0 });
      events.push({ type: 'gameover', reason: 'caught' });
      return { state: endRun(next, 'caught'), events };
    }
    events.push({ type: 'hit', livesLeft: next.lives });
  } else if (nearest <= PROXIMITY_WARN_M) {
    events.push({ type: 'proximity', distance: nearest });
  }

  /* --- supply drops --------------------------------------------------------- */
  let supplies = state.supplies.filter((s) => now <= s.expiresAt);
  if (supplies.length === 0 && now - state.lastSupplyAt >= SUPPLY_COOLDOWN_MS) {
    const drop = spawnSupply(next, now, rng);
    supplies = [drop];
    next.lastSupplyAt = now;
    events.push({ type: 'supply', distance: distanceM(player.pos, drop.pos) });
  }

  const remaining: Supply[] = [];
  for (const s of supplies) {
    if (distanceM(s.pos, player.pos) > PICKUP_RADIUS_M) {
      remaining.push(s);
      continue;
    }
    next.suppliesTaken = next.suppliesTaken + 1;
    events.push({ type: 'pickup', kind: s.kind });
    if (s.kind === 'medkit') {
      if (next.lives < next.maxLives) next.lives = next.lives + 1;
      else next.score = next.score + 150;
    } else if (s.kind === 'adrenaline') {
      next.effects = { ...next.effects, adrenalineUntil: now + ADRENALINE_MS };
    } else {
      const before = zombies.length;
      zombies = zombies.filter((z) => distanceM(z.pos, player.pos) > FLARE_RADIUS_M);
      const burned = before - zombies.length;
      next.kills = next.kills + burned;
      if (burned > 0) events.push({ type: 'kill', count: burned });
    }
    next.lastSupplyAt = now;
  }

  next.zombies = zombies;
  next.supplies = remaining;
  next.score = computeScore(next);
  next.seed = rng.s;
  return { state: next, events };
}

/* ----------------------------------------------------------------- scoring */

export function computeScore(state: GameState): number {
  const mult = DIFFICULTIES[state.difficulty].scoreMultiplier;
  const seconds = state.elapsedMs / 1000;
  const base =
    seconds * 8 +
    state.distanceM * 1.2 +
    state.kills * 25 +
    state.suppliesTaken * 40 +
    Math.max(0, state.wave - 1) * 120;
  return Math.round(base * mult);
}

/* --------------------------------------------------------------- selectors */

export type Threat = { zombie: Zombie; distance: number; bearing: number } | null;

export function nearestThreat(state: GameState): Threat {
  const player = state.player;
  if (!player || state.zombies.length === 0) return null;
  let best: Threat = null;
  for (const z of state.zombies) {
    const d = distanceM(z.pos, player.pos);
    if (!best || d < best.distance) {
      best = { zombie: z, distance: d, bearing: bearingDeg(player.pos, z.pos) };
    }
  }
  return best;
}

export function activeSupply(state: GameState) {
  const player = state.player;
  const supply = state.supplies[0];
  if (!player || !supply) return null;
  return {
    supply,
    distance: distanceM(player.pos, supply.pos),
    bearing: bearingDeg(player.pos, supply.pos),
  };
}

/** 0 = safe, 1 = about to be bitten. Drives the audio, haptics and vignette. */
export function dangerLevel(state: GameState): number {
  const threat = nearestThreat(state);
  if (!threat) return 0;
  const t = 1 - Math.min(1, Math.max(0, (threat.distance - 10) / 90));
  return Math.pow(t, 1.4);
}
