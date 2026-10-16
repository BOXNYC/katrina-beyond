/**
 * Area-based grid restoration as a memory game. A pattern lights up across the
 * map (hospitals and municipalities first, then neighborhoods) and players tap
 * the same areas in the same order. Power spreads through neighbors, so the
 * pattern never lights an area before something next to it is back.
 *
 * Placeholders: customer counts, restoration hours, area layout and tie lines
 * need real data from the utility (Entergy) once the team has it, including
 * east–west feeds and alternate supply routes.
 */
export type Kind = "hospital" | "municipality" | "neighborhood";

export type Area = {
  label: string;
  kind: Kind;
  x: number;
  y: number;
  customers: number;
};

export type Tie = { label: string; a: string; b: string };

export type Round = {
  title: string;
  storm: string;
  /** Areas that lose power. */
  outage: string[];
  /** Tie lines that are cut and must be reconnected during the round. */
  ties?: string[];
  /** How long each cue stays lit while the pattern plays. */
  showMs: number;
  /**
   * "random" (default): a random order each play, always an area power can reach.
   * "priority": hospitals, then municipalities, then neighborhoods.
   * "snake": a sweep (left to right, right to left, repeat, or by
   * column) that's easy to remember when there are many steps. The direction is
   * random each play (see Variant). Cut tie lines come last.
   */
  pattern?: "random" | "priority" | "snake";
};

export type Step = { target: string; isTie: boolean };

/**
 * Which way a zig-zag sweep runs. It's picked at random for each play so it
 * isn't the same every time: by rows or by columns, starting on either side,
 * and starting from either end of the map.
 */
export type Variant = { axis: "rows" | "cols"; flip: boolean; reverse: boolean; seed: number };

export const DEFAULT_VARIANT: Variant = { axis: "rows", flip: false, reverse: false, seed: 1 };

export const randomVariant = (): Variant => ({
  axis: Math.random() < 0.5 ? "rows" : "cols",
  flip: Math.random() < 0.5,
  reverse: Math.random() < 0.5,
  seed: Math.floor(Math.random() * 2 ** 31),
});

/** Small seeded random generator so a play's pattern stays the same on replay. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hospitals come first, then municipalities, then neighborhoods. */
const kinds: Record<Kind, { label: string; icon: string; priority: number; hours: number }> = {
  hospital: { label: "Hospital", icon: "🏥", priority: 1, hours: 6 },
  municipality: { label: "City or parish services", icon: "🏛️", priority: 2, hours: 12 },
  neighborhood: { label: "Neighborhood", icon: "🏘️", priority: 3, hours: 24 },
};

const areas: Record<string, Area> = {
  a1: { label: "Lakeview", kind: "neighborhood", x: 170, y: 110, customers: 14500 },
  a2: { label: "Metairie", kind: "municipality", x: 390, y: 110, customers: 20000 },
  a3: { label: "Lakeshore Hospital", kind: "hospital", x: 610, y: 110, customers: 4200 },
  a4: { label: "Gentilly", kind: "neighborhood", x: 830, y: 110, customers: 12000 },
  b1: { label: "Uptown", kind: "neighborhood", x: 170, y: 270, customers: 17000 },
  b2: { label: "Central Hospital", kind: "hospital", x: 390, y: 270, customers: 5100 },
  b3: { label: "Orleans Parish", kind: "municipality", x: 610, y: 270, customers: 18000 },
  b4: { label: "Chalmette", kind: "municipality", x: 830, y: 270, customers: 9000 },
  c1: { label: "Algiers", kind: "neighborhood", x: 170, y: 430, customers: 11000 },
  c2: { label: "Garden District", kind: "neighborhood", x: 390, y: 430, customers: 8000 },
  c3: { label: "Tremé", kind: "neighborhood", x: 610, y: 430, customers: 7500 },
  c4: { label: "Lower Ninth Ward", kind: "neighborhood", x: 830, y: 430, customers: 6500 },
};

const electricGrid = {
  kinds,
  areas,

  /** Neighboring areas: power travels along these. */
  edges: [
    ["a1", "a2"], ["a2", "a3"], ["a3", "a4"],
    ["b1", "b2"], ["b2", "b3"], ["b3", "b4"],
    ["c1", "c2"], ["c2", "c3"], ["c3", "c4"],
    ["a1", "b1"], ["a2", "b2"], ["a3", "b3"], ["a4", "b4"],
    ["b1", "c1"], ["b2", "c2"], ["b3", "c3"], ["b4", "c4"],
  ] as [string, string][],

  /** Where power enters the area map. */
  feeds: {
    west: { label: "West feed", x: 50, y: 270, to: ["a1", "b1", "c1"] },
    east: { label: "East feed", x: 950, y: 270, to: ["a4", "b4", "c4"] },
  } as Record<string, { label: string; x: number; y: number; to: string[] }>,

  /** Longer lines between distant areas: alternate supply routes. */
  ties: {
    ew: { label: "East–west feed", a: "b1", b: "b4" },
    alt: { label: "Alternate supply route", a: "a3", b: "c3" },
  } as Record<string, Tie>,
  /** Control points for drawing each tie as a curve. */
  tieCurve: {
    ew: { cx: 500, cy: 360 },
    alt: { cx: 740, cy: 270 },
  } as Record<string, { cx: number; cy: number }>,

  /** Hours to reconnect a tie line (placeholder). */
  tieHours: 4,

  rounds: [
    {
      title: "Round 1: Shoreline Storm",
      storm: "A small storm hits the lakefront. A few coastal areas lose power.",
      outage: ["a1", "a2", "a3"],
      showMs: 1000,
    },
    {
      title: "Round 2: Tropical Storm",
      storm: "A bigger storm. More of the coast goes dark, and one hospital inland too.",
      outage: ["a1", "a2", "a3", "a4", "b2"],
      showMs: 800,
    },
    {
      title: "Round 3: Hurricane",
      storm: "A hurricane. Two full rows of the city lose power, and a supply route is cut.",
      outage: ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"],
      ties: ["alt"],
      showMs: 650,
      pattern: "snake",
    },
    {
      title: "Round 4: Catastrophic Storm",
      storm: "The whole area is dark and two supply lines are cut. Power has to move in step by step. Work as a team!",
      outage: ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4", "c1", "c2", "c3", "c4"],
      ties: ["ew", "alt"],
      showMs: 520,
      pattern: "snake",
    },
  ] satisfies Round[] as Round[],

  /** Attract-mode "light show": the whole grid restores itself at a steady pace. */
  demo: { stepMs: 700, pauseMs: 3500 },

  idleTimeoutMs: 45_000,

  takeaways: [
    "Power comes back area by area, not all at once.",
    "Hospitals and city services come first.",
    "An area can't be restored until power reaches its neighbors.",
    "Restoring a whole city takes days.",
  ],
};

