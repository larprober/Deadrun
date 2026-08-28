import React from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { C } from './theme';

type IconProps = {
  size?: number;
  color?: string;
  opacity?: number;
};

/* ------------------------------------------------------------------ horde */

/**
 * Faceted skull. Drawn with straight edges rather than curves so it stays
 * legible at 18 px on top of a map.
 */
export function ZombieHead({ size = 24, color = C.toxic, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path
        d="M12 1.4 18.9 4.3 20.2 10.6 17.7 15.3 17.7 18.5 14.8 20.6 12 19.3 9.2 20.6 6.3 18.5 6.3 15.3 3.8 10.6 5.1 4.3Z"
        fill={color}
      />
      <Path d="M8.3 8.3 11.1 9.7 10.2 12.4 7.5 11.2Z" fill={C.void} />
      <Path d="M15.7 8.3 12.9 9.7 13.8 12.4 16.5 11.2Z" fill={C.void} />
      <Path d="M11.2 13.1 12.8 13.1 12 15.1Z" fill={C.void} />
      <Path d="M8.5 16.1 15.5 16.1 15.5 18.3 8.5 18.3Z" fill={C.void} />
      <Line x1="10.3" y1="16.1" x2="10.3" y2="18.3" stroke={color} strokeWidth={0.9} />
      <Line x1="12" y1="16.1" x2="12" y2="18.3" stroke={color} strokeWidth={0.9} />
      <Line x1="13.7" y1="16.1" x2="13.7" y2="18.3" stroke={color} strokeWidth={0.9} />
    </Svg>
  );
}

/** Map marker: skull on a dark disc with a coloured ring and a ground shadow. */
export function ZombieMarkerGlyph({
  size = 34,
  color = C.toxicDim,
  pulse = 0,
}: {
  size?: number;
  color?: string;
  pulse?: number;
}) {
  const r = 15;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Defs>
        <RadialGradient id="zglow" cx="50%" cy="50%" r="50%">
          <Stop offset="55%" stopColor={color} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="18" cy="18" r="18" fill="url(#zglow)" opacity={0.4 + pulse * 0.6} />
      <Circle cx="18" cy="18" r={r} fill={C.void} opacity={0.92} />
      <Circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth={2} />
      <G transform="translate(6 6) scale(0.98)">
        <Path
          d="M12 1.4 18.9 4.3 20.2 10.6 17.7 15.3 17.7 18.5 14.8 20.6 12 19.3 9.2 20.6 6.3 18.5 6.3 15.3 3.8 10.6 5.1 4.3Z"
          fill={color}
        />
        <Path d="M8.3 8.3 11.1 9.7 10.2 12.4 7.5 11.2Z" fill={C.void} />
        <Path d="M15.7 8.3 12.9 9.7 13.8 12.4 16.5 11.2Z" fill={C.void} />
        <Path d="M8.5 16.1 15.5 16.1 15.5 18.3 8.5 18.3Z" fill={C.void} />
      </G>
    </Svg>
  );
}

/** The player: a chevron that points where you are actually facing. */
export function PlayerGlyph({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <RadialGradient id="pglow" cx="50%" cy="50%" r="50%">
          <Stop offset="40%" stopColor={C.ice} stopOpacity={0.45} />
          <Stop offset="100%" stopColor={C.ice} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="16" cy="16" r="16" fill="url(#pglow)" />
      <Circle cx="16" cy="16" r="11" fill={C.void} opacity={0.9} />
      <Path d="M16 5 24 24 16 19.6 8 24Z" fill={C.ice} />
      <Path d="M16 5 24 24 16 19.6Z" fill={C.bone} opacity={0.85} />
    </Svg>
  );
}

/* ---------------------------------------------------------------- supplies */

export function MedkitIcon({ size = 24, color = C.blood, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Rect x="2.5" y="6" width="19" height="13.5" rx="2.4" fill={color} />
      <Path d="M8.5 6V4.6c0-.9.7-1.6 1.6-1.6h3.8c.9 0 1.6.7 1.6 1.6V6" fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M10.6 9.4h2.8v2.4h2.4v2.8h-2.4v2.4h-2.8v-2.4H8.2v-2.8h2.4Z" fill={C.void} />
    </Svg>
  );
}

