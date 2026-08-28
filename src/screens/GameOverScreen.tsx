import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DIFFICULTIES } from '../config';
import { C, formatClock, formatDistance, formatPace, MONO } from '../theme';
import type { EndReason, GameState } from '../types';
import { bestScore, type RunRecord } from '../storage';
import {
  BootIcon,
  ChevronIcon,
  FlareIcon,
  HeartIcon,
  PlayIcon,
  SpeedIcon,
  TrophyIcon,
  WaveIcon,
  ZombieHead,
} from '../icons';

const HEADLINE: Record<EndReason, { title: string; body: string }> = {
  caught: {
    title: 'THEY GOT YOU',
    body: 'The horde closed the gap. Somewhere on this map, you stopped moving.',
  },
  vehicle: {
    title: 'RUN VOIDED',
    body: 'You were moving faster than a person can run. Zombies do not chase cars.',
  },
  quit: {
    title: 'YOU WALKED AWAY',
    body: 'Ended on your terms. The score still counts.',
  },
  signal: {
    title: 'SIGNAL LOST',
    body: 'GPS dropped out for a full minute, so the run could not be scored honestly.',
  },
};

type Props = {
  state: GameState;
  /** History from before this run, so the record check is not a race. */
  priorRuns: RunRecord[];
  onAgain: () => void;
  onHome: () => void;
};

export default function GameOverScreen({ state, priorRuns, onAgain, onHome }: Props) {
  const reason = state.endReason ?? 'caught';
  const copy = HEADLINE[reason];
  const previousBest = bestScore(priorRuns, state.difficulty);
  const isRecord = state.score > previousBest && state.score > 0;
  const profile = DIFFICULTIES[state.difficulty];
  const avgSpeed = state.elapsedMs > 0 ? state.distanceM / (state.elapsedMs / 1000) : 0;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#1A0507', C.void, C.void]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <ZombieHead size={72} color={reason === 'caught' ? C.blood : C.ash} />
          <Text style={s.title}>{copy.title}</Text>
          <Text style={s.body}>{copy.body}</Text>
        </View>

        <View style={s.scoreCard}>
          {isRecord && (
            <View style={s.recordTag}>
              <TrophyIcon size={14} />
              <Text style={s.recordText}>PERSONAL BEST</Text>
            </View>
          )}
          <Text style={s.scoreValue}>{state.score.toLocaleString()}</Text>
          <Text style={s.scoreLabel}>
            {'POINTS  ·  ' + profile.label.toUpperCase() + '  ·  x' + profile.scoreMultiplier}
          </Text>
          {!isRecord && previousBest > 0 && (
            <Text style={s.scoreDelta}>
              {'best on this level: ' + previousBest.toLocaleString()}
            </Text>
          )}
        </View>

        <View style={s.grid}>
          <Cell icon={<WaveIcon size={18} />} value={String(state.wave)} label="WAVES SURVIVED" />
          <Cell
            icon={<SpeedIcon size={18} />}
            value={formatClock(state.elapsedMs)}
            label="TIME ALIVE"
          />
          <Cell
            icon={<BootIcon size={18} />}
            value={formatDistance(state.distanceM)}
            label="GROUND COVERED"
          />
          <Cell icon={<SpeedIcon size={18} />} value={formatPace(avgSpeed)} label="AVERAGE PACE" />
          <Cell
            icon={<SpeedIcon size={18} color={C.sodium} />}
            value={(state.topSpeed * 3.6).toFixed(1) + ' km/h'}
            label="TOP SPEED"
          />
          <Cell
            icon={<FlareIcon size={18} />}
            value={String(state.suppliesTaken)}
            label="SUPPLIES TAKEN"
          />
          <Cell
            icon={<ZombieHead size={18} color={C.toxicDim} />}
            value={String(state.kills)}
            label="BURNED BY FLARES"
          />
          <Cell
            icon={<HeartIcon size={18} />}
            value={state.lives + ' / ' + state.maxLives}
            label="LIVES LEFT"
          />
        </View>

        <Pressable style={s.primary} onPress={onAgain}>
          <PlayIcon size={18} />
          <Text style={s.primaryText}>RUN AGAIN</Text>
        </Pressable>
        <Pressable style={s.ghost} onPress={onHome}>
          <ChevronIcon size={16} />
          <Text style={s.ghostText}>BACK TO BASE</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Cell({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={s.cell}>
      {icon}
      <Text style={s.cellValue}>{value}</Text>
      <Text style={s.cellLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  scroll: { paddingHorizontal: 20, paddingTop: 76, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 26 },
  title: {
    ...MONO,
    color: C.bone,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 16,
    textAlign: 'center',
  },
  body: {
    ...MONO,
    color: C.ash,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },
  scoreCard: {
    alignItems: 'center',
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderRadius: 18,
    paddingVertical: 22,
    marginBottom: 18,
  },
  recordTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.hazard,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  recordText: { ...MONO, color: C.hazard, fontSize: 9, letterSpacing: 2 },
  scoreValue: { ...MONO, color: C.toxic, fontSize: 46, fontWeight: '700', letterSpacing: 1 },
  scoreLabel: { ...MONO, color: C.ash, fontSize: 10, letterSpacing: 2, marginTop: 4 },
  scoreDelta: { ...MONO, color: C.panelEdge, fontSize: 10, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  cell: {
    width: '47.7%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderRadius: 14,
    paddingVertical: 16,
  },
  cellValue: { ...MONO, color: C.bone, fontSize: 17, fontWeight: '700' },
  cellLabel: { ...MONO, color: C.ash, fontSize: 8, letterSpacing: 1.3, textAlign: 'center' },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: C.toxic,
    borderRadius: 16,
    paddingVertical: 17,
  },
  primaryText: { ...MONO, color: C.void, fontSize: 14, fontWeight: '700', letterSpacing: 2.4 },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  ghostText: { ...MONO, color: C.ash, fontSize: 12, letterSpacing: 2 },
});
