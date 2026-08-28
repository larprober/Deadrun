/**
 * Headless balance harness. Runs whole matches against a simulated runner so
 * difficulty can be tuned without going outside.
 *
 *   npm run sim
 *
 * The runner flees along the sum of repulsion vectors from nearby zombies, and
 * detours to a supply drop when one is closer than the horde is dangerous.
 */
import { TICK_MS } from '../src/config';
import { beginRun, createGame, tick } from '../src/engine';
import { bearingDeg, destination, distanceM, toRad, type LatLng } from '../src/geo';
import type { Difficulty, GameState, PlayerFix } from '../src/types';

type Strategy = 'still' | 'flee' | 'greedy';

type Profile = {
  name: string;
  difficulty: Difficulty;
  speed: number;
  strategy: Strategy;
};

const START: LatLng = { latitude: 41.0082, longitude: 28.9784 };
const FIX_INTERVAL_MS = 1000;
const MAX_MINUTES = 30;

/** Direction the runner should head, in degrees. */
function chooseHeading(state: GameState, pos: LatLng, strategy: Strategy): number {
  if (strategy === 'still') return 0;

  // Repulsion from every zombie inside 160 m, weighted by inverse square.
  let x = 0;
  let y = 0;
  for (const z of state.zombies) {
    const d = distanceM(z.pos, pos);
    if (d > 160) continue;
    const away = (bearingDeg(z.pos, pos) * Math.PI) / 180;
    const weight = 1 / Math.max(64, d * d);
    x += Math.sin(away) * weight;
    y += Math.cos(away) * weight;
  }

  if (strategy === 'greedy' && state.supplies.length > 0) {
    const supply = state.supplies[0];
    const d = distanceM(supply.pos, pos);
    const toward = toRad(bearingDeg(pos, supply.pos));
    // Pull toward the drop, but never straight into the horde.
    const pull = 1 / Math.max(64, d * d) * 1.8;
    x += Math.sin(toward) * pull;
    y += Math.cos(toward) * pull;
  }

  if (x === 0 && y === 0) return 0;
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function run(profile: Profile, seed: number) {
  let state = createGame(profile.difficulty, seed);
  let now = 1_700_000_000_000;
  let pos = START;
  let heading = 0;

  let fix: PlayerFix = {
    pos,
    accuracy: 5,
    speed: 0,
    heading: -1,
    at: now,
  };
  state = beginRun(state, fix, now);

  let lastFixAt = now;
  const waveLog: Array<{ wave: number; zombies: number; nearest: number }> = [];
  let lastLoggedWave = 0;

  while (state.status === 'running' && state.elapsedMs < MAX_MINUTES * 60_000) {
    now += TICK_MS;

    if (now - lastFixAt >= FIX_INTERVAL_MS) {
      const dtSec = (now - lastFixAt) / 1000;
      heading = chooseHeading(state, pos, profile.strategy);
      const step = profile.speed * dtSec;
      if (step > 0) pos = destination(pos, heading, step);
      lastFixAt = now;
      fix = {
        pos,
        accuracy: 5,
        speed: profile.speed,
        heading: profile.speed > 0 ? heading : -1,
        at: now,
      };
    }

    const result = tick(state, { now, dtMs: TICK_MS, fix });
    state = result.state;

    if (state.wave > lastLoggedWave) {
      lastLoggedWave = state.wave;
      const nearest = state.zombies.reduce(
        (min, z) => Math.min(min, distanceM(z.pos, pos)),
        Infinity
      );
      waveLog.push({
        wave: state.wave,
        zombies: state.zombies.length,
        nearest: Number.isFinite(nearest) ? Math.round(nearest) : -1,
      });
    }
  }

  return { state, waveLog };
}

function pad(value: string | number, width: number) {
  return String(value).padStart(width);
}

const PROFILES: Profile[] = [
  { name: 'statue        ', difficulty: 'runner', speed: 0, strategy: 'still' },
  { name: 'walker 1.4m/s ', difficulty: 'runner', speed: 1.4, strategy: 'flee' },
  { name: 'jogger 2.5m/s ', difficulty: 'runner', speed: 2.5, strategy: 'flee' },
  { name: 'runner 3.3m/s ', difficulty: 'runner', speed: 3.3, strategy: 'flee' },
  { name: 'athlete 4.2m/s', difficulty: 'runner', speed: 4.2, strategy: 'flee' },
  { name: 'greedy 3.3m/s ', difficulty: 'runner', speed: 3.3, strategy: 'greedy' },
  { name: 'shambler 2.5  ', difficulty: 'shambler', speed: 2.5, strategy: 'flee' },
  { name: 'nightmare 3.3 ', difficulty: 'nightmare', speed: 3.3, strategy: 'flee' },
  { name: 'nightmare 4.5 ', difficulty: 'nightmare', speed: 4.5, strategy: 'flee' },
];

const SEEDS = [1, 7, 42, 99, 2024];

console.log('DEADRUN balance simulation  ·  ' + SEEDS.length + ' seeds per profile\n');
console.log(
  'profile          waves   time     dist     score    supplies  end'
);
console.log('-'.repeat(72));

for (const profile of PROFILES) {
  const results = SEEDS.map((seed) => run(profile, seed));
  const avg = (pick: (r: (typeof results)[0]) => number) =>
    results.reduce((sum, r) => sum + pick(r), 0) / results.length;

  const waves = avg((r) => r.state.wave);
  const secs = avg((r) => r.state.elapsedMs / 1000);
  const dist = avg((r) => r.state.distanceM);
  const score = avg((r) => r.state.score);
  const supplies = avg((r) => r.state.suppliesTaken);
  const reasons = results.map((r) => r.state.endReason ?? 'survived');
  const summary = Array.from(new Set(reasons))
    .map((reason) => reason + '=' + reasons.filter((x) => x === reason).length)
    .join(' ');

  console.log(
    profile.name +
      '  ' +
      pad(waves.toFixed(1), 5) +
      '  ' +
      pad(Math.floor(secs / 60) + 'm' + String(Math.round(secs % 60)).padStart(2, '0'), 6) +
      '  ' +
      pad(Math.round(dist) + 'm', 7) +
      '  ' +
      pad(Math.round(score), 7) +
      '  ' +
      pad(supplies.toFixed(1), 8) +
      '  ' +
      summary
  );
}

console.log('\nWave detail, runner 3.3 m/s, seed 42:');
const detail = run(
  { name: 'detail', difficulty: 'runner', speed: 3.3, strategy: 'flee' },
  42
);
for (const row of detail.waveLog) {
  console.log(
    '  wave ' +
      pad(row.wave, 2) +
      '  horde ' +
      pad(row.zombies, 3) +
      '  nearest ' +
      pad(row.nearest + 'm', 6)
  );
}
console.log(
  '  ended: ' +
    detail.state.endReason +
    ' at ' +
    Math.round(detail.state.elapsedMs / 1000) +
    's, score ' +
    detail.state.score
);