/** Areas that touch a power feed. */
const feedAdjacent = new Set(Object.values(electricGrid.feeds).flatMap((f) => f.to));

export const neighborsOf = (id: string) =>
  electricGrid.edges.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));

/** Can this area get power right now, given which areas already have it? */
export function isConnected(id: string, powered: Set<string>) {
  return feedAdjacent.has(id) || neighborsOf(id).some((n) => powered.has(n));
}

/**
 * Correct restoration order for a round: always the highest-priority area that
 * power can reach (hospitals, then municipalities, then neighborhoods). Cut tie
 * lines are reconnected right after both of their ends are back.
 */
export function stepsFor(round: Round, variant: Variant = DEFAULT_VARIANT): Step[] {
  const { areas, kinds, ties } = electricGrid;
  const order = Object.keys(areas);
  const powered = new Set(order.filter((id) => !round.outage.includes(id)));
  const remaining = order.filter((id) => round.outage.includes(id));
  const steps: Step[] = [];
  const rand = seeded(variant.seed);

  if (round.pattern === "snake") {
    // Lines run across the map (rows or columns); each line runs the opposite
    // way from the one before it.
    const along = (id: string) => (variant.axis === "rows" ? areas[id].x : areas[id].y);
    const across = (id: string) => (variant.axis === "rows" ? areas[id].y : areas[id].x);
    let lines = [...new Set(order.map(across))].sort((a, b) => a - b);
    if (variant.reverse) lines = lines.reverse();
    lines.forEach((line, i) => {
      const forward = i % 2 === 0 ? !variant.flip : variant.flip;
      const inLine = remaining
        .filter((id) => across(id) === line)
        .sort((a, b) => (along(a) - along(b)) * (forward ? 1 : -1));
      for (const id of inLine) steps.push({ target: id, isTie: false });
    });
    for (const tieId of round.ties ?? []) steps.push({ target: tieId, isTie: true });
    return steps;
  }

  while (remaining.length) {
    const reachable = remaining.filter((id) => isConnected(id, powered));
    const pool = reachable.length ? reachable : remaining; // never get stuck
    let next: string;
    if (round.pattern === "priority") {
      pool.sort((a, b) => kinds[areas[a].kind].priority - kinds[areas[b].kind].priority);
      next = pool[0];
    } else {
      next = pool[Math.floor(rand() * pool.length)];
    }
    steps.push({ target: next, isTie: false });
    powered.add(next);
    remaining.splice(remaining.indexOf(next), 1);
  }

  for (const tieId of round.ties ?? []) {
    const { a, b } = ties[tieId];
    const idx = Math.max(
      steps.findIndex((s) => s.target === a),
      steps.findIndex((s) => s.target === b),
    );
    steps.splice(idx + 1, 0, { target: tieId, isTie: true });
  }
  return steps;
}

export const stepLabel = (s: Step) =>
  s.isTie ? electricGrid.ties[s.target].label : electricGrid.areas[s.target].label;

export const stepHours = (s: Step) =>
  s.isTie ? electricGrid.tieHours : electricGrid.kinds[electricGrid.areas[s.target].kind].hours;

/** Friendly explanation after a wrong tap; always ends with the right next move. */
export function explainMistake(
  expected: Step,
  tapped: { target: string; isTie: boolean },
  powered: Set<string>,
  pattern: Round["pattern"] = "random",
) {
  const { areas, kinds } = electricGrid;
  const next = `The next one is ${stepLabel(expected)}.`;
  if (!tapped.isTie && !isConnected(tapped.target, powered)) {
    return `${areas[tapped.target].label} isn't connected yet. Power has to reach its neighbors first. ${next}`;
  }
  if (pattern === "snake") return `Not quite, but that's okay. ${next}`;
  if (!tapped.isTie && !expected.isTie) {
    const tp = kinds[areas[tapped.target].kind].priority;
    const ep = kinds[areas[expected.target].kind].priority;
    if (tp > ep) return `Hospitals and city services come before neighborhoods. ${next}`;
  }
  return `Not quite, but that's okay. ${next}`;
}

/** Each place has its own note, like the buttons in a classic memory game. */
const SCALE = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 988, 1047];
export function toneFor(target: string) {
  const i = Object.keys(electricGrid.areas).indexOf(target);
  return i < 0 ? 220 : SCALE[i % SCALE.length];
}

export function hoursLabel(hours: number) {
  if (hours < 24) return `${hours} hours`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export default electricGrid;
