import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import helpAgent from "../lib/helpAgent";
import { colors } from "../theme";

/**
 * Optional helper in the corner of the experience. Players can ask for a hint
 * any time. Remount it with a new `key` when the situation changes so the tip
 * list starts over.
 */
export default function HelpAgent({ tips }: { tips: string[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const tip = tips[index];

  return (
    <View style={styles.root} accessibilityLiveRegion="polite" pointerEvents="box-none">
      {open && (
        <View style={styles.bubble}>
          <Text style={styles.name}>{helpAgent.name}</Text>
          <Text style={styles.tip}>{tip ?? helpAgent.outOfTips}</Text>
          <View style={styles.actions}>
            {index < tips.length - 1 && (
              <BubbleButton onPress={() => setIndex(index + 1)}>
                {helpAgent.nextTipLabel}
              </BubbleButton>
            )}
            <BubbleButton
              secondary
              onPress={() => {
                setOpen(false);
                setIndex(0);
              }}
            >
              {helpAgent.closeLabel}
            </BubbleButton>
          </View>
        </View>
      )}
      {open ? (
        <Avatar />
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          style={styles.opener}
        >
          <Avatar />
          <Text style={styles.openerText}>{helpAgent.openLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Avatar() {
  // Placeholder badge: friendly weather-reporter silhouette.
  return (
    <Svg viewBox="0 0 64 64" width={64} height={64}>
      <Circle cx={32} cy={32} r={31} fill={colors.accent} stroke="#fff" strokeWidth={3} />
      <Circle cx={32} cy={26} r={10} fill="#fde68a" />
      <Path d="M12 56c2-14 12-18 20-18s18 4 20 18z" fill={colors.track} />
      <Path d="M26 40l6 8 6-8z" fill="#fff" />
    </Svg>
  );
}

function BubbleButton({
  children,
  onPress,
  secondary,
}: {
  children: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.bubbleButton, secondary && styles.bubbleButtonSecondary]}
    >
      <Text style={[styles.bubbleButtonText, secondary && { color: "#0f172a" }]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: 16,
    bottom: 16,
    maxWidth: 448,
    alignItems: "flex-end",
    gap: 12,
  },
  bubble: {
    backgroundColor: "#fff",
    borderColor: colors.amber,
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  name: {
    marginBottom: 4,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.amberDark,
  },
  tip: { fontSize: 20, lineHeight: 26, color: "#0f172a" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  opener: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 999,
    backgroundColor: colors.amber,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 24,
  },
  openerText: { fontSize: 20, fontWeight: "600", color: "#0f172a" },
  bubbleButton: {
    minHeight: 56,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#0284c7",
    paddingHorizontal: 24,
  },
  bubbleButtonSecondary: { backgroundColor: "#e2e8f0" },
  bubbleButtonText: { fontSize: 18, fontWeight: "600", color: "#fff" },
});
