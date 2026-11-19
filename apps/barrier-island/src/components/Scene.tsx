import { useEffect, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { effectiveLevels, type Levels } from "../lib/barrierIsland";
import { sceneNumber, sceneSource, type SceneNumber } from "../lib/sceneImages";

/** Stage (artboard) size; the controls are laid out in these units too. */
export const STAGE_W = 2000;
export const STAGE_H = 1500;

/** Fade-in length for each new scene image. */
const FADE_MS = 450;

/** The scene image that matches these toggles and levee state. */
function sceneFor(levels: Levels): SceneNumber {
  const eff = effectiveLevels(levels);
  return sceneNumber({
    island: levels.barrierIsland === 2,
    marsh: eff.marsh === 2,
    ridge: levels.ridge === 2,
    levee: levels.levee,
  });
}

type Layer = { id: number; n: SceneNumber };

/**
 * The painted cross-section: a single pre-rendered image for each combination
 * of island, marsh, ridge and levee. The current image is the base; the next
 * one fades in over it and then becomes the base. Only the base and the
 * image fading in are mounted (the full set is too large to keep decoded).
 */
export default function Scene({ levels }: { levels: Levels }) {
  const target = sceneFor(levels);
  const [layers, setLayers] = useState<Layer[]>([{ id: 0, n: target }]);

  // Stack the new image above the current ones; it fades in over them.
  if (layers[layers.length - 1].n !== target) {
    setLayers([...layers, { id: layers[layers.length - 1].id + 1, n: target }]);
  }

  // Once a layer is fully faded in, everything beneath it can go.
  const settled = (id: number) => setLayers((ls) => ls.filter((l) => l.id >= id));

  return (
    <View style={styles.clip} pointerEvents="none">
      {layers.map((l) => (
        <FadeInLayer key={l.id} n={l.n} first={l.id === 0} onDone={() => settled(l.id)} />
      ))}
    </View>
  );
}

/** Fades in once its image has loaded (the first layer just shows). */
function FadeInLayer({ n, first, onDone }: { n: SceneNumber; first: boolean; onDone: () => void }) {
  const [opacity] = useState(() => new Animated.Value(first ? 1 : 0));
  const [loaded, setLoaded] = useState(first);

  useEffect(() => {
    if (!loaded) return; // wait for the image so the fade is visible
    const anim = Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true });
    anim.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, opacity]);

  return (
    <Animated.View style={[styles.fill, { opacity }]}>
      <Image
        source={sceneSource(n)}
        resizeMode="stretch"
        style={styles.fill}
        onLoad={() => setLoaded(true)}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  fill: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
});
