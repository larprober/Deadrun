import React, { useMemo } from 'react';
import Svg, { Circle, G, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { bearingDeg, bearingDelta, distanceM, toRad } from '../geo';
import { C, KIND_COLOR, SUPPLY_COLOR } from '../theme';
import type { GameState } from '../types';

const RANGE_M = 180;

type Props = { state: GameState; size?: number; facing: number };

/**
 * Top-down threat scope, always oriented nose-up. Contacts beyond the range
 * ring are pinned to the edge as slivers so you still know which way to run.
 */
export default function Radar({ state, size = 132, facing }: Props) {
  const player = state.player;
  const r = size / 2;
  const usable = r - 8;
  const heading = facing;

  const contacts = useMemo(() => {
    if (!player) return [];
    return state.zombies.map((z) => {
      const d = distanceM(z.pos, player.pos);
      const brg = bearingDelta(heading, bearingDeg(player.pos, z.pos));
      const clamped = Math.min(d, RANGE_M);
      const radius = (clamped / RANGE_M) * usable;
      const a = toRad(brg - 90);
      return {
        id: z.id,
        x: r + radius * Math.cos(a),
        y: r + radius * Math.sin(a),
        color: KIND_COLOR[z.kind],
        edge: d > RANGE_M,
        size: z.kind === 'brute' ? 4.6 : 3.4,
      };
    });
  }, [state.zombies, player?.at, heading, usable, r]);

  const supply = useMemo(() => {
    if (!player || state.supplies.length === 0) return null;
    const s = state.supplies[0];
    const d = distanceM(s.pos, player.pos);
    const brg = bearingDelta(heading, bearingDeg(player.pos, s.pos));
    const radius = (Math.min(d, RANGE_M) / RANGE_M) * usable;
    const a = toRad(brg - 90);
    return {
      x: r + radius * Math.cos(a),
      y: r + radius * Math.sin(a),
      color: SUPPLY_COLOR[s.kind],
      distance: d,
    };
  }, [state.supplies, player?.at, heading, usable, r]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={r} cy={r} r={usable} fill={C.void} opacity={0.72} />
      <Circle cx={r} cy={r} r={usable} fill="none" stroke={C.panelEdge} strokeWidth={1.4} />
      <Circle cx={r} cy={r} r={usable * 0.66} fill="none" stroke={C.panelEdge} strokeWidth={1} opacity={0.7} />
      <Circle cx={r} cy={r} r={usable * 0.33} fill="none" stroke={C.panelEdge} strokeWidth={1} opacity={0.5} />
      <Line x1={r} y1={r - usable} x2={r} y2={r + usable} stroke={C.panelEdge} strokeWidth={0.8} opacity={0.6} />
      <Line x1={r - usable} y1={r} x2={r + usable} y2={r} stroke={C.panelEdge} strokeWidth={0.8} opacity={0.6} />

      {/* forward cone */}
      <Path
        d={`M ${r} ${r} L ${r - usable * 0.42} ${r - usable * 0.92} A ${usable} ${usable} 0 0 1 ${
          r + usable * 0.42
        } ${r - usable * 0.92} Z`}
        fill={C.ice}
        opacity={0.07}
      />

      {supply && (
        <G>
          <Circle cx={supply.x} cy={supply.y} r={6.5} fill="none" stroke={supply.color} strokeWidth={1.6} />
          <Circle cx={supply.x} cy={supply.y} r={2.4} fill={supply.color} />
        </G>
      )}

      {contacts.map((c) => (
        <Circle
          key={c.id}
          cx={c.x}
          cy={c.y}
          r={c.size}
          fill={c.color}
          opacity={c.edge ? 0.38 : 1}
        />
      ))}

      <Polygon
        points={`${r},${r - 7} ${r + 5},${r + 5} ${r},${r + 2} ${r - 5},${r + 5}`}
        fill={C.bone}
      />
      <SvgText
        x={r}
        y={size - 1.5}
        fill={C.ash}
        fontSize={8}
        fontFamily="monospace"
        textAnchor="middle"
      >
        {RANGE_M + 'm'}
      </SvgText>
    </Svg>
  );
}
