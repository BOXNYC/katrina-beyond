export type Level = 0 | 1 | 2;
export type ModifierId = "barrierIsland" | "marsh" | "levee" | "seawall";
export type Levels = Record<ModifierId, Level>;
export type OutcomeId = "protected" | "vehicles" | "homes" | "overtopped";

type Modifier = {
  id: ModifierId;
  label: string;
  description: string;
  /** The "hero" gets extra emphasis in the UI. */
  hero?: boolean;
  /** Share of surge height removed at each state (off / medium / high). */
  reduction: readonly [number, number, number];
};

const barrierIsland = {
  /** Where each modifier rests when nobody is using the exhibit. */
  neutralLevel: 0 as Level,
  /** Wake -> reset to the calm loop after this long without a touch. */
  idleTimeoutMs: 45_000,
  /** How long the controller shows "simulating" before the result. */
  simulationMs: 14_000,
  /** Incoming storms; the kiosk rotates through these on each visit. */
  severities: [
    { id: "tropical", label: "Tropical Storm", surgeFt: 6, wind: "40–70 mph winds" },
    { id: "cat2", label: "Category 2 Hurricane", surgeFt: 12, wind: "96–110 mph winds" },
    { id: "cat4", label: "Category 4 Hurricane", surgeFt: 20, wind: "130–156 mph winds" },
  ],

  /**
   * Four controls, each with three states. Natural and built defenses work
   * best together, so no single control can stop the biggest storm alone.
   */
  modifiers: [
    {
      id: "barrierIsland",
      label: "Barrier Island",
      description: "A sandy island that takes the first hit from waves.",
      reduction: [0, 0.15, 0.3],
    },
    {
      id: "marsh",
      label: "Marsh",
      hero: true,
      description: "The hero! Marsh grass soaks up water and slows the surge.",
      reduction: [0, 0.15, 0.3],
    },
    {
      id: "levee",
      label: "Levee",
      description: "A broad hill of earth that holds water back.",
      reduction: [0, 0.2, 0.35],
    },
    {
      id: "seawall",
      label: "Seawall",
      description: "A wall of concrete or rock along the edge of town.",
      reduction: [0, 0.1, 0.2],
    },
  ] as Modifier[],
  levelLabels: ["None", "Medium", "High"],

  /** Shown when the player sets the marsh higher than its island can protect. */
  marshNote:
    "Without a big enough barrier island, waves wash the marsh away.",

  /** Heights (ft) of water at the community. Cars sit lower than elevated homes. */
  vehicleFloodFt: 2,
  homeFloodFt: 8,
  overtopFt: 14,

  outcomes: [
    {
      id: "protected",
      title: "The community is protected",
      text: "Roads stayed open and homes stayed dry. Natural and built defenses worked together.",
    },
    {
      id: "vehicles",
      title: "Homes stayed dry, but cars were trapped",
      text: "Elevated homes stayed above the water. Flooded roads trapped and ruined cars first. Elevated homes are not a reason to stay when officials say to evacuate.",
    },
    {
      id: "homes",
      title: "Water reached the homes",
      text: "The surge rose past the stilts and flooded homes and roads. Try adding more layers of protection.",
    },
    {
      id: "overtopped",
      title: "Water spilled over the levee",
      text: "The surge went over the top and wore away the back side of the levee. One big wall is not enough. Many layers slow the water down.",
    },
  ] satisfies { id: OutcomeId; title: string; text: string }[],

};

export type Severity = (typeof barrierIsland.severities)[number];

export const neutralLevels = (): Levels => ({
  barrierIsland: barrierIsland.neutralLevel,
  marsh: barrierIsland.neutralLevel,
  levee: barrierIsland.neutralLevel,
  seawall: barrierIsland.neutralLevel,
});

/** Marsh needs a barrier island: it can't be healthier than the island shielding it. */
export function effectiveLevels(levels: Levels): Levels {
  return {
    ...levels,
    marsh: Math.min(levels.marsh, levels.barrierIsland) as Level,
  };
}

export const marshCompromised = (levels: Levels) =>
  effectiveLevels(levels).marsh < levels.marsh;

const severityOf = (id: string) =>
  barrierIsland.severities.find((s) => s.id === id) ?? barrierIsland.severities[0];

/** Surge height (ft) that actually reaches the community after defenses. */
export function effectiveSurgeFt(severityId: string, levels: Levels) {
  const eff = effectiveLevels(levels);
  const remaining = barrierIsland.modifiers.reduce(
    (acc, m) => acc * (1 - m.reduction[eff[m.id]]),
    1,
  );
  return severityOf(severityId).surgeFt * remaining;
}

export function outcomeFor(ft: number) {
  const { vehicleFloodFt, homeFloodFt, overtopFt, outcomes } = barrierIsland;
  if (ft < vehicleFloodFt) return outcomes[0];
  if (ft < homeFloodFt) return outcomes[1];
  if (ft < overtopFt) return outcomes[2];
  return outcomes[3];
}

export default barrierIsland;
