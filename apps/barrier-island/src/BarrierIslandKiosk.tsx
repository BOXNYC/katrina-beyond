import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import barrierIsland, {
  effectiveSurgeFt,
  neutralLevels,
  outcomeFor,
  type Level,
  type Levels,
  type ModifierId,
} from "./lib/barrierIsland";
import Controls from "./components/Controls";
import HelpAgent from "./components/HelpAgent";
import Scene, { STAGE_H, STAGE_W } from "./components/Scene";
import { colors } from "./theme";

const { severities } = barrierIsland;

/** The painting as drawn: every defense in place. Shown before play begins. */
/** Stage units of empty sand at the bottom that can be cropped off. */
const SAND_CROP = 200;
/** Stage units of height the tallest message (the result screen) needs. */
const SKY_NEEDS = 440;

const FULL_DEFENSES: Levels = { barrierIsland: 2, marsh: 2, ridge: 2, levee: 2 };

type Phase = "idle" | "storm" | "configure" | "simulating" | "result";
type State = { phase: Phase; severityId: string; levels: Levels };

const tips = {
  idle: [],
  storm: [
    "Storm surge is water pushed onto land by a storm. It is the most dangerous part of a hurricane.",
    "A bigger storm pushes more water. Next you will choose the defenses that slow it down.",
  ],
  configure: [
    "Try one control at a time and watch the picture change.",
    "Marsh is the hero. Its grass soaks up water and slows the surge.",
    "Marsh needs a barrier island. Without the island, waves wash the marsh away.",
    "No single wall can stop a big storm. Natural and built defenses work best together.",
    "Press Simulate when you are ready to see what the surge does.",
  ],
  simulating: [
    "Watch the water on the model. See how fast it rises, and where it slows down.",
    "More layers of protection slow the water, which gives people more time.",
  ],
  result: [
    "Look at the cars on the road. Roads flood before elevated homes do.",
    "Elevated homes are not a reason to stay. When officials say evacuate, go.",
    "Try again with different defenses and compare.",
  ],
} as const;

