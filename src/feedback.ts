/**
 * Audio + haptics. The screen is in your pocket half the time, so proximity
 * has to be audible: the heartbeat speeds up as the nearest zombie closes in.
 */
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCES = {
  heartbeat: require('../assets/sfx/heartbeat.wav'),
  growl: require('../assets/sfx/growl.wav'),
  pickup: require('../assets/sfx/pickup.wav'),
  hit: require('../assets/sfx/hit.wav'),
  wave: require('../assets/sfx/wave.wav'),
  gameover: require('../assets/sfx/gameover.wav'),
};

export type Cue = keyof typeof SOURCES;

const players = new Map<Cue, AudioPlayer>();
let audioOn = true;
let hapticsOn = true;
let lastBeatAt = 0;
let lastGrowlAt = 0;

export async function prime(settings: { audio: boolean; haptics: boolean }) {
  audioOn = settings.audio;
  hapticsOn = settings.haptics;
  if (!audioOn) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
    for (const key of Object.keys(SOURCES) as Cue[]) {
      if (!players.has(key)) players.set(key, createAudioPlayer(SOURCES[key]));
    }
  } catch {
    // Audio is a nicety; never let it take the run down with it.
    audioOn = false;
  }
}

export function setEnabled(settings: { audio: boolean; haptics: boolean }) {
  audioOn = settings.audio;
  hapticsOn = settings.haptics;
}

export function play(cue: Cue, volume = 1) {
  if (!audioOn) return;
  const player = players.get(cue);
  if (!player) return;
  try {
    player.volume = Math.max(0, Math.min(1, volume));
    player.seekTo(0);
    player.play();
  } catch {
    // ignore
  }
}

export function dispose() {
  for (const player of players.values()) {
    try {
      player.remove();
    } catch {
      // ignore
    }
  }
  players.clear();
  lastBeatAt = 0;
  lastGrowlAt = 0;
}

/* ----------------------------------------------------------------- cues */

export function cueWave() {
  play('wave', 0.7);
  if (hapticsOn) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }
}

export function cueHit() {
  play('hit', 1);
  if (hapticsOn) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 120);
  }
}

export function cuePickup() {
  play('pickup', 0.85);
  if (hapticsOn) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

export function cueGameOver() {
  play('gameover', 0.9);
  if (hapticsOn) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }
}

/**
 * Call every tick with 0..1 danger. Emits a heartbeat whose interval collapses
 * from ~1.6 s when you are clear to ~0.34 s when something is on your heels.
 */
export function pulse(danger: number, now: number) {
  if (danger < 0.12) return;
  const interval = 1600 - danger * 1260;
  if (now - lastBeatAt >= interval) {
    lastBeatAt = now;
    play('heartbeat', 0.25 + danger * 0.7);
    if (hapticsOn) {
      const style =
        danger > 0.75
          ? Haptics.ImpactFeedbackStyle.Heavy
          : danger > 0.45
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => {});
    }
  }
  if (danger > 0.55 && now - lastGrowlAt > 5200) {
    lastGrowlAt = now;
    play('growl', 0.3 + danger * 0.5);
  }
}
