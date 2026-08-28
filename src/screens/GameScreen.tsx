import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import MapCanvas, { type MapOrientation } from '../components/MapCanvas';
import Hud from '../components/Hud';
import Radar from '../components/Radar';
import { TICK_MS } from '../config';
import {
  beginRun,
  createGame,
  dangerLevel,
  endRun,
  nearestThreat,
  resyncPlayer,
  shiftClocks,
  tick,
} from '../engine';
import { distanceM, facingDeg, type LatLng } from '../geo';
import * as fb from '../feedback';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { C, formatClock, formatDistance, MONO } from '../theme';
import type { Difficulty, GameState } from '../types';
import { ChevronIcon, DeadrunMark, PlayIcon, SignalIcon } from '../icons';

const TRAIL_MAX = 400;
/** A fix has to be at least this good before we let the run start. */
const START_ACCURACY_M = 30;

type Props = {
  difficulty: Difficulty;
  settings: { audio: boolean; haptics: boolean };
  onFinish: (state: GameState) => void;
  onAbort: () => void;
};

export default function GameScreen({ difficulty, settings, onFinish, onAbort }: Props) {
  useKeepAwake();
  const tracker = useLocationTracker();
  const [state, setState] = useState<GameState>(() => createGame(difficulty));
  const [paused, setPaused] = useState(false);
  const [pocket, setPocket] = useState(false);
  const [orientation, setOrientation] = useState<MapOrientation>('north');
  const [trail, setTrail] = useState<LatLng[]>([]);

  const stateRef = useRef(state);
  const fixRef = useRef(tracker.fix);
  const lastTickRef = useRef(0);
  const pausedAtRef = useRef(0);
  const finishedRef = useRef(false);

  stateRef.current = state;
  fixRef.current = tracker.fix;

  /* --- acquire GPS, then open the outbreak ---------------------------- */
  useEffect(() => {
    tracker.start();
    fb.prime(settings);
    return () => {
      tracker.stop();
      fb.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.status !== 'idle') return;
    const fix = tracker.fix;
    if (!fix || fix.accuracy > START_ACCURACY_M) return;
    const now = Date.now();
    lastTickRef.current = now;
    setState((prev) => beginRun(prev, fix, now));
    setTrail([fix.pos]);
  }, [tracker.fix, state.status]);

  /* --- the loop -------------------------------------------------------- */
  useEffect(() => {
    if (state.status !== 'running' || paused) return;
    const id = setInterval(() => {
      const now = Date.now();
      const dtMs = lastTickRef.current ? now - lastTickRef.current : TICK_MS;
      lastTickRef.current = now;

      const result = tick(stateRef.current, { now, dtMs, fix: fixRef.current });
      for (const event of result.events) {
        if (event.type === 'wave') fb.cueWave();
        else if (event.type === 'hit') fb.cueHit();
        else if (event.type === 'pickup') fb.cuePickup();
        else if (event.type === 'gameover') fb.cueGameOver();
      }
      fb.pulse(dangerLevel(result.state), now);
      setState(result.state);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state.status, paused]);

  /* --- trail ----------------------------------------------------------- */
  useEffect(() => {
    const fix = tracker.fix;
    if (!fix || state.status !== 'running' || paused) return;
    setTrail((prev) => {
      const last = prev[prev.length - 1];
      if (last && distanceM(last, fix.pos) < 4) return prev;
      const next = [...prev, fix.pos];
      return next.length > TRAIL_MAX ? next.slice(next.length - TRAIL_MAX) : next;
    });
  }, [tracker.fix, state.status, paused]);

  /* --- hand the finished run up ---------------------------------------- */
  useEffect(() => {
    if (state.status !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    onFinish(state);
  }, [state, onFinish]);

  /* --- pause / resume --------------------------------------------------- */
  const pause = useCallback(() => {
    if (pausedAtRef.current) return;
    pausedAtRef.current = Date.now();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    const pausedAt = pausedAtRef.current;
    pausedAtRef.current = 0;
    const now = Date.now();
    const delta = pausedAt ? now - pausedAt : 0;
    setState((prev) => {
      const shifted = shiftClocks(prev, delta);
      return fixRef.current ? resyncPlayer(shifted, fixRef.current) : shifted;
    });
    lastTickRef.current = now;
    setPaused(false);
  }, []);

  // Leaving the app freezes the run rather than letting the horde eat you
  // while you answer a message.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && stateRef.current.status === 'running') pause();
    });
    return () => sub.remove();
  }, [pause]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stateRef.current.status === 'running') {
        pause();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [pause]);

  const quit = useCallback(() => {
    const ended = endRun(stateRef.current, 'quit');
    if (ended.wave === 0) {
      onAbort();
      return;
    }
    setState(ended);
  }, [onAbort]);

  // Which way the phone is pointing, live. The engine's copy of the player only
  // refreshes when a GPS fix lands, and turning on the spot produces none, so
  // the compass has to be read straight off the tracker — otherwise the radar
  // and every direction arrow sit frozen while you spin around.
  const facing = facingDeg(
    state.player?.speed ?? 0,
    state.player?.heading ?? -1,
    tracker.heading
  );

  /* --- pre-run states ---------------------------------------------------- */
  if (state.status === 'idle') {
    return (
      <AcquiringScreen
        status={tracker.status}
        error={tracker.error}
        accuracy={tracker.fix?.accuracy ?? null}
        bars={tracker.bars}
        onRetry={() => tracker.start()}
        onCancel={onAbort}
      />
    );
  }

  return (
    <View style={s.root}>
      <MapCanvas state={state} trail={trail} orientation={orientation} facing={facing} />
      <Hud
        state={state}
        bars={tracker.bars}
        facing={facing}
        onPause={pause}
        onPocket={() => setPocket(true)}
        onToggleOrientation={() =>
          setOrientation((o) => (o === 'north' ? 'course' : 'north'))
        }
        orientation={orientation}
      />

      {pocket && <PocketOverlay state={state} facing={facing} onExit={() => setPocket(false)} />}

      {paused && !pocket && (
        <View style={s.overlay}>
          <DeadrunMark size={72} />
          <Text style={s.overlayTitle}>PAUSED</Text>
          <Text style={s.overlayBody}>
            The horde is frozen where it stood. Distance you cover now does not count.
          </Text>
          <View style={s.overlayStats}>
            <OverlayStat label="SURVIVED" value={formatClock(state.elapsedMs)} />
            <OverlayStat label="RUN" value={formatDistance(state.distanceM)} />
            <OverlayStat label="WAVE" value={String(state.wave)} />
          </View>
          <Pressable style={s.primaryButton} onPress={resume}>
            <PlayIcon size={18} />
            <Text style={s.primaryButtonText}>KEEP RUNNING</Text>
          </Pressable>
          <Pressable style={s.ghostButton} onPress={quit}>
            <Text style={s.ghostButtonText}>END RUN</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Screen off, game on. Keeps the app foregrounded without lighting the map. */
function PocketOverlay({
  state,
  facing,
  onExit,
}: {
  state: GameState;
  facing: number;
  onExit: () => void;
}) {
  const threat = nearestThreat(state);
  return (
    <Pressable style={s.pocket} onPress={onExit}>
      <Text style={s.pocketLabel}>POCKET MODE</Text>
      <Radar state={state} size={180} facing={facing} />
      <Text style={s.pocketClock}>{formatClock(state.elapsedMs)}</Text>
      <Text style={s.pocketThreat}>
        {threat ? Math.round(threat.distance) + ' m behind you' : 'nothing on the scope'}
      </Text>
      <Text style={s.pocketHint}>Listen for the heartbeat. Tap to bring the map back.</Text>
    </Pressable>
  );
}

function OverlayStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.overlayStatValue}>{value}</Text>
      <Text style={s.overlayStatLabel}>{label}</Text>
    </View>
  );
}