export default function BarrierIslandKiosk() {
  const { width, height } = useWindowDimensions();
  // The artboard fills the width and sits near the bottom edge. The empty sand
  // under the controls is cropped so short (landscape phone) screens get more
  // sky; any extra height on tall screens is plain sky.
  const s = width / STAGE_W;
  const stageH = STAGE_H * s;
  const crop = SAND_CROP * s;
  const horizonY = height + crop - stageH + 560 * s;
  const skyH = Math.max(horizonY - 24 * s, 0);
  // Type scale: readable on small screens, but never taller than the sky.
  const u = Math.min(Math.max(s, 0.5), skyH / SKY_NEEDS);

  const [state, setState] = useState<State>(() => ({
    phase: "idle",
    severityId: severities[0].id,
    levels: neutralLevels(),
  }));
  const visit = useRef(0);

  const { phase, severityId, levels } = state;
  const severity = severities.find((x) => x.id === severityId) ?? severities[0];

  const reset = useCallback(
    () =>
      setState((st) => ({
        phase: "idle",
        severityId: st.severityId,
        levels: neutralLevels(),
      })),
    [],
  );

  // Return to the calm loop after inactivity (not mid-simulation).
  const [touches, setTouches] = useState(0);
  useEffect(() => {
    if (phase === "idle" || phase === "simulating") return;
    const t = setTimeout(reset, barrierIsland.idleTimeoutMs);
    return () => clearTimeout(t);
  }, [phase, touches, reset]);

  // Move on to the result once the water simulation has run.
  useEffect(() => {
    if (phase !== "simulating") return;
    const t = setTimeout(
      () => setState((st) => ({ ...st, phase: "result" })),
      barrierIsland.simulationMs,
    );
    return () => clearTimeout(t);
  }, [phase]);

  const wake = () => {
    const next = severities[visit.current++ % severities.length];
    setState({ phase: "storm", severityId: next.id, levels: neutralLevels() });
  };

  // Marsh needs a barrier island: turning the island off turns the marsh off,
  // and the marsh can't be turned on until the island is.
  const [marshBlocked, setMarshBlocked] = useState(false);
  const setLevel = (id: ModifierId, level: Level) => {
    if (id === "marsh" && level > 0 && levels.barrierIsland === 0) {
      setMarshBlocked(true);
      return;
    }
    if (id === "barrierIsland") setMarshBlocked(false);
    setState((st) => ({
      ...st,
      levels: {
        ...st.levels,
        [id]: level,
        ...(id === "barrierIsland" && level === 0 ? { marsh: 0 as Level } : {}),
      },
    }));
  };

  const goto = (next: Phase) => {
    setMarshBlocked(false);
    setState((st) => ({ ...st, phase: next }));
  };

  const ft = effectiveSurgeFt(severityId, levels);
  const outcome = outcomeFor(ft);
  const controlsShown = phase === "configure" || phase === "simulating";

  return (
    <View
      style={styles.root}
      // Observe touches for the inactivity timer without claiming them.
      onStartShouldSetResponderCapture={() => {
        setTouches((n) => n + 1);
        return false;
      }}
    >
      <View style={{ position: "absolute", left: 0, bottom: -crop, width, height: stageH }}>
        <Scene levels={controlsShown || phase === "result" ? levels : FULL_DEFENSES} s={s} />
        {controlsShown && (
          <Controls s={s} levels={levels} disabled={phase === "simulating"} onChange={setLevel} />
        )}
      </View>

      {/* Messages live in the sky, above the horizon. */}
      <View style={[styles.sky, { height: skyH, paddingHorizontal: Math.min(width * 0.2, 200) }]} pointerEvents="box-none">
        {phase === "idle" && (
          <Pressable onPress={wake} style={styles.fill} accessibilityRole="button">
            <Text style={[styles.title, { fontSize: 88 * u }]}>Barrier Island</Text>
            <Pulse>
              <Text style={[styles.prompt, { fontSize: 34 * u }]}>Touch to begin</Text>
            </Pulse>
          </Pressable>
        )}

        {phase === "storm" && (
          <View style={styles.fill}>
            <Text style={[styles.eyebrow, { fontSize: 24 * u }]}>Storm warning</Text>
            <Text style={[styles.title, { fontSize: 64 * u }]}>
              A {severity.label} is approaching.
            </Text>
            <Text style={[styles.lead, { fontSize: 32 * u }]}>
              Expected storm surge: {severity.surgeFt} ft · {severity.wind}
            </Text>
            <PrimaryButton u={u} onPress={() => goto("configure")}>
              Prepare the island
            </PrimaryButton>
          </View>
        )}

        {phase === "configure" && (
          <View style={styles.fill}>
            <Text style={[styles.lead, { fontSize: 32 * u }]}>
              {severity.label} · {severity.surgeFt} ft surge
            </Text>
            {marshBlocked && levels.barrierIsland === 0 && (
              <Text style={[styles.note, { fontSize: 24 * u }]}>{barrierIsland.marshNote}</Text>
            )}
            <PrimaryButton u={u} onPress={() => goto("simulating")}>
              Simulate
            </PrimaryButton>
          </View>
        )}

        {phase === "simulating" && (
          <View style={styles.fill}>
            <Pulse>
              <Text style={[styles.prompt, { fontSize: 34 * u }]}>
                Storm surge arriving — watch the model…
              </Text>
            </Pulse>
          </View>
        )}

        {phase === "result" && (
          <View style={styles.fill}>
            <Text style={[styles.title, { fontSize: 56 * u }]}>{outcome.title}</Text>
            <Text style={[styles.lead, { fontSize: 28 * u }]}>{outcome.text}</Text>
            <Text style={[styles.prompt, { fontSize: 26 * u }]}>
              {severity.surgeFt} ft of surge → {ft.toFixed(1)} ft reached the community
            </Text>
            <View style={styles.row}>
              <PrimaryButton u={u} onPress={() => goto("configure")}>
                Try different defenses
              </PrimaryButton>
              <PrimaryButton u={u} secondary onPress={reset}>
                Done
              </PrimaryButton>
            </View>
          </View>
        )}
      </View>

      {phase !== "idle" && <HelpAgent key={phase} tips={[...tips[phase]]} />}
    </View>
  );
}

function PrimaryButton({
  children,
  onPress,
  u,
  secondary,
}: {
  children: string;
  onPress: () => void;
  u: number;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          height: 72 * u,
          paddingHorizontal: 52 * u,
          backgroundColor: secondary ? "#fff" : colors.control,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: 28 * u, fontWeight: "700", color: secondary ? colors.control : "#fff" }}>
        {children}
      </Text>
    </Pressable>
  );
}

/** Gentle opacity pulse. */
function Pulse({ children }: { children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky, overflow: "hidden" },
  sky: { position: "absolute", top: 0, left: 0, right: 0 },
  fill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 },
  title: { color: colors.ink, fontWeight: "700", textAlign: "center" },
  eyebrow: { color: colors.control, letterSpacing: 3, textTransform: "uppercase", fontWeight: "700" },
  lead: { color: colors.ink, textAlign: "center", maxWidth: 900 },
  prompt: { color: colors.control, fontWeight: "600", textAlign: "center" },
  note: { color: colors.amberDark, textAlign: "center" },
  button: { justifyContent: "center", borderRadius: 999 },
});
