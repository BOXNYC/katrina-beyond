import evacuation from "./evacuation";
// import barrierIsland from "./barrierIsland";
import electricGrid from "./electricGrid";

export type InteractiveKey = keyof typeof interactives;
export const interactives = {
  evacuation: {
    info: {
      slug: "evacuation",
      title: "Evacuation",
      description: "Check the facts, make a plan and pack your duffel.",
    },
    data: evacuation,
  },
  /* barrierIsland: {
    info: {
      slug: "barrier-island",
      title: "Barrier Island",
      description: "See how marsh, islands and levees work together to slow storm surge.",
    },
    data: barrierIsland,
  }, */
  electricGrid: {
    info: {
      slug: "electric-grid",
      title: "Electric Grid",
      description: "Bring the lights back to the city, one area at a time.",
    },
    data: electricGrid,
  },
 } as const;
