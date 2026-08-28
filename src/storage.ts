import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Difficulty, EndReason, GameState } from './types';

const RUNS_KEY = 'deadrun.runs.v1';
const SETTINGS_KEY = 'deadrun.settings.v1';
const MAX_RUNS = 50;

export type RunRecord = {
  at: number;
  difficulty: Difficulty;
  score: number;
  durationMs: number;
  distanceM: number;
  wave: number;
  kills: number;
  suppliesTaken: number;
  topSpeed: number;
  endReason: EndReason | null;
};

export type Settings = {
  difficulty: Difficulty;
  haptics: boolean;
  audio: boolean;
  keepAwake: boolean;
  acceptedSafety: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'runner',
  haptics: true,
  audio: true,
  keepAwake: true,
  acceptedSafety: false,
};

export function toRecord(state: GameState): RunRecord {
  return {
    at: Date.now(),
    difficulty: state.difficulty,
    score: state.score,
    durationMs: state.elapsedMs,
    distanceM: state.distanceM,
    wave: state.wave,
    kills: state.kills,
    suppliesTaken: state.suppliesTaken,
    topSpeed: state.topSpeed,
    endReason: state.endReason,
  };
}

export async function loadRuns(): Promise<RunRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(RUNS_KEY);
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch {
    return [];
  }
}

export async function saveRun(record: RunRecord): Promise<RunRecord[]> {
  const runs = await loadRuns();
  const next = [record, ...runs].slice(0, MAX_RUNS);
  try {
    await AsyncStorage.setItem(RUNS_KEY, JSON.stringify(next));
  } catch {
    // A failed write must never cost the player their run screen.
  }
  return next;
}

export function bestScore(runs: RunRecord[], difficulty?: Difficulty): number {
  return runs
    .filter((r) => !difficulty || r.difficulty === difficulty)
    .reduce((max, r) => Math.max(max, r.score), 0);
}

export function totals(runs: RunRecord[]) {
  return runs.reduce(
    (acc, r) => ({
      runs: acc.runs + 1,
      distanceM: acc.distanceM + r.distanceM,
      durationMs: acc.durationMs + r.durationMs,
    }),
    { runs: 0, distanceM: 0, durationMs: 0 }
  );
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
