/** Control art from ux-v1.psd ("buttons - hi-res"). */
import { ASSET_RESOLUTION } from "./assetResolution";

// Metro needs literal require() paths, so each set is spelled out.
const regular = {
  ovalUp: require("../../assets/ui/regular/oval-up.png"),
  ovalDown: require("../../assets/ui/regular/oval-down.png"),
  leveeHigh: require("../../assets/ui/regular/button-up.png"),
  leveeMedium: require("../../assets/ui/regular/button-mid.png"),
  leveeLow: require("../../assets/ui/regular/button-dn.png"),
};

const twoX = {
  ovalUp: require("../../assets/ui/2x/oval-up.png"),
  ovalDown: require("../../assets/ui/2x/oval-down.png"),
  leveeHigh: require("../../assets/ui/2x/button-up.png"),
  leveeMedium: require("../../assets/ui/2x/button-mid.png"),
  leveeLow: require("../../assets/ui/2x/button-dn.png"),
};

export const uiImages = ASSET_RESOLUTION === "2x" ? twoX : regular;
