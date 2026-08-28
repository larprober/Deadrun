import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DIFFICULTIES } from '../config';
import { C, formatDistance, MONO, SUPPLY_COLOR, SUPPLY_EFFECT, SUPPLY_LABEL } from '../theme';
import type { Difficulty } from '../types';
import { bestScore, totals, type RunRecord, type Settings } from '../storage';
import {
  BootIcon,
  DeadrunMark,
  DeadrunWordmark,
  FlareIcon,
  MedkitIcon,
  PlayIcon,
  SyringeIcon,
  TrophyIcon,
  ZombieHead,
} from '../icons';

const SUPPLY_ICON = { medkit: MedkitIcon, adrenaline: SyringeIcon, flare: FlareIcon };

type Props = {
  settings: Settings;
  runs: RunRecord[];
  onChangeSettings: (patch: Partial<Settings>) => void;
  onStart: () => void;
};

export default function HomeScreen({ settings, runs, onChangeSettings, onStart }: Props) {
  const best = bestScore(runs, settings.difficulty);
  const life = totals(runs);
  const profile = DIFFICULTIES[settings.difficulty];

  return (
    <View style={s.root}>
      <LinearGradient
        colors={[C.void, '#0B1410', C.void]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <DeadrunMark size={104} />
          <View style={{ marginTop: 14 }}>
            <DeadrunWordmark width={236} />
          </View>
          <Text style={s.tagline}>THEY SPAWN WHERE YOU STAND</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>THE RULES</Text>
          <Rule index="01" text="The horde spawns on the real streets around you." />
          <Rule index="02" text="They walk toward your GPS position. You move by moving." />
          <Rule index="03" text="Every 45 seconds more arrive, and they get faster." />
          <Rule index="04" text="Supply drops land 70-140 m away. Going for them is the game." />
          <Rule index="05" text="Past wave 20 they keep getting faster. Losing is the point. Score is the sport." />
        </View>

        <Text style={s.sectionLabel}>OUTBREAK LEVEL</Text>
        <View style={s.difficulties}>
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => {
            const d = DIFFICULTIES[key];
            const active = settings.difficulty === key;
            return (
              <Pressable
                key={key}
                onPress={() => onChangeSettings({ difficulty: key })}
                style={[s.difficulty, active && s.difficultyActive]}
              >
                <View style={s.difficultyHead}>
                  <ZombieHead size={20} color={active ? C.toxic : C.ash} />
                  <Text style={[s.difficultyName, active && { color: C.bone }]}>
                    {d.label.toUpperCase()}
                  </Text>
                  <Text style={s.difficultyMult}>{'x' + d.scoreMultiplier}</Text>
                </View>
                <Text style={s.difficultyBlurb}>{d.blurb}</Text>
                <View style={s.difficultyStats}>
                  <Text style={s.difficultyStat}>
                    {'top speed ' + d.maxSpeed.toFixed(1) + ' m/s'}
                  </Text>
                  <Text style={s.difficultyStat}>{d.lives + ' lives'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.sectionLabel}>SUPPLY DROPS</Text>
        <View style={s.card}>
          {(Object.keys(SUPPLY_LABEL) as Array<keyof typeof SUPPLY_LABEL>).map((kind) => (
            <View key={kind} style={s.supplyRow}>
              {React.createElement(SUPPLY_ICON[kind], { size: 20, color: SUPPLY_COLOR[kind] })}
              <Text style={[s.supplyName, { color: SUPPLY_COLOR[kind] }]}>
                {SUPPLY_LABEL[kind]}
              </Text>
              <Text style={s.supplyEffect}>{SUPPLY_EFFECT[kind]}</Text>
            </View>
          ))}
        </View>

        <View style={s.statsRow}>
          <StatBlock
            icon={<TrophyIcon size={18} />}
            value={best ? best.toLocaleString() : '--'}
            label={'BEST · ' + profile.label.toUpperCase()}
          />
          <StatBlock
            icon={<BootIcon size={18} />}
            value={formatDistance(life.distanceM)}
            label="TOTAL RUN"
          />
          <StatBlock
            icon={<ZombieHead size={18} color={C.toxicDim} />}
            value={String(life.runs)}
            label="OUTBREAKS"
          />
        </View>

        <Text style={s.sectionLabel}>SETUP</Text>
        <View style={s.card}>
          <Toggle
            label="Sound"
            hint="Heartbeat and growls tell you how close they are."
            value={settings.audio}
            onChange={(audio) => onChangeSettings({ audio })}
          />
          <Toggle
            label="Vibration"
            hint="Feel the horde through your pocket."
            value={settings.haptics}
            onChange={(haptics) => onChangeSettings({ haptics })}
          />
        </View>

        <View style={s.safety}>
          <Text style={s.safetyTitle}>BEFORE YOU RUN</Text>
          <Text style={s.safetyBody}>
            This game moves you through real traffic. Pick open ground you know — a park,
            a track, a quiet neighbourhood — and look up more than you look down. Zombies
            are not real. Cars are. Do not play where you would not jog.
          </Text>
        </View>

        <Pressable style={s.start} onPress={onStart}>
          <PlayIcon size={20} />
          <Text style={s.startText}>START THE OUTBREAK</Text>
        </Pressable>
        <Text style={s.footnote}>Needs GPS and open sky. Uses battery like any run tracker.</Text>
      </ScrollView>
    </View>
  );
}

function Rule({ index, text }: { index: string; text: string }) {
  return (
    <View style={s.rule}>
      <Text style={s.ruleIndex}>{index}</Text>
      <Text style={s.ruleText}>{text}</Text>
    </View>
  );
}

function StatBlock({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={s.statBlock}>
      {icon}
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.panelEdge, true: C.toxicDim }}
        thumbColor={value ? C.toxic : C.ash}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  scroll: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 30 },
  tagline: {
    ...MONO,
    color: C.toxicDim,
    fontSize: 10,
    letterSpacing: 3.4,
    marginTop: 12,
  },
  card: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
  },
  cardTitle: {
    ...MONO,
    color: C.ash,
    fontSize: 10,
    letterSpacing: 2.6,
    marginBottom: 12,
  },
  rule: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  ruleIndex: { ...MONO, color: C.toxicDim, fontSize: 11, width: 22 },
  ruleText: { ...MONO, color: C.bone, fontSize: 12, lineHeight: 18, flex: 1 },
  sectionLabel: {
    ...MONO,
    color: C.ash,
    fontSize: 10,
    letterSpacing: 2.6,
    marginBottom: 10,
  },
  difficulties: { gap: 10, marginBottom: 22 },
  difficulty: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderRadius: 14,
    padding: 14,
  },
  difficultyActive: { borderColor: C.toxic, backgroundColor: '#101C14' },
  difficultyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  difficultyName: {
    ...MONO,
    color: C.ash,
    fontSize: 14,
    letterSpacing: 2,
    flex: 1,
    fontWeight: '700',
  },
  difficultyMult: { ...MONO, color: C.sodium, fontSize: 12, letterSpacing: 1 },
  difficultyBlurb: { ...MONO, color: C.ash, fontSize: 11, lineHeight: 17, marginTop: 6 },
  difficultyStats: { flexDirection: 'row', gap: 16, marginTop: 8 },
  difficultyStat: { ...MONO, color: C.panelEdge, fontSize: 10, letterSpacing: 0.6 },
  supplyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  supplyName: { ...MONO, fontSize: 11, letterSpacing: 1.6, width: 96 },
  supplyEffect: { ...MONO, color: C.ash, fontSize: 11, flex: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderRadius: 14,
    paddingVertical: 14,
  },
  statValue: { ...MONO, color: C.bone, fontSize: 15, fontWeight: '700' },
  statLabel: { ...MONO, color: C.ash, fontSize: 8, letterSpacing: 1.2, textAlign: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  toggleLabel: { ...MONO, color: C.bone, fontSize: 13, letterSpacing: 1 },
  toggleHint: { ...MONO, color: C.ash, fontSize: 10, marginTop: 2 },
  safety: {
    borderWidth: 1,
    borderColor: C.hazard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    backgroundColor: 'rgba(255,212,0,0.05)',
  },
  safetyTitle: { ...MONO, color: C.hazard, fontSize: 10, letterSpacing: 2.6, marginBottom: 8 },
  safetyBody: { ...MONO, color: C.bone, fontSize: 11, lineHeight: 18 },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: C.toxic,
    borderRadius: 16,
    paddingVertical: 18,
  },
  startText: { ...MONO, color: C.void, fontSize: 15, fontWeight: '700', letterSpacing: 2.4 },
  footnote: {
    ...MONO,
    color: C.panelEdge,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.8,
  },
});
