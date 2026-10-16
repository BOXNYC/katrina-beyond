import { useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, ClipPath, Defs, Line, Polygon, Rect } from "react-native-svg";
import { colors } from "../theme";
import type { Level } from "../lib/barrierIsland";

const W = 300;
const H = 64;
const STOPS = [24, 150, 276];
const edgeY = (x: number) => H - (x / W) * H;

/**
 * Three-stop slider drawn as a triangle that grows from low to high. Tapping
 * or dragging anywhere on the triangle snaps to the nearest stop.
 */
export default function LevelSlider({
  label,
  value,
  labels,
  disabled,
  onChange,
}: {
  label: string;
  value: Level;
  labels: readonly string[];
  disabled?: boolean;
  onChange: (level: Level) => void;
}) {
  const x = STOPS[value];
  const id = `fill-${label.replace(/\W+/g, "-")}`;
  const [width, setWidth] = useState(0);

  // Latest props for the PanResponder, which is created once.
  const live = useRef({ width, disabled, value, onChange });
  live.current = { width, disabled, value, onChange };

  const pick = (locationX: number) => {
    const { width: w, disabled: off, value: current, onChange: emit } = live.current;
    if (off || w === 0) return;
    const px = (locationX / w) * W;
    let best = 0;
    STOPS.forEach((s, i) => {
      if (Math.abs(s - px) < Math.abs(STOPS[best] - px)) best = i;
    });
    if (best !== current) emit(best as Level);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View style={[styles.root, disabled && { opacity: 0.6 }]}>
      <View
        {...pan.panHandlers}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: labels[value] }}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          if (disabled) return;
          const next = value + (e.nativeEvent.actionName === "increment" ? 1 : -1);
          if (next >= 0 && next <= 2) onChange(next as Level);
        }}
      >
        <Svg viewBox={`0 0 ${W} ${H + 8}`} width="100%" style={{ aspectRatio: W / (H + 8) }} pointerEvents="none">
          <Defs>
            <ClipPath id={id}>
              <Rect x={0} y={0} width={x} height={H + 8} />
            </ClipPath>
          </Defs>
          <Polygon points={`0,${H} ${W},${H} ${W},0`} fill={colors.track} />
          <Polygon points={`0,${H} ${W},${H} ${W},0`} fill={colors.accent} clipPath={`url(#${id})`} />
          {STOPS.map((s) => (
            <Line
              key={s}
              x1={s}
              x2={s}
              y1={edgeY(s)}
              y2={H}
              stroke={colors.bg}
              strokeWidth={2}
              strokeDasharray="3 4"
            />
          ))}
          <Circle cx={x} cy={edgeY(x)} r={13} fill="#fff" stroke={colors.accentDark} strokeWidth={4} />
        </Svg>
      </View>
      <View style={styles.labels}>
        {([0, 1, 2] as const).map((l) => (
          <Text
            key={l}
            style={[styles.label, value === l && styles.labelActive]}
          >
            {labels[l]}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%" },
  labels: { flexDirection: "row", marginTop: 4 },
  label: { flex: 1, textAlign: "center", fontSize: 16, color: colors.muted },
  labelActive: { fontWeight: "600", color: colors.sky },
});
