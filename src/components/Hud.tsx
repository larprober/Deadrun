import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { activeSupply, dangerLevel, nearestThreat } from '../engine';
import { ADRENALINE_MS, VEHICLE_GRACE_MS } from '../config';
import { bearingDelta } from '../geo';
import {
  C,
  formatClock,
  formatDistance,
  formatPace,
  MONO,
  SUPPLY_COLOR,
  SUPPLY_LABEL,
} from '../theme';
import type { GameState } from '../types';
import {
  BootIcon,
  EyeOffIcon,
  HeartEmptyIcon,
  HeartIcon,
  PauseIcon,
  ShieldIcon,
  SignalIcon,
  SpeedIcon,
  ThreatArrow,
  WaveIcon,
  SyringeIcon,
  MedkitIcon,
  FlareIcon,
} from '../icons';
import Radar from './Radar';

type Props = {
  state: GameState;
  bars: number;
  onPause: () => void;
  onPocket: () => void;
  onToggleOrientation: () => void;
  facing: number;
  orientation: 'north' | 'course';
};

const SUPPLY_ICON = { medkit: MedkitIcon, adrenaline: SyringeIcon, flare: FlareIcon };

export default function Hud({
  state,
  bars,
  onPause,
  onPocket,
  onToggleOrientation,
  orientation,
  facing,
}: Props) {
  const danger = dangerLevel(state);
  const threat = nearestThreat(state);
  const supply = activeSupply(state);
  const heading = facing;
  const speed = state.player?.speed ?? 0;

  // Fixes land about once a second. If they stop, everything on the map freezes
  // and there is otherwise nothing on screen that says so — you would just think
  // the game was broken. Call it out before the run dies of lost signal at 60 s.
  const fixAge = state.player ? state.now - state.player.at : 0;
  const stale = state.player != null && fixAge > 5_000;

  // The vignette breathes faster the closer they get.
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 620, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const vignetteOpacity = Animated.multiply(
    pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
    danger
  );

  const adrenalineLeft = Math.max(0, state.effects.adrenalineUntil - state.now);
  const invulnLeft = Math.max(0, state.effects.invulnerableUntil - state.now);
  const vehicleRatio = state.vehicleMs / VEHICLE_GRACE_MS;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* danger vignette */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: vignetteOpacity }]}
      >
        <LinearGradient
          colors={['rgba(140,15,20,0.85)', 'rgba(140,15,20,0)', 'rgba(140,15,20,0.85)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* top bar */}
      <View style={s.topBar} pointerEvents="box-none">
        <View style={s.pill}>
          <WaveIcon size={16} />
          <Text style={s.pillLabel}>WAVE</Text>
          <Text style={s.pillValue}>{state.wave}</Text>
        </View>

        <View style={s.clockWrap}>
          <Text style={s.clock}>{formatClock(state.elapsedMs)}</Text>
          <Text style={s.score}>{state.score.toLocaleString()} PTS</Text>
        </View>

        <View style={s.topButtons}>
          <Pressable style={s.iconButton} onPress={onPocket} hitSlop={8}>
            <EyeOffIcon size={18} />
          </Pressable>
          <Pressable style={s.iconButton} onPress={onPause} hitSlop={8}>
            <PauseIcon size={18} />
          </Pressable>
        </View>
      </View>

      {/* lives + next wave */}
      <View style={s.livesRow} pointerEvents="none">
        <View style={s.lives}>
          {Array.from({ length: state.maxLives }).map((_, i) =>
            i < state.lives ? (
              <HeartIcon key={i} size={22} />
            ) : (
              <HeartEmptyIcon key={i} size={22} />
            )
          )}
        </View>
        <View style={s.nextWave}>
          <Text style={s.nextWaveLabel}>NEXT WAVE</Text>
          <View style={s.waveTrack}>
            <View
              style={[
                s.waveFill,
                { width: `${100 - (state.nextWaveInMs / 45000) * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* status strip */}
      {invulnLeft > 0 && (
        <Banner color={C.ice} icon={<ShieldIcon size={16} />}>
          {'SHAKEN OFF  ' + (invulnLeft / 1000).toFixed(1) + 's'}
        </Banner>
      )}
      {adrenalineLeft > 0 && (
        <Banner color={C.hazard} icon={<SyringeIcon size={16} />}>
          {'ADRENALINE  ' + (adrenalineLeft / 1000).toFixed(1) + 's  ·  horde slowed'}
        </Banner>
      )}
      {vehicleRatio > 0.15 && (
        <Banner color={C.blood} icon={<SpeedIcon size={16} color={C.blood} />}>
          {'TOO FAST TO BE RUNNING  ·  run voided in ' +
            Math.ceil((VEHICLE_GRACE_MS - state.vehicleMs) / 1000) +
            's'}
        </Banner>
      )}

      {/* right rail: radar */}
      <View style={s.radarWrap} pointerEvents="box-none">
        <Pressable onPress={onToggleOrientation} hitSlop={6}>
          <Radar state={state} size={128} facing={facing} />
          <Text style={s.radarMode}>{orientation === 'north' ? 'NORTH UP' : 'COURSE UP'}</Text>
        </Pressable>
      </View>

      {/* bottom dock */}
      <View style={s.dock} pointerEvents="none">
        {threat && (
          <View style={s.threatRow}>
            <View
              style={{
                transform: [
                  { rotate: `${bearingDelta(heading, threat.bearing)}deg` },
                ],
              }}
            >
              <ThreatArrow size={26} color={threat.distance < 40 ? C.blood : C.sodium} />
            </View>
            <Text style={s.threatText}>
              {'NEAREST  ' + Math.round(threat.distance) + ' m'}
            </Text>
            <Text style={[s.threatKind, { color: C.ash }]}>
              {threat.zombie.kind.toUpperCase()}
            </Text>
          </View>
        )}

        {supply && (
          <View style={s.supplyRow}>
            {React.createElement(SUPPLY_ICON[supply.supply.kind], {
              size: 18,
              color: SUPPLY_COLOR[supply.supply.kind],
            })}
            <Text style={[s.supplyText, { color: SUPPLY_COLOR[supply.supply.kind] }]}>
              {SUPPLY_LABEL[supply.supply.kind] + '  ' + Math.round(supply.distance) + ' m'}
            </Text>
            <View
              style={{
                transform: [{ rotate: `${bearingDelta(heading, supply.bearing)}deg` }],
              }}
            >
              <ThreatArrow size={16} color={SUPPLY_COLOR[supply.supply.kind]} />
            </View>
          </View>
        )}

        <View style={s.stats}>
          <Stat icon={<BootIcon size={16} />} value={formatDistance(state.distanceM)} label="RUN" />
          <Stat icon={<SpeedIcon size={16} />} value={formatPace(speed)} label="PACE" />
          <Stat
            icon={
              <SignalIcon
                size={16}
                bars={stale ? 0 : bars}
                color={stale ? C.blood : bars >= 3 ? C.toxic : C.hazard}
              />
            }
            value={
              !state.player
                ? '--'
                : stale
                  ? Math.round(fixAge / 1000) + 's ago'
                  : Math.round(state.player.accuracy) + ' m'
            }
            label={stale ? 'NO FIX' : 'GPS'}
          />
        </View>
      </View>
    </View>
  );
}

function Banner({
  color,
  icon,
  children,
}: {
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.banner, { borderColor: color }]} pointerEvents="none">
      {icon}
      <Text style={[s.bannerText, { color }]}>{children}</Text>
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={s.stat}>
      {icon}
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 54,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(5,7,10,0.78)',
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillLabel: { ...MONO, color: C.ash, fontSize: 10, letterSpacing: 1.4 },
  pillValue: { ...MONO, color: C.sodium, fontSize: 15, fontWeight: '700' },
  clockWrap: { alignItems: 'center' },
  clock: { ...MONO, color: C.bone, fontSize: 26, fontWeight: '700', letterSpacing: 1 },
  score: { ...MONO, color: C.toxic, fontSize: 11, letterSpacing: 1.6, marginTop: -2 },
  topButtons: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,7,10,0.78)',
    borderWidth: 1,
    borderColor: C.panelEdge,
  },
  livesRow: {
    position: 'absolute',
    top: 108,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lives: { flexDirection: 'row', gap: 4 },
  nextWave: { width: 130 },
  nextWaveLabel: { ...MONO, color: C.ash, fontSize: 9, letterSpacing: 1.4, marginBottom: 3 },
  waveTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  waveFill: { height: 4, backgroundColor: C.sodium },
  banner: {
    alignSelf: 'center',
    position: 'relative',
    marginTop: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(5,7,10,0.88)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bannerText: { ...MONO, fontSize: 11, letterSpacing: 1.1 },
  radarWrap: { position: 'absolute', right: 12, bottom: 190, alignItems: 'center' },
  radarMode: {
    ...MONO,
    color: C.ash,
    fontSize: 8,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginTop: 2,
  },
  dock: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 30,
    gap: 8,
  },
  threatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5,7,10,0.8)',
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  threatText: { ...MONO, color: C.bone, fontSize: 14, letterSpacing: 1 },
  threatKind: { ...MONO, fontSize: 10, letterSpacing: 1.4 },
  supplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5,7,10,0.8)',
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  supplyText: { ...MONO, fontSize: 12, letterSpacing: 1.2 },
  stats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(5,7,10,0.82)',
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderRadius: 14,
    paddingVertical: 10,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...MONO, color: C.bone, fontSize: 14, fontWeight: '600' },
  statLabel: { ...MONO, color: C.ash, fontSize: 9, letterSpacing: 1.4 },
});
