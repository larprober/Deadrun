import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle as SvgCircle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { PROXIMITY_WARN_M, PICKUP_RADIUS_M } from '../config';
import { bearingDelta, distanceM, type LatLng } from '../geo';
import {
  ATTRIBUTION,
  metresToPx,
  project,
  TILE_COUNT,
  TILE_DRAW,
  TILE_SCALE,
  TILE_SIZE,
  tileUrl,
  tileWindow,
  followCamera,
  type Point,
} from '../tiles';
import { C, KIND_COLOR, MONO, SUPPLY_COLOR } from '../theme';
import type { GameState } from '../types';
import { PlayerGlyph, SupplyMarkerGlyph, ZombieMarkerGlyph } from '../icons';

/** Only the closest few are worth drawing; the rest are noise at this zoom. */
const MAX_DRAWN_ZOMBIES = 14;
/** GPS lands about once a second, so glide over roughly that long. */
const CAMERA_MS = 950;
const HEADING_MS = 700;
/**
 * Cover this much map beyond the edge of the screen. The camera glides a fix
 * behind the runner, so the real edge sits a little further out than it looks,
 * and a tile that starts downloading only once it is on screen arrives late.
 * A margin in dp rather than a whole ring of tiles: at this zoom one ring is
 * another 24 downloads.
 */
const MARGIN_DP = 120;


export type MapOrientation = 'north' | 'course';

type Props = {
  state: GameState;
  trail: LatLng[];
  orientation: MapOrientation;
  /** Live compass bearing; see facingDeg. Not the frozen fix heading. */
  facing: number;
};

