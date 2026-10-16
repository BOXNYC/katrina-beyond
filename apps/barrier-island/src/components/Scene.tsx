import { Image, StyleSheet, View } from "react-native";
import { effectiveLevels, type Levels } from "../lib/barrierIsland";
import { sceneStrips } from "../lib/sceneStrips";

/** Stage (artboard) size; the controls are laid out in these units too. */
export const STAGE_W = 2000;
export const STAGE_H = 1125;

// The painting is shown zoomed in and pushed up so the land sits low on the
// stage, with room above for the sky and messages.
const ART_ZOOM = 1.167;
const ART_X = -7;
const ART_Y = -163;
const ART_W = 2000;
const ART_H = 1125;

const base = require("../../assets/scene/base.jpg");

type StripKey = keyof typeof sceneStrips;

/** Which "off" strips to lay over the untouched painting for these levels. */
function activeStrips(levels: Levels): StripKey[] {
  const eff = effectiveLevels(levels);
  const out: StripKey[] = [];
  if (levels.barrierIsland < 2) out.push("barrier_off");
  if (eff.marsh < 2) out.push("marsh_off");
  if (levels.ridge < 2) out.push("ridge_off");
  if (levels.levee === 0) out.push("levee_none");
  else if (levels.levee === 1) out.push("levee_medium");
  return out;
}

/**
 * The painted cross-section. With every defense at "High" it is the original
 * artwork; weaker settings swap in pre-made versions of just that feature.
 */
export default function Scene({ levels, s }: { levels: Levels; s: number }) {
  const px = (v: number) => v * ART_ZOOM * s;
  const at = (x: number, y: number) => ({
    left: (ART_X + ART_ZOOM * x) * s,
    top: (ART_Y + ART_ZOOM * y) * s,
  });

  return (
    <View style={styles.clip} pointerEvents="none">
      <Image
        source={base}
        resizeMode="stretch"
        style={[styles.abs, at(0, 0), { width: px(ART_W), height: px(ART_H) }]}
        accessibilityIgnoresInvertColors
      />
      {activeStrips(levels).map((key) => {
        const st = sceneStrips[key];
        return (
          <Image
            key={key}
            source={st.src}
            resizeMode="stretch"
            // A hair of overlap hides rounding seams between strip and painting.
            style={[styles.abs, at(st.x, st.y), { width: px(st.w) + 0.5, height: px(st.h) + 0.5 }]}
            accessibilityIgnoresInvertColors
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  abs: { position: "absolute" },
});
