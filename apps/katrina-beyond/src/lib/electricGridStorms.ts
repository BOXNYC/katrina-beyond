import { FACILITY_BY_ID, FACILITIES, type FacilityType } from "./electricGridFacilities";

/** One outage step: a single facility (tap / connect) or a group of 2-4 (circle). */
export type OutageStep = { facilityIds: string[] };
export type LevelNumber = 1 | 2 | 3 | 4 | 5;
export type Interaction = "tap" | "connect" | "circle";

export type Storm = {
  name: string;
  severity: string;
  blurb: string;
  levels: Record<LevelNumber, OutageStep[]>;
};

export type LevelInfo = {
  interaction: Interaction;
  types: FacilityType[];
  instruction: "level-1" | "level-2" | "level-3" | "level-4" | "level-5";
  /** Text shown under the level box. PLACEHOLDER copy; "\n" is a line break (2 lines max). */
  message: string;
  /** Level-indicator slots (1-based) lit once this level starts. */
  slots: number[];
  title: string;
};

export const LEVEL_INFO: Record<LevelNumber, LevelInfo> = {
  1: {
    interaction: "tap",
    types: ["power"],
    instruction: "level-1",
    message: "level one... restoration of\npower to the region",
    slots: [1],
    title: "Power stations",
  },
  2: {
    interaction: "connect",
    types: ["power"],
    instruction: "level-2",
    message: "level two... reconnecting the\npower grid across the region",
    slots: [1, 2],
    title: "Transmission lines",
  },
  3: {
    interaction: "circle",
    types: ["water"],
    instruction: "level-3",
    message: "level three... restoration of\nwater to the region",
    slots: [1, 2, 3],
    title: "Water facilities",
  },
  4: {
    interaction: "circle",
    types: ["hospital", "shelter"],
    instruction: "level-4",
    message: "level four... restoration of\npower to hospitals and shelters",
    slots: [1, 2, 3, 4, 5],
    title: "Hospitals and shelters",
  },
  5: {
    interaction: "tap",
    types: ["police", "fire"],
    instruction: "level-5",
    message: "level five... restoration of\npolice and fire stations",
    slots: [1, 2, 3, 4, 5, 6, 7],
    title: "Police and fire stations",
  },
};

export const LEVEL_NUMBERS: LevelNumber[] = [1, 2, 3, 4, 5];

const s = (...ids: string[]): OutageStep => ({ facilityIds: ids });

/**
 * TEMPORARY content: names, severities and outage picks are placeholders until the team supplies the real ones.
 * Facility ids come from electricGridFacilities.ts. Circle levels use groups of 2-4 that are spatially clustered (level 4 mixes a hospital with a shelter in each group).
 * Run the checks in `validateStorms()` after editing.
 */
export const STORMS: Storm[] = [
  {
    name: "Tropical Storm Alma",
    severity: "Tropical Storm",
    blurb: "Heavy rain and strong winds are heading for the city.",
    levels: {
      1: [s("power-6"), s("power-5"), s("power-4")],
      2: [s("power-10"), s("power-11"), s("power-7")],
      3: [s("water-4", "water-5"), s("water-1", "water-3")],
      4: [s("shelter-6", "hospital-6"), s("hospital-5", "shelter-4"), s("shelter-2", "hospital-4")],
      5: [s("police-6"), s("fire-10"), s("police-7"), s("fire-12")],
    },
  },
  {
    name: "Hurricane Bruno",
    severity: "Category 1 Hurricane",
    blurb: "Winds over 75 miles per hour are expected to damage power lines.",
    levels: {
      1: [s("power-10"), s("power-11"), s("power-12"), s("power-6")],
      2: [s("power-3"), s("power-4"), s("power-5"), s("power-1")],
      3: [s("water-4", "water-5"), s("water-15", "water-18"), s("water-12", "water-13")],
      4: [s("hospital-4", "shelter-2"), s("hospital-5", "shelter-4"), s("hospital-7", "shelter-7")],
      5: [s("police-10"), s("fire-15"), s("police-11"), s("fire-19"), s("police-12"), s("fire-16")],
    },
  },
  {
    name: "Hurricane Celia",
    severity: "Category 3 Hurricane",
    blurb: "A major hurricane is on the way, with damaging winds and storm surge.",
    levels: {
      1: [s("power-16"), s("power-17"), s("power-18"), s("power-14"), s("power-13"), s("power-12")],
      2: [s("power-11"), s("power-19"), s("power-20"), s("power-21")],
      3: [s("water-8", "water-19"), s("water-15", "water-18"), s("water-16", "water-17")],
      4: [s("hospital-12", "shelter-13"), s("hospital-11", "shelter-12"), s("shelter-16", "hospital-10")],
      5: [s("police-13"), s("fire-8"), s("fire-7"), s("police-11"), s("fire-20"), s("police-10")],
    },
  },
  {
    name: "Hurricane Dalia",
    severity: "Category 5 Hurricane",
    blurb: "The strongest kind of hurricane is about to make landfall.",
    levels: {
      1: [s("power-21"), s("power-20"), s("power-19"), s("power-7"), s("power-15"), s("power-14")],
      2: [s("power-16"), s("power-17"), s("power-18"), s("power-13"), s("power-12"), s("power-11")],
      3: [s("water-15", "water-18", "water-16", "water-17"), s("water-8", "water-19", "water-7"), s("water-9", "water-10")],
      4: [s("hospital-11", "shelter-12"), s("hospital-6", "shelter-6"), s("shelter-16", "hospital-10")],
      5: [s("fire-18"), s("police-13"), s("fire-17"), s("police-12"), s("fire-16"), s("police-7")],
    },
  },
];