export default function MapCanvas({ state, trail, orientation, facing }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const player = state.player;
  const center = player?.pos ?? state.origin;

  const centerPx = useMemo(
    () => (center ? project(center) : null),
    [center?.latitude, center?.longitude]
  );

  /* --- which tiles cover the screen ------------------------------------- */
  // Course-up spins the whole layer, so every corner has to stay covered at
  // any angle: that is the circle the viewport is inscribed in.
  const spun = orientation === 'course';
  const half = spun ? Math.hypot(size.w, size.h) / 2 : 0;
  const reachX = (spun ? half : size.w / 2) + MARGIN_DP;
  const reachY = (spun ? half : size.h / 2) + MARGIN_DP;

  /* --- where the camera sits, which is not where the runner is ----------- */
  const [cam, setCam] = useState<Point | null>(null);

  useEffect(() => {
    if (!centerPx || size.w === 0) return;
    setCam((prev) =>
      // Course-up spins the world about the middle of the screen, so there the
      // runner has to stay put or the rotation would swing them around it.
      !prev || spun ? centerPx : followCamera(prev, centerPx, size)
    );
  }, [centerPx?.x, centerPx?.y, size.w, size.h, spun]);

  const view = cam ?? centerPx;
  const win = view && size.w > 0 ? tileWindow(view, reachX, reachY) : null;

  // The grid only shifts when the runner crosses a tile edge, so everything
  // below is laid out relative to it and stays put between fixes. Only the
  // camera transform moves, and that one runs on the UI thread.
  const gridX = win ? win.minTx * TILE_SIZE : 0;
  const gridY = win ? win.minTy * TILE_SIZE : 0;
  const cols = win ? win.maxTx - win.minTx + 1 : 0;
  const rows = win ? win.maxTy - win.minTy + 1 : 0;
  const layerW = Math.round(cols * TILE_DRAW);
  const layerH = Math.round(rows * TILE_DRAW);

  const tiles = useMemo(() => {
    if (!win) return [];
    const out: {
      key: string;
      uri: string;
      left: number;
      top: number;
      w: number;
      h: number;
    }[] = [];
    for (let ty = win.minTy; ty <= win.maxTy; ty++) {
      if (ty < 0 || ty >= TILE_COUNT) continue;
      const row = ty - win.minTy;
      const top = Math.round(row * TILE_DRAW);
      for (let tx = win.minTx; tx <= win.maxTx; tx++) {
        const col = tx - win.minTx;
        const left = Math.round(col * TILE_DRAW);
        out.push({
          key: tx + '/' + ty,
          uri: tileUrl(tx, ty),
          left,
          top,
          // Snap to whole dp and overlap by one, or hairline seams show through.
          w: Math.round((col + 1) * TILE_DRAW) - left + 1,
          h: Math.round((row + 1) * TILE_DRAW) - top + 1,
        });
      }
    }
    return out;
  }, [win?.minTx, win?.maxTx, win?.minTy, win?.maxTy]);

  /** A world coordinate as a point inside the tile layer. */
  const toLayer = (p: LatLng) => {
    const q = project(p);
    return { x: (q.x - gridX) * TILE_SCALE, y: (q.y - gridY) * TILE_SCALE };
  };

  /* --- camera ------------------------------------------------------------ */
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const txNow = useRef(0);
  const tyNow = useRef(0);
  const gridRef = useRef<{ x: number; y: number } | null>(null);
  const placedRef = useRef(false);

  useEffect(() => {
    const a = tx.addListener((e) => {
      txNow.current = e.value;
    });
    const b = ty.addListener((e) => {
      tyNow.current = e.value;
    });
    return () => {
      tx.removeListener(a);
      ty.removeListener(b);
    };
  }, [tx, ty]);

  const targetX = view ? size.w / 2 - (view.x - gridX) * TILE_SCALE : 0;
  const targetY = view ? size.h / 2 - (view.y - gridY) * TILE_SCALE : 0;

  useEffect(() => {
    if (!win || !view) return;
    const prev = gridRef.current;
    if (prev && (prev.x !== gridX || prev.y !== gridY)) {
      // The tile window moved and took every child with it. Cancel that out on
      // the camera in the same commit so the map does not visibly jump.
      tx.setValue(txNow.current + (gridX - prev.x) * TILE_SCALE);
      ty.setValue(tyNow.current + (gridY - prev.y) * TILE_SCALE);
    }
    gridRef.current = { x: gridX, y: gridY };

    if (!placedRef.current) {
      placedRef.current = true;
      tx.setValue(targetX);
      ty.setValue(targetY);
      return;
    }
    Animated.parallel([
      Animated.timing(tx, {
        toValue: targetX,
        duration: CAMERA_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(ty, {
        toValue: targetY,
        duration: CAMERA_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetX, targetY, gridX, gridY]);

  /* --- course-up rotation ------------------------------------------------ */
  const spin = useRef(new Animated.Value(0)).current;
  // Kept unwrapped, so turning from 359 degrees to 1 turns two degrees rather
  // than whipping back round the long way.
  const spinTarget = useRef(0);
  const heading = facing;

  useEffect(() => {
    const want = spun ? (360 - heading + 360) % 360 : 0;
    const current = ((spinTarget.current % 360) + 360) % 360;
    spinTarget.current += bearingDelta(current, want);
    Animated.timing(spin, {
      toValue: spinTarget.current,
      duration: HEADING_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [heading, spun, spin]);

  const rotate = spin.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  /* --- what to draw ------------------------------------------------------ */
  const drawn = useMemo(() => {
    if (!player) return [];
    return state.zombies
      .map((z) => ({ z, d: distanceM(z.pos, player.pos) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_DRAWN_ZOMBIES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.zombies, player?.at]);

  const trailPath = useMemo(() => {
    if (trail.length < 2) return null;
    return trail
      .map((p, i) => {
        const q = toLayer(p);
        return (i === 0 ? 'M' : 'L') + q.x.toFixed(1) + ' ' + q.y.toFixed(1);
      })
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail, gridX, gridY]);

  const lat = center?.latitude ?? 0;
  const warnR = metresToPx(PROXIMITY_WARN_M, lat);
  const pickupR = metresToPx(PICKUP_RADIUS_M, lat);
  const playerAt = player ? toLayer(player.pos) : null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  };

  return (
    <View style={st.root} onLayout={onLayout}>
      {win && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}
        >
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: layerW,
              height: layerH,
              transform: [{ translateX: tx }, { translateY: ty }],
            }}
          >
            <DeadGrid width={layerW} height={layerH} />

            {tiles.map((t) => (
              <Image
                key={t.key}
                source={{ uri: t.uri }}
                style={{
                  position: 'absolute',
                  left: t.left,
                  top: t.top,
                  width: t.w,
                  height: t.h,
                }}
                fadeDuration={160}
              />
            ))}

            {/* Drag the basemap the rest of the way toward the game palette. */}
            <View style={[StyleSheet.absoluteFill, st.tint]} />

            <Svg width={layerW} height={layerH} style={StyleSheet.absoluteFill}>
              {trailPath && (
                <Path
                  d={trailPath}
                  stroke={C.ice}
                  strokeWidth={4}
                  strokeOpacity={0.85}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}

              {playerAt && (
                <SvgCircle
                  cx={playerAt.x}
                  cy={playerAt.y}
                  r={warnR}
                  stroke="rgba(255,59,48,0.35)"
                  strokeWidth={1}
                  fill="rgba(255,59,48,0.06)"
                />
              )}

              {/* Which way you are pointed. The arrow on its own is small and
                  easy to misread at a glance mid-run; a wedge is not. */}
              {playerAt && (
                <Path
                  d={conePath(playerAt.x, playerAt.y, metresToPx(55, lat))}
                  fill={C.ice}
                  fillOpacity={0.12}
                  rotation={facing}
                  originX={playerAt.x}
                  originY={playerAt.y}
                />
              )}

              {state.supplies.map((s) => {
                const q = toLayer(s.pos);
                return (
                  <SvgCircle
                    key={s.id}
                    cx={q.x}
                    cy={q.y}
                    r={pickupR}
                    stroke={SUPPLY_COLOR[s.kind]}
                    strokeWidth={2}
                    fill="rgba(255,160,51,0.14)"
                  />
                );
              })}
            </Svg>

            {state.supplies.map((s) => {
              const q = toLayer(s.pos);
              return (
                <Glyph key={s.id} x={q.x} y={q.y} size={40}>
                  <SupplyMarkerGlyph kind={s.kind} color={SUPPLY_COLOR[s.kind]} size={40} />
                </Glyph>
              );
            })}

            {drawn.map(({ z, d }) => {
              const q = toLayer(z.pos);
              const glyph = z.kind === 'brute' ? 44 : 34;
              return (
                <Glyph key={z.id} x={q.x} y={q.y} size={glyph}>
                  <ZombieMarkerGlyph
                    color={KIND_COLOR[z.kind]}
                    size={glyph}
                    pulse={Math.max(0, 1 - d / 120)}
                  />
                </Glyph>
              );
            })}

            {player && playerAt && (
              <Glyph
                x={playerAt.x}
                y={playerAt.y}
                size={34}
                // The layer itself spins by -heading in course-up, so pointing
                // the arrow along the heading leaves it upright in both modes.
                rotation={facing}
              >
                <PlayerGlyph size={34} />
              </Glyph>
            )}
          </Animated.View>
        </Animated.View>
      )}

      <Text style={st.attribution}>{ATTRIBUTION}</Text>
    </View>
  );
}

/** Half-width of the facing wedge. Wide enough to read, narrow enough to mean something. */
const CONE_HALF_DEG = 26;

/** A wedge opening upward from (cx, cy), to be rotated onto the current facing. */
function conePath(cx: number, cy: number, r: number): string {
  const a = (CONE_HALF_DEG * Math.PI) / 180;
  const dx = r * Math.sin(a);
  const dy = r * Math.cos(a);
  return (
    'M ' + cx + ' ' + cy +
    ' L ' + (cx - dx).toFixed(1) + ' ' + (cy - dy).toFixed(1) +
    ' A ' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' +
    (cx + dx).toFixed(1) + ' ' + (cy - dy).toFixed(1) +
    ' Z'
  );
}

/** A marker pinned to a point in the tile layer, centred on it. */
function Glyph({
  x,
  y,
  size,
  rotation,
  children,
}: {
  x: number;
  y: number;
  size: number;
  rotation?: number;
  children: React.ReactNode;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: rotation ? [{ rotate: rotation + 'deg' }] : undefined,
      }}
    >
      {children}
    </View>
  );
}

/** What the city looks like before the tiles land, or if they never do. */
function DeadGrid({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="deadgrid" width={64} height={64} patternUnits="userSpaceOnUse">
          <Path
            d="M64 0H0V64"
            fill="none"
            stroke={C.panelEdge}
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={C.night} />
      <Rect x={0} y={0} width={width} height={height} fill="url(#deadgrid)" />
    </Svg>
  );
}

const st = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.night,
    overflow: 'hidden',
  },
  tint: { backgroundColor: 'rgba(5,7,10,0.30)' },
  attribution: {
    ...MONO,
    position: 'absolute',
    left: 14,
    bottom: 8,
    fontSize: 8,
    letterSpacing: 0.5,
    color: C.ash,
    opacity: 0.5,
  },
});
