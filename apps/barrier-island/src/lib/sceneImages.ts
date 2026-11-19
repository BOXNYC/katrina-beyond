/**
 * Full-scene images: one per combination of the three land toggles and the
 * levee (rows 1-18 of layers-v1.xlsx). Exported from layers-v1.psd.
 */

import { ASSET_RESOLUTION } from "./assetResolution";

/** The scene is 2752x2064 at "regular" and 5504x4128 at "2x". */

// Metro needs literal require() paths, so each set is spelled out.
const regularScenes = {
  1: require("../../assets/scene/regular/01_island-on_marsh-on_ridge-off_levee-low.png"),
  2: require("../../assets/scene/regular/02_island-on_marsh-on_ridge-off_levee-medium.png"),
  3: require("../../assets/scene/regular/03_island-on_marsh-on_ridge-off_levee-high.png"),
  4: require("../../assets/scene/regular/04_island-on_marsh-on_ridge-on_levee-low.png"),
  5: require("../../assets/scene/regular/05_island-on_marsh-on_ridge-on_levee-medium.png"),
  6: require("../../assets/scene/regular/06_island-on_marsh-on_ridge-on_levee-high.png"),
  7: require("../../assets/scene/regular/07_island-on_marsh-off_ridge-off_levee-low.png"),
  8: require("../../assets/scene/regular/08_island-on_marsh-off_ridge-off_levee-medium.png"),
  9: require("../../assets/scene/regular/09_island-on_marsh-off_ridge-off_levee-high.png"),
  10: require("../../assets/scene/regular/10_island-on_marsh-off_ridge-on_levee-low.png"),
  11: require("../../assets/scene/regular/11_island-on_marsh-off_ridge-on_levee-medium.png"),
  12: require("../../assets/scene/regular/12_island-on_marsh-off_ridge-on_levee-high.png"),
  13: require("../../assets/scene/regular/13_island-off_marsh-off_ridge-off_levee-low.png"),
  14: require("../../assets/scene/regular/14_island-off_marsh-off_ridge-off_levee-medium.png"),
  15: require("../../assets/scene/regular/15_island-off_marsh-off_ridge-off_levee-high.png"),
  16: require("../../assets/scene/regular/16_island-off_marsh-off_ridge-on_levee-low.png"),
  17: require("../../assets/scene/regular/17_island-off_marsh-off_ridge-on_levee-medium.png"),
  18: require("../../assets/scene/regular/18_island-off_marsh-off_ridge-on_levee-high.png"),
} as const;

const twoXScenes = {
  1: require("../../assets/scene/2x/01_island-on_marsh-on_ridge-off_levee-low.png"),
  2: require("../../assets/scene/2x/02_island-on_marsh-on_ridge-off_levee-medium.png"),
  3: require("../../assets/scene/2x/03_island-on_marsh-on_ridge-off_levee-high.png"),
  4: require("../../assets/scene/2x/04_island-on_marsh-on_ridge-on_levee-low.png"),
  5: require("../../assets/scene/2x/05_island-on_marsh-on_ridge-on_levee-medium.png"),
  6: require("../../assets/scene/2x/06_island-on_marsh-on_ridge-on_levee-high.png"),
  7: require("../../assets/scene/2x/07_island-on_marsh-off_ridge-off_levee-low.png"),
  8: require("../../assets/scene/2x/08_island-on_marsh-off_ridge-off_levee-medium.png"),
  9: require("../../assets/scene/2x/09_island-on_marsh-off_ridge-off_levee-high.png"),
  10: require("../../assets/scene/2x/10_island-on_marsh-off_ridge-on_levee-low.png"),
  11: require("../../assets/scene/2x/11_island-on_marsh-off_ridge-on_levee-medium.png"),
  12: require("../../assets/scene/2x/12_island-on_marsh-off_ridge-on_levee-high.png"),
  13: require("../../assets/scene/2x/13_island-off_marsh-off_ridge-off_levee-low.png"),
  14: require("../../assets/scene/2x/14_island-off_marsh-off_ridge-off_levee-medium.png"),
  15: require("../../assets/scene/2x/15_island-off_marsh-off_ridge-off_levee-high.png"),
  16: require("../../assets/scene/2x/16_island-off_marsh-off_ridge-on_levee-low.png"),
  17: require("../../assets/scene/2x/17_island-off_marsh-off_ridge-on_levee-medium.png"),
  18: require("../../assets/scene/2x/18_island-off_marsh-off_ridge-on_levee-high.png"),
} as const;

const sets = { regular: regularScenes, "2x": twoXScenes } as const;

export type SceneNumber = keyof typeof regularScenes;

/**
 * Row of the combination matrix: island+marsh on (1-6), island only (7-12),
 * neither (13-18); within each, ridge off then on; within each, low/medium/high.
 */
export function sceneNumber(o: {
  island: boolean;
  marsh: boolean;
  ridge: boolean;
  levee: 0 | 1 | 2;
}): SceneNumber {
  const land = o.island ? (o.marsh ? 0 : 1) : 2;
  return (land * 6 + (o.ridge ? 3 : 0) + o.levee + 1) as SceneNumber;
}

export const sceneSource = (n: SceneNumber) => sets[ASSET_RESOLUTION][n];