function AcquiringScreen({
  status,
  error,
  accuracy,
  bars,
  onRetry,
  onCancel,
}: {
  status: string;
  error: string | null;
  accuracy: number | null;
  bars: number;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const blocked = status === 'denied' || status === 'disabled' || status === 'error';
  return (
    <View style={s.acquire}>
      <SignalIcon size={54} bars={bars} color={bars >= 3 ? C.toxic : C.hazard} />
      <Text style={s.acquireTitle}>
        {blocked ? 'NO FIX' : 'LOCKING ON TO YOUR STREET'}
      </Text>
      <Text style={s.acquireBody}>
        {blocked
          ? error
          : accuracy
            ? 'Accuracy ' +
              Math.round(accuracy) +
              ' m. Waiting for ' +
              START_ACCURACY_M +
              ' m or better before the horde lands.'
            : 'Step outside and give the GPS a few seconds of sky.'}
      </Text>
      {!blocked && <ActivityIndicator color={C.toxic} style={{ marginTop: 18 }} />}
      {blocked && (
        <Pressable style={s.primaryButton} onPress={onRetry}>
          <Text style={s.primaryButtonText}>TRY AGAIN</Text>
        </Pressable>
      )}
      <Pressable style={s.ghostButton} onPress={onCancel}>
        <ChevronIcon size={16} />
        <Text style={s.ghostButtonText}>BACK</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
  acquire: {
    flex: 1,
    backgroundColor: C.void,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
  },
  acquireTitle: {
    ...MONO,
    color: C.bone,
    fontSize: 17,
    letterSpacing: 2,
    marginTop: 20,
    textAlign: 'center',
  },
  acquireBody: {
    ...MONO,
    color: C.ash,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 12,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5,7,10,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  overlayTitle: {
    ...MONO,
    color: C.bone,
    fontSize: 24,
    letterSpacing: 4,
    marginTop: 16,
  },
  overlayBody: {
    ...MONO,
    color: C.ash,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
  },
  overlayStats: {
    flexDirection: 'row',
    gap: 34,
    marginTop: 26,
    marginBottom: 30,
  },
  overlayStatValue: { ...MONO, color: C.toxic, fontSize: 20, fontWeight: '700' },
  overlayStatLabel: { ...MONO, color: C.ash, fontSize: 9, letterSpacing: 1.6, marginTop: 2 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.toxic,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 18,
  },
  primaryButtonText: { ...MONO, color: C.void, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 12,
  },
  ghostButtonText: { ...MONO, color: C.ash, fontSize: 12, letterSpacing: 2 },
  pocket: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  pocketLabel: { ...MONO, color: C.panelEdge, fontSize: 10, letterSpacing: 4 },
  pocketClock: { ...MONO, color: C.bone, fontSize: 34, fontWeight: '700', letterSpacing: 2 },
  pocketThreat: { ...MONO, color: C.blood, fontSize: 13, letterSpacing: 1 },
  pocketHint: {
    ...MONO,
    color: C.panelEdge,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
