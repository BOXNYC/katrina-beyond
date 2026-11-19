import { useEffect, useState } from "react";
import { Animated, Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import type { Level, ModifierId } from "../lib/barrierIsland";
import { uiImages } from "../lib/uiImages";
import { STAGE_W } from "./Scene";

// Layout is taken from ux-v1.psd, whose 2752x2064 canvas matches the scene
// art. Values are canvas pixels; `u` converts them to screen units.
const CANVAS_W = 2752;
const LABEL_FONT = 64;
const LABEL_COLOR = "#48748b";
const FADE_MS = 180;

const PILL = { w: 104, h: 200, y: 1324 };
const TOGGLES: { id: Exclude<ModifierId, "levee">; label: string; x: number; cx: number }[] = [
  { id: "barrierIsland", label: "Barrier\nIsland", x: 599, cx: 654 },
  { id: "marsh", label: "Marsh", x: 1102, cx: 1151 },
  { id: "ridge", label: "Natural\nRidge", x: 1598, cx: 1648 },
];

// The levee art is one column of three stops; the knob sits on the chosen one.
const LEVEE = { x: 2132, y: 1248, w: 105, h: 351, cx: 2184 };
/** Vertical extent of each stop in the column, top (High) to bottom (None). */
const LEVEE_STOPS = [
  { level: 2 as Level, name: "High", y: 1248, h: 108 },
  { level: 1 as Level, name: "Medium", y: 1371, h: 104 },
  { level: 0 as Level, name: "None", y: 1493, h: 105 },
];
const LEVEE_ART = [uiImages.leveeLow, uiImages.leveeMedium, uiImages.leveeHigh];

type Props = {
  s: number;
  levels: Record<ModifierId, Level>;
  disabled?: boolean;
  onChange: (id: ModifierId, level: Level) => void;
};

export default function Controls({ s, levels, disabled, onChange }: Props) {
  const u = (STAGE_W / CANVAS_W) * s;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={disabled ? "none" : "box-none"}>
      {TOGGLES.map((t) => {
        const on = levels[t.id] === 2;
        return (
          <View key={t.id}>
            <Pressable
              onPress={() => onChange(t.id, on ? 0 : 2)}
              accessibilityRole="switch"
              accessibilityLabel={t.label.replace("\n", " ")}
              accessibilityState={{ checked: on }}
              hitSlop={40 * u}
              style={{ position: "absolute", left: t.x * u, top: PILL.y * u, width: PILL.w * u, height: PILL.h * u }}
            >
              <StateImage sources={[uiImages.ovalDown, uiImages.ovalUp]} index={on ? 1 : 0} />
            </Pressable>
            <Label u={u} cx={t.cx} text={t.label} />
          </View>
        );
      })}

      <View style={{ position: "absolute", left: LEVEE.x * u, top: LEVEE.y * u, width: LEVEE.w * u, height: LEVEE.h * u }}>
        <StateImage sources={LEVEE_ART} index={levels.levee} />
      </View>
      {LEVEE_STOPS.map((st) => (
        <Pressable
          key={st.level}
          onPress={() => onChange("levee", st.level)}
          accessibilityRole="radio"
          accessibilityLabel={`Levee ${st.name}`}
          accessibilityState={{ selected: levels.levee === st.level }}
          hitSlop={8 * u}
          style={{ position: "absolute", left: LEVEE.x * u, top: st.y * u, width: LEVEE.w * u, height: st.h * u }}
        />
      ))}
      <Label u={u} cx={LEVEE.cx} text="Levee" />
    </View>
  );
}

/** Stacks same-size images and cross-fades to the one at `index`. */
function StateImage({ sources, index }: { sources: ImageSourcePropType[]; index: number }) {
  const [opacities] = useState(() => sources.map((_, i) => new Animated.Value(i === index ? 1 : 0)));
  useEffect(() => {
    Animated.parallel(
      opacities.map((o, i) =>
        Animated.timing(o, { toValue: i === index ? 1 : 0, duration: FADE_MS, useNativeDriver: true }),
      ),
    ).start();
  }, [index, opacities]);

  return (
    <>
      {sources.map((src, i) => (
        <Animated.View key={i} style={[StyleSheet.absoluteFill, { opacity: opacities[i] }]}>
          <Image source={src} resizeMode="stretch" style={styles.image} accessibilityIgnoresInvertColors />
        </Animated.View>
      ))}
    </>
  );
}

function Label({ u, cx, text }: { u: number; cx: number; text: string }) {
  const lines = text.split("\n").length;
  return (
    <Text
      style={[
        styles.label,
        {
          left: (cx - 150) * u,
          width: 300 * u,
          // Two-line labels start higher so all labels share one centerline.
          top: (lines === 2 ? 1676 : 1704) * u,
          fontSize: LABEL_FONT * u,
          lineHeight: 62 * u,
        },
      ]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  image: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  label: {
    position: "absolute",
    color: LABEL_COLOR,
    fontWeight: "700",
    textAlign: "center",
  },
});