export function SyringeIcon({ size = 24, color = C.hazard, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <G stroke={color} strokeWidth={1.9} strokeLinecap="round" fill="none">
        <Line x1="15.6" y1="3.2" x2="20.8" y2="8.4" />
        <Line x1="3.2" y1="20.8" x2="7.4" y2="16.6" />
        <Line x1="13.4" y1="9.2" x2="15.4" y2="11.2" />
        <Line x1="11.2" y1="11.4" x2="13.2" y2="13.4" />
      </G>
      <Path
        d="M17.2 5.6 18.4 6.8 10.9 14.3 7.2 17.9 6 16.7 9.7 13.1Z"
        fill={color}
      />
      <Path d="M14.4 4.4 19.6 9.6 18.1 11.1 12.9 5.9Z" fill={color} opacity={0.55} />
    </Svg>
  );
}

export function FlareIcon({ size = 24, color = C.sodium, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Rect x="9.6" y="10.4" width="4.8" height="11" rx="1.2" fill={color} opacity={0.85} />
      <Rect x="9.6" y="10.4" width="4.8" height="3" rx="1.2" fill={C.bone} />
      <Path d="M12 1.2c2.4 2.5 3.6 4.6 3.6 6.4 0 2-1.6 3.4-3.6 3.4S8.4 9.6 8.4 7.6c0-1.8 1.2-3.9 3.6-6.4Z" fill={color} />
      <Path d="M12 3.8c1.2 1.5 1.8 2.7 1.8 3.7 0 1.1-.8 1.8-1.8 1.8s-1.8-.7-1.8-1.8c0-1 .6-2.2 1.8-3.7Z" fill={C.hazard} />
    </Svg>
  );
}

export function SupplyMarkerGlyph({
  kind,
  size = 34,
  color,
}: {
  kind: 'medkit' | 'adrenaline' | 'flare';
  size?: number;
  color: string;
}) {
  const Inner = kind === 'medkit' ? MedkitIcon : kind === 'adrenaline' ? SyringeIcon : FlareIcon;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Defs>
        <RadialGradient id="sglow" cx="50%" cy="50%" r="50%">
          <Stop offset="50%" stopColor={color} stopOpacity={0.4} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="18" cy="18" r="18" fill="url(#sglow)" />
      <Polygon
        points="18,3 31,10.5 31,25.5 18,33 5,25.5 5,10.5"
        fill={C.void}
        opacity={0.94}
        stroke={color}
        strokeWidth={2}
      />
      <G transform="translate(6.5 6.5) scale(0.96)">
        <Inner size={24} color={color} />
      </G>
    </Svg>
  );
}

/* --------------------------------------------------------------------- HUD */

export function HeartIcon({ size = 24, color = C.blood, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path
        d="M12 21.2 4.3 13.6C2.2 11.5 2.3 8.1 4.5 6.2 6.6 4.4 9.7 4.9 11.3 7L12 7.9 12.7 7C14.3 4.9 17.4 4.4 19.5 6.2 21.7 8.1 21.8 11.5 19.7 13.6Z"
        fill={color}
      />
    </Svg>
  );
}

export function HeartEmptyIcon({ size = 24, color = C.ash, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path
        d="M12 21.2 4.3 13.6C2.2 11.5 2.3 8.1 4.5 6.2 6.6 4.4 9.7 4.9 11.3 7L12 7.9 12.7 7C14.3 4.9 17.4 4.4 19.5 6.2 21.7 8.1 21.8 11.5 19.7 13.6Z"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
      />
    </Svg>
  );
}

export function WaveIcon({ size = 24, color = C.sodium, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <G fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4 9.5 12 4 20 9.5" />
        <Path d="M4 14.5 12 9 20 14.5" opacity={0.7} />
        <Path d="M4 19.5 12 14 20 19.5" opacity={0.4} />
      </G>
    </Svg>
  );
}

