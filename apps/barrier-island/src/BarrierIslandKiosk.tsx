import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import barrierIsland, {
  effectiveSurgeFt,
  marshCompromised,
  neutralLevels,
  outcomeFor,
  type Level,
  type Levels,
  type ModifierId,
} from "./lib/barrierIsland";
import CrossSection from "./components/CrossSection";
import HelpAgent from "./components/HelpAgent";
import LevelSlider from "./components/LevelSlider";
import { colors } from "./theme";

const { severities, modifiers, levelLabels } = barrierIsland;

type Phase = "idle" | "storm" | "configure" | "simulating" | "result";
type State = { phase: Phase; severityId: string; levels: Levels };

const tips = {
  idle: [],
  storm: [
    "Storm surge is water pushed onto land by a storm. It is the most dangerous part of a hurricane.",
    "A bigger storm pushes more water. Next you will choose the defenses that slow it down.",
  ],
  configure: [
    "Try one slider at a time and watch the picture change.",
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
  const [state, setState] = useState<State>(() => ({
    phase: "idle",
    severityId: severities[0].id,
    levels: neutralLevels(),
  }));
  const visit = useRef(0);

  const { phase, severityId, levels } = state;
  const severity = severities.find((s) => s.id === severityId) ?? severities[0];

  const reset = useCallback(
    () =>
      setState((s) => ({
        phase: "idle",
        severityId: s.severityId,
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
      () => setState((s) => ({ ...s, phase: "result" })),
      barrierIsland.simulationMs,
    );
    return () => clearTimeout(t);
  }, [phase]);

  const wake = () => {
    const next = severities[visit.current++ % severities.length];
    setState({ phase: "storm", severityId: next.id, levels: neutralLevels() });
  };

  const setLevel = (id: ModifierId, level: Level) =>
    setState((s) => ({ ...s, levels: { ...s.levels, [id]: level } }));

  const goto = (next: Phase) => setState((s) => ({ ...s, phase: next }));

  const ft = effectiveSurgeFt(severityId, levels);
  const outcome = outcomeFor(ft);

  return (
    <SafeAreaView
      style={styles.root}
      // Observe touches for the inactivity timer without claiming them.
      onStartShouldSetResponderCapture={() => {
        setTouches((n) => n + 1);
        return false;
      }}
    >
      {phase === "idle" && (
        <Pressable onPress={wake} style={styles.center} accessibilityRole="button">
          <Text style={[styles.title, { fontSize: 56 }]}>Barrier Island</Text>
          <Pulse>
            <Text style={styles.prompt}>Touch to begin</Text>
          </Pulse>
        </Pressable>
      )}

      {phase === "storm" && (
        <View style={styles.center}>
          <Text style={styles.eyebrow}>Storm warning</Text>
          <Text style={[styles.title, { fontSize: 40, maxWidth: 700 }]}>
            A {severity.label} is approaching.
          </Text>
          <Text style={styles.lead}>
            Expected storm surge: {severity.surgeFt} ft · {severity.wind}
          </Text>
          <Text style={[styles.body, { maxWidth: 600 }]}>
            Choose how to protect the island, then simulate the storm.
          </Text>
          <PrimaryButton onPress={() => goto("configure")}>Prepare the island</PrimaryButton>
        </View>
      )}

      {(phase === "configure" || phase === "simulating") && (
        <ScrollView contentContainerStyle={styles.configure}>
          <Text style={[styles.title, { fontSize: 28, textAlign: "left" }]}>
            {severity.label} · {severity.surgeFt} ft surge
          </Text>
          <CrossSection levels={levels} />
          {modifiers.map((m) => (
            <View key={m.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {m.hero ? "⭐ " : ""}
                {m.label}
              </Text>
              <Text style={styles.cardText}>{m.description}</Text>
              {m.id === "marsh" && marshCompromised(levels) && (
                <Text style={styles.note}>{barrierIsland.marshNote}</Text>
              )}
              <View style={{ marginTop: 12 }}>
                <LevelSlider
                  label={m.label}
                  value={levels[m.id]}
                  labels={levelLabels}
                  disabled={phase === "simulating"}
                  onChange={(l) => setLevel(m.id, l)}
                />
              </View>
            </View>
          ))}
          <View style={{ alignItems: "center", marginTop: 8 }}>
            {phase === "configure" ? (
              <PrimaryButton onPress={() => goto("simulating")}>Simulate</PrimaryButton>
            ) : (
              <Pulse>
                <Text style={styles.prompt}>Storm surge arriving — watch the model…</Text>
              </Pulse>
            )}
          </View>
          {/* Room so the help agent never covers the last control. */}
          <View style={{ height: 96 }} />
        </ScrollView>
      )}

      {phase === "result" && (
        <View style={styles.center}>
          <Text style={[styles.title, { fontSize: 40 }]}>{outcome.title}</Text>
          <Text style={[styles.lead, { maxWidth: 600 }]}>{outcome.text}</Text>
          <Text style={styles.prompt}>
            {severity.surgeFt} ft of surge → {ft.toFixed(1)} ft reached the community
          </Text>
          <View style={styles.row}>
            <PrimaryButton onPress={() => goto("configure")}>Try different defenses</PrimaryButton>
            <Pressable onPress={reset} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}

      {phase !== "idle" && <HelpAgent key={phase} tips={[...tips[phase]]} />}
    </SafeAreaView>
  );
}

function PrimaryButton({ children, onPress }: { children: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, pressed && { backgroundColor: "#38bdf8" }]}
    >
      <Text style={styles.primaryText}>{children}</Text>
    </Pressable>
  );
}

/** Gentle opacity pulse, like Tailwind's animate-pulse. */
function Pulse({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
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
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24, padding: 32 },
  configure: { padding: 24, gap: 16 },
  title: { color: colors.text, fontWeight: "600", textAlign: "center" },
  eyebrow: {
    color: colors.sky,
    fontSize: 18,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  lead: { color: colors.soft, fontSize: 22, textAlign: "center" },
  body: { color: colors.soft, fontSize: 20, textAlign: "center" },
  prompt: { color: colors.sky, fontSize: 22, textAlign: "center" },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16 },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: "500" },
  cardText: { color: colors.muted, fontSize: 16, marginTop: 2 },
  note: { color: "#fcd34d", fontSize: 16, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 },
  primary: {
    height: 64,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.accent,
    paddingHorizontal: 48,
  },
  primaryText: { color: colors.bg, fontSize: 20, fontWeight: "600" },
  secondary: {
    height: 64,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.track,
    paddingHorizontal: 40,
  },
  secondaryText: { color: colors.text, fontSize: 20 },
});
