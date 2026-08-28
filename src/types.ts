import type { LatLng } from './geo';

export type ZombieKind = 'walker' | 'runner' | 'brute';
export type SupplyKind = 'medkit' | 'adrenaline' | 'flare';
export type Difficulty = 'shambler' | 'runner' | 'nightmare';
export type GameStatus = 'idle' | 'locating' | 'running' | 'over';

export type Zombie = {
  id: string;
  kind: ZombieKind;
  pos: LatLng;
  /** metres per second at full aggression */
  speed: number;
  /** metres at which this zombie can grab the player */
  reach: number;
  spawnedAt: number;
  /** runners give up and despawn after this timestamp */
  expiresAt: number | null;
  /** frozen until this timestamp (adrenaline) */
  stunUntil: number;
};

export type Supply = {
  id: string;
  kind: SupplyKind;
  pos: LatLng;
  expiresAt: number;
};

export type PlayerFix = {
  pos: LatLng;
  /** GPS horizontal accuracy in metres */
  accuracy: number;
  /** ground speed in m/s, -1 when unknown */
  speed: number;
  /** direction of travel in degrees, -1 when unknown */
  heading: number;
  at: number;
};

export type Effects = {
  adrenalineUntil: number;
  invulnerableUntil: number;
};

export type GameState = {
  status: GameStatus;
  difficulty: Difficulty;
  startedAt: number;
  now: number;
  elapsedMs: number;
  wave: number;
  /** ms remaining before the next wave lands */
  nextWaveInMs: number;
  zombies: Zombie[];
  supplies: Supply[];
  lives: number;
  maxLives: number;
  score: number;
  distanceM: number;
  topSpeed: number;
  suppliesTaken: number;
  kills: number;
  player: PlayerFix | null;
  origin: LatLng | null;
  /** Last position that counted toward distance; see the tick loop. */
  anchor: LatLng | null;
  effects: Effects;
  /** consecutive ms spent moving at implausible speed */
  vehicleMs: number;
  lastSupplyAt: number;
  seed: number;
  endReason: EndReason | null;
};

export type EndReason = 'caught' | 'vehicle' | 'quit' | 'signal';

export type EngineEvent =
  | { type: 'wave'; wave: number; spawned: number }
  | { type: 'hit'; livesLeft: number }
  | { type: 'gameover'; reason: EndReason }
  | { type: 'pickup'; kind: SupplyKind }
  | { type: 'supply'; distance: number }
  | { type: 'kill'; count: number }
  | { type: 'proximity'; distance: number };

export type TickInput = {
  now: number;
  dtMs: number;
  fix: PlayerFix | null;
};