export function BootIcon({ size = 24, color = C.bone, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path
        d="M9.4 2.4c2.2 0 3.6 1.7 3.6 4.2 0 1.9-.7 3.4-.7 5.1 0 1 .4 1.7.4 2.7 0 2.1-1.6 3.4-3.6 3.4S5.5 16.5 5.5 14.4c0-1 .4-1.7.4-2.7 0-1.7-.7-3.2-.7-5.1 0-2.5 1.4-4.2 3.6-4.2Z"
        fill={color}
      />
      <Circle cx="15.6" cy="6.6" r="1.9" fill={color} opacity={0.75} />
      <Circle cx="17.4" cy="11.2" r="1.7" fill={color} opacity={0.55} />
      <Circle cx="17.9" cy="15.6" r="1.5" fill={color} opacity={0.35} />
      <Path d="M6 19.6h6.8c0 1.4-1.5 2.4-3.4 2.4S6 21 6 19.6Z" fill={color} opacity={0.8} />
    </Svg>
  );
}

export function SpeedIcon({ size = 24, color = C.ice, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path
        d="M3.2 18.4A10 10 0 1 1 20.8 18.4"
        fill="none"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
      />
      <Path d="M12 13.2 17.4 7.8 13.6 14.4Z" fill={color} />
      <Circle cx="12" cy="14.4" r="2" fill={color} />
    </Svg>
  );
}

export function SignalIcon({ size = 24, color = C.toxic, opacity = 1, bars = 3 }: IconProps & { bars?: number }) {
  const heights = [5, 8, 11, 14];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      {heights.map((h, i) => (
        <Rect
          key={i}
          x={3 + i * 5}
          y={19 - h}
          width="3.4"
          height={h}
          rx="1"
          fill={color}
          opacity={i < bars ? 1 : 0.22}
        />
      ))}
    </Svg>
  );
}

export function ThreatArrow({ size = 24, color = C.blood, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path d="M12 2.4 20 20.4 12 16.2 4 20.4Z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 24, color = C.bone, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Rect x="6" y="4.5" width="4.2" height="15" rx="1.3" fill={color} />
      <Rect x="13.8" y="4.5" width="4.2" height="15" rx="1.3" fill={color} />
    </Svg>
  );
}

export function PlayIcon({ size = 24, color = C.void, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path d="M6.5 3.8 20 12 6.5 20.2Z" fill={color} />
    </Svg>
  );
}

export function EyeOffIcon({ size = 24, color = C.bone, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path
        d="M2.5 12S6.2 5.6 12 5.6c1.7 0 3.2.5 4.5 1.3M21.5 12s-3.7 6.4-9.5 6.4c-1.8 0-3.4-.6-4.7-1.4"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="12" r="3.1" fill="none" stroke={color} strokeWidth={1.9} />
      <Line x1="3.6" y1="3.6" x2="20.4" y2="20.4" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  );
}

