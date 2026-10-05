import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ArcProps {
  size: number;
  thickness: number;
  /** 0..1 of the circle, clockwise from the top. */
  progress: number;
  color: string;
  opacity?: number;
}

/**
 * A smooth arc made of two half-circle masks, so it needs no drawing library.
 * A circle with only its top and right borders coloured is a 180 degree arc;
 * each half is turned to show as much of it as `progress` needs.
 */
function Arc({ size, thickness, progress, color, opacity = 1 }: ArcProps) {
  const angle = Math.max(0, Math.min(1, progress)) * 360;
  const right = Math.min(angle, 180);
  const left = Math.max(angle - 180, 0);
  const half = size / 2;
  const ring = {
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: thickness,
    borderTopColor: color,
    borderRightColor: color,
  };
  return (
    <View
      pointerEvents="none"
      style={[styles.fill, { width: size, height: size, opacity }]}
    >
      <View
        style={[styles.rightHalf, { left: half, width: half, height: size }]}
      >
        <View
          style={[
            styles.circle,
            ring,
            { left: -half, transform: [{ rotate: `${right - 135}deg` }] },
          ]}
        />
      </View>
      <View style={[styles.leftHalf, { width: half, height: size }]}>
        <View
          style={[
            styles.circle,
            ring,
            { transform: [{ rotate: `${left + 45}deg` }] },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * The countdown ring of the lose screen: a dark disc with a faint track, a
 * soft glow and a thick bright blue arc with rounded ends and a few sparkles
 * at its tip. The arc shrinks as time runs out.
 */
export function ArcProgress({
  size = 200,
  thickness = 14,
  progress,
  color = '#3FA9FF',
}: {
  size?: number;
  thickness?: number;
  progress: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = size / 2 - thickness / 2;
  const at = (fraction: number, r: number) => {
    const theta = fraction * 2 * Math.PI;
    return {
      x: size / 2 + r * Math.sin(theta),
      y: size / 2 - r * Math.cos(theta),
    };
  };
  const start = at(0, radius);
  const end = at(clamped, radius);
  const cap = thickness;
  const sparkle = (fraction: number, r: number, d: number) => {
    const p = at(fraction, r);
    return {
      left: p.x - d / 2,
      top: p.y - d / 2,
      width: d,
      height: d,
      borderRadius: d / 2,
    };
  };
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.disc,
          {
            width: size * 1.2,
            height: size * 1.2,
            borderRadius: size * 0.6,
            left: -size * 0.1,
            top: -size * 0.1,
          },
        ]}
      />
      <View
        style={[
          styles.track,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: thickness * 0.4,
          },
        ]}
      />
      <Arc
        size={size}
        thickness={thickness + 12}
        progress={clamped}
        color={color}
        opacity={0.22}
      />
      <Arc size={size} thickness={thickness} progress={clamped} color={color} />
      {clamped > 0.01 ? (
        <>
          <View
            style={[
              styles.cap,
              {
                left: start.x - cap / 2,
                top: start.y - cap / 2,
                width: cap,
                height: cap,
                borderRadius: cap / 2,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.cap,
              {
                left: end.x - cap / 2,
                top: end.y - cap / 2,
                width: cap,
                height: cap,
                borderRadius: cap / 2,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[styles.spark, sparkle(clamped + 0.012, radius - 22, 4)]}
          />
          <View
            style={[styles.spark, sparkle(clamped + 0.03, radius - 16, 3)]}
          />
          <View
            style={[styles.spark, sparkle(clamped + 0.045, radius - 30, 3)]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0 },
  rightHalf: { position: 'absolute', top: 0, overflow: 'hidden' },
  leftHalf: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  circle: {
    position: 'absolute',
    top: 0,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  disc: { position: 'absolute', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  track: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  cap: { position: 'absolute' },
  spark: { position: 'absolute', backgroundColor: 'rgba(200, 235, 255, 0.95)' },
});
