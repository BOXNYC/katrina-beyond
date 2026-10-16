import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { Level, ModifierId } from "../lib/barrierIsland";
import { colors } from "../theme";

// All geometry is in artboard units (see Scene STAGE_W/STAGE_H) times `s`.
const PILL = { w: 54, h: 104, knob: 50, pad: 4 };
const DOT = 54;
const LEVEE_Y = [678, 744, 808]; // centers of the three stops
const LABEL_FONT = 30;

const TOGGLES: { id: Exclude<ModifierId, "levee">; label: string; x: number }[] = [
  { id: "barrierIsland", label: "Barrier\nIsland", x: 364 },
  { id: "marsh", label: "Marsh\nLandbridge", x: 706 },
  { id: "ridge", label: "Natural\nRidge", x: 1056 },
];
const LEVEE_X = 1601;

type Props = {
  s: number;
  levels: Record<ModifierId, Level>;
  disabled?: boolean;
  onChange: (id: ModifierId, level: Level) => void;
};

export default function Controls({ s, levels, disabled, onChange }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={disabled ? "none" : "box-none"}>
      {TOGGLES.map((t) => (
        <PillToggle
          key={t.id}
          s={s}
          x={t.x}
          label={t.label}
          on={levels[t.id] === 2}
          onToggle={() => onChange(t.id, levels[t.id] === 2 ? 0 : 2)}
        />
      ))}
      <LeveeStops s={s} value={levels.levee} onChange={(l) => onChange("levee", l)} />
    </View>
  );
}

function Knob({ size, s }: { size: number; s: number }) {
  return (
    <View
      style={{
        width: size * s,
        height: size * s,
        borderRadius: size * s,
        backgroundColor: "#fff",
        borderWidth: Math.max(2, 4 * s),
        borderColor: colors.controlRing,
      }}
    />
  );
}

function PillToggle({
  s,
  x,
  label,
  on,
  onToggle,
}: {
  s: number;
  x: number;
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  const travel = (PILL.h - PILL.knob - PILL.pad * 2) * s;
  const [pos] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    Animated.spring(pos, { toValue: on ? 1 : 0, useNativeDriver: true, bounciness: 6 }).start();
  }, [on, pos]);

  const name = label.replace("\n", " ");
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel={name}
      accessibilityState={{ checked: on }}
      hitSlop={24 * s}
      style={{
        position: "absolute",
        left: (x - 120) * s,
        top: 692 * s,
        width: 240 * s,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: PILL.w * s,
          height: PILL.h * s,
          borderRadius: PILL.w * s,
          backgroundColor: colors.control,
          padding: PILL.pad * s,
        }}
      >
        <Animated.View
          style={{ transform: [{ translateY: pos.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }) }] }}
        >
          <Knob size={PILL.knob} s={s} />
        </Animated.View>
      </View>
      <Text style={[styles.label, { fontSize: LABEL_FONT * s, lineHeight: 35 * s, marginTop: 22 * s }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function LeveeStops({
  s,
  value,
  onChange,
}: {
  s: number;
  value: Level;
  onChange: (l: Level) => void;
}) {
  const names = ["None", "Medium", "High"];
  return (
    <>
      {LEVEE_Y.map((cy, i) => {
        // Top stop is the strongest levee, bottom is none.
        const level = (2 - i) as Level;
        return (
        <Pressable
          key={i}
          onPress={() => onChange(level)}
          accessibilityRole="radio"
          accessibilityLabel={`Levee ${names[level]}`}
          accessibilityState={{ selected: value === level }}
          hitSlop={8 * s}
          style={{
            position: "absolute",
            left: (LEVEE_X - DOT / 2) * s,
            top: (cy - DOT / 2) * s,
          }}
        >
          {value === level ? (
            <Knob size={DOT} s={s} />
          ) : (
            <View
              style={{
                width: DOT * s,
                height: DOT * s,
                borderRadius: DOT * s,
                backgroundColor: colors.control,
              }}
            />
          )}
        </Pressable>
        );
      })}
      <Text
        style={[
          styles.label,
          {
            position: "absolute",
            left: (LEVEE_X - 120) * s,
            width: 240 * s,
            top: 850 * s,
            fontSize: LABEL_FONT * s,
          },
        ]}
      >
        Levee
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.label,
    fontWeight: "800",
    textAlign: "center",
  },
});