export function ShieldIcon({ size = 24, color = C.ice, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path d="M12 2.2 20 5.4v6.2c0 5-3.4 8.6-8 10.2-4.6-1.6-8-5.2-8-10.2V5.4Z" fill="none" stroke={color} strokeWidth={1.9} />
      <Path d="M8.2 12.1 11 14.9 16 9.6" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronIcon({ size = 24, color = C.ash, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path d="M9 5 16 12 9 19" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrophyIcon({ size = 24, color = C.hazard, opacity = 1 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path d="M7 3h10v5.2c0 2.9-2.2 5.2-5 5.2s-5-2.3-5-5.2Z" fill={color} />
      <Path d="M7 4.6H4.4v1.8c0 1.9 1.2 3.2 2.8 3.4M17 4.6h2.6v1.8c0 1.9-1.2 3.2-2.8 3.4" fill="none" stroke={color} strokeWidth={1.7} />
      <Rect x="10.6" y="13.2" width="2.8" height="4.4" fill={color} />
      <Rect x="7" y="17.4" width="10" height="3.4" rx="1.2" fill={color} />
    </Svg>
  );
}

/* ------------------------------------------------------------------- brand */

/** DEADRUN mark: a sprinter inside a hazard hex, three claw slashes across. */
export function DeadrunMark({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="hex" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={C.toxic} />
          <Stop offset="100%" stopColor={C.toxicDim} />
        </LinearGradient>
        <LinearGradient id="claw" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={C.blood} />
          <Stop offset="100%" stopColor={C.bloodDeep} />
        </LinearGradient>
      </Defs>

      <Polygon points="50,4 89,26 89,74 50,96 11,74 11,26" fill={C.void} />
      <Polygon
        points="50,4 89,26 89,74 50,96 11,74 11,26"
        fill="none"
        stroke="url(#hex)"
        strokeWidth={4}
      />
      <Polygon
        points="50,13 81,31 81,69 50,87 19,69 19,31"
        fill="none"
        stroke={C.toxicDim}
        strokeWidth={1.4}
        opacity={0.55}
      />

      {/* claw slashes, behind the figure so the runner stays readable */}
      <G fill="url(#claw)">
        <Path d="M17 19 Q43.8 56.4 84 79 Q57.2 41.6 17 19Z" opacity={0.9} />
        <Path d="M33 8 Q57 41.8 92 64 Q68 30.2 33 8Z" opacity={0.6} />
        <Path d="M10 33 Q29.7 66.6 60 91 Q40.3 57.4 10 33Z" opacity={0.45} />
      </G>

      {/* sprinter */}
      <G stroke={C.bone} strokeWidth={6.4} strokeLinecap="round" fill="none">
        <Path d="M52 34 L43 54" />
        <Path d="M51 39 L66 42 L72 55" />
        <Path d="M48 41 L34 37 L27 45" />
        <Path d="M43 54 L52 65 L47 80" />
        <Path d="M43 54 L30 60 L21 55" />
      </G>
      <Circle cx="56" cy="26" r="7.6" fill={C.bone} />

    </Svg>
  );
}

/** Wordmark used under the badge on the title screen. */
export function DeadrunWordmark({ width = 240 }: { width?: number }) {
  const height = (width * 44) / 260;
  return (
    <Svg width={width} height={height} viewBox="0 0 260 44">
      <Defs>
        <LinearGradient id="wm" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={C.bone} />
          <Stop offset="55%" stopColor={C.bone} />
          <Stop offset="100%" stopColor={C.blood} />
        </LinearGradient>
      </Defs>
      <G fill="url(#wm)" fillRule="evenodd">
        {/* D */}
        <Path d="M2 4h16c9 0 14 7 14 18s-5 18-14 18H2Zm10 8v20h5c4 0 6-4 6-10s-2-10-6-10Z" />
        {/* E */}
        <Path d="M40 4h26v8H50v6h13v8H50v6h16v8H40Z" />
        {/* A */}
        <Path d="M72 40 83 4h12l11 36H95l-1.6-6h-7.8L84 40Zm15.5-14h3l-1.5-7Z" />
        {/* D */}
        <Path d="M112 4h16c9 0 14 7 14 18s-5 18-14 18h-16Zm10 8v20h5c4 0 6-4 6-10s-2-10-6-10Z" />
        {/* R */}
        <Path d="M150 4h17c8 0 13 5 13 12 0 5-2.5 9-6.5 11l7.5 13h-11.5l-6.5-11h-3v11h-10Zm10 8v9h5c2.4 0 4-1.9 4-4.5S167.4 12 165 12Z" />
        {/* U */}
        <Path d="M188 4h10v23c0 3.2 2 5.2 5 5.2s5-2 5-5.2V4h10v24c0 8.4-6 13.4-15 13.4S188 36.4 188 28Z" />
        {/* N */}
        <Path d="M224 4h9.5L244 21V4h9.5v36H244l-10.5-17v17H224Z" />
      </G>
    </Svg>
  );
}