/** Zones that contain an outage on any level. */
export function stormZones(storm: Storm): number[] {
  const zones = new Set<number>();
  for (const n of LEVEL_NUMBERS) {
    for (const step of storm.levels[n]) for (const id of step.facilityIds) zones.add(FACILITY_BY_ID[id].zoneId);
  }
  return [...zones].sort((a, b) => a - b);
}

type P = { x: number; y: number };

function hull(points: P[]): P[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const build = (list: P[]) => {
    const out: P[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...build(pts), ...build([...pts].reverse())];
}

function distToSegment(p: P, a: P, b: P) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function pointInPolygon(p: P, poly: P[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Whether a point lies inside (or within `pad` of) the hull of a group of facilities. */
export function nearGroup(p: P, group: OutageStep, pad = 55) {
  const pts = group.facilityIds.map((id) => FACILITY_BY_ID[id]);
  const h = hull(pts);
  if (h.length >= 3 && pointInPolygon(p, h)) return true;
  if (h.length === 1) return Math.hypot(p.x - h[0].x, p.y - h[0].y) <= pad;
  return h.some((a, i) => distToSegment(p, a, h[(i + 1) % h.length]) <= pad);
}

/** Facilities drawn for a level: every one of its types inside the storm's zones, minus decoys a group loop would also catch. */
export function visibleFacilityIds(storm: Storm, level: LevelNumber): string[] {
  const zones = new Set(stormZones(storm));
  const { types, interaction } = LEVEL_INFO[level];
  const steps = storm.levels[level];
  const outage = new Set(steps.flatMap((st) => st.facilityIds));
  return FACILITIES.filter((f) => types.includes(f.type) && zones.has(f.zoneId))
    .filter((f) => outage.has(f.id) || interaction !== "circle" || !steps.some((st) => nearGroup(f, st)))
    .map((f) => f.id);
}

/** Small seeded PRNG (mulberry32), so the same storm always groups its stations the same way. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Level 2's payoff: the transmission lines for every other visible power station, as several separate chains (never one
 * network) about as long as the player's own. Deterministic per storm: a seeded pick of where each chain starts, then its
 * nearest unused stations, in nearest-neighbor order. A leftover short of a chain of 2 joins the nearest chain's end.
 */
export function transmissionChains(storm: Storm): string[][] {
  const answer = storm.levels[2].map((st) => st.facilityIds[0]);
  const taken = new Set(answer);
  const rest = visibleFacilityIds(storm, 2).filter((id) => !taken.has(id));
  // About as many chains as the answer's length fits (at least two when there are enough stations), evenly sized.
  const size = Math.ceil(rest.length / (rest.length < 4 ? 1 : Math.max(2, Math.round(rest.length / Math.max(2, answer.length)))));
  const rand = seeded([...storm.name].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261));
  const dist = (a: string, b: string) => Math.hypot(FACILITY_BY_ID[a].x - FACILITY_BY_ID[b].x, FACILITY_BY_ID[a].y - FACILITY_BY_ID[b].y);
  const chains: string[][] = [];
  while (rest.length) {
    const chain = [rest.splice(Math.floor(rand() * rest.length), 1)[0]];
    while (chain.length < size && rest.length) {
      const tail = chain[chain.length - 1];
      const next = rest.reduce((best, id) => (dist(tail, id) < dist(tail, best) ? id : best));
      rest.splice(rest.indexOf(next), 1);
      chain.push(next);
    }
    chains.push(chain);
  }
  const lone = chains.findIndex((c) => c.length < 2);
  if (lone >= 0 && chains.length > 1) {
    const [id] = chains.splice(lone, 1)[0];
    const host = chains.reduce((best, c) => (dist(c[c.length - 1], id) < dist(best[best.length - 1], id) ? c : best));
    host.push(id);
  }
  return chains.filter((c) => c.length >= 2);
}

/** Dev check: returns a list of problems (empty when the data is sound). */
export function validateStorms(): string[] {
  const problems: string[] = [];
  for (const storm of STORMS) {
    for (const n of LEVEL_NUMBERS) {
      const steps = storm.levels[n];
      const { types, interaction } = LEVEL_INFO[n];
      const where = `${storm.name} L${n}`;
      const ids = steps.flatMap((st) => st.facilityIds);
      if (new Set(ids).size !== ids.length) problems.push(`${where}: duplicate facility`);
      if (ids.length > 6 && interaction !== "circle") problems.push(`${where}: more than 6 outages`);
      if (steps.length > (interaction === "circle" ? 3 : 6)) problems.push(`${where}: too many steps`);
      for (const id of ids) {
        const f = FACILITY_BY_ID[id];
        if (!f) problems.push(`${where}: unknown ${id}`);
        else if (!types.includes(f.type)) problems.push(`${where}: ${id} wrong type`);
        else if (!f.zoneId) problems.push(`${where}: ${id} outside zones`);
      }
      if (interaction === "circle") {
        steps.forEach((st, i) => {
          if (st.facilityIds.length < 2 || st.facilityIds.length > 4) problems.push(`${where}: group ${i} size`);
          if (types.length > 1 && new Set(st.facilityIds.map((id) => FACILITY_BY_ID[id].type)).size < types.length) problems.push(`${where}: group ${i} should mix ${types.join(" and ")}`);
          steps.forEach((other, j) => {
            if (i !== j) for (const id of other.facilityIds) if (nearGroup(FACILITY_BY_ID[id], st, 45)) problems.push(`${where}: ${id} too close to group ${i}`);
          });
        });
      } else if (steps.some((st) => st.facilityIds.length !== 1)) problems.push(`${where}: expected single steps`);
    }
    const powerL1 = storm.levels[1].flatMap((st) => st.facilityIds);
    if (storm.levels[2].some((st) => powerL1.includes(st.facilityIds[0]))) problems.push(`${storm.name}: levels 1 and 2 share a station`);
  }
  return problems;
}

/** TEMPORARY copy. */
export const COPY = {
  beginTitle: "Restore the Grid",
  beginHint: "Touch to begin",
  stormComing: "A storm is coming",
  stormAftermath: "The storm has knocked out power and utilities and it's up to you to restore services to the region.",
  outroTitle: "The lights are back on!",
  outroBody: "You restored power in the same order it was lost. Real crews do this every storm: hospitals, water and shelters first, so people stay safe.",
  exit: "Exit",
  replay: "Replay outages",
  watching: "Watch the order the power goes out...",
  tooMany: "That loop caught too many. Circle up to 4 at a time.",
};

export function explainMistake(interaction: Interaction, number: number): string {
  if (interaction === "circle") return `That wasn't the group that lost power ${ordinal(number)}. Circle only the dark ones that went out together, in order.`;
  if (interaction === "connect") return `The chain should start with the station that lost power ${ordinal(number)}, then follow the order they went dark.`;
  return `That one wasn't next. The ${ordinal(number)} place to lose power should come back first.`;
}

function ordinal(n: number) {
  return ["first", "second", "third", "fourth", "fifth", "sixth"][n - 1] ?? `#${n}`;
}
