# Electric Grid

Spec for the **ElectricGrid** touch-kiosk game. A storm knocks out facilities across the map; the player restores them **in the order they lost power**.

---

## 1. Overview

- A storm hits several **zones** on the map and causes **outages** on facilities (shown as icons).
- There are **4 storms** with different severities; each storm has its own set of outages.
- The player must restore facilities in the **exact order** they went out.
- The game has **5 levels**. Each level introduces one facility type (level 4 and level 5 two) and one interaction method.
- Limits per level: **max 6 outages** and **max 3 outage groups**.
- Zones displayed are those containing outages for any of the 5 levels.

---

## 2. Facility Icons

Each facility type is used by one level (Levels 4 and 5 use two).

| Level | Facility type            |
| ----- | ------------------------ |
| 1     | Power station            |
| 2     | Power station            |
| 3     | Water facility           |
| 4     | Hospital **and** Shelter |
| 5     | Police **and** Fire station |

### Icon states

1. **Outage alert**: flash / pulse / radar-blip animation on the facility (or group of facilities) that just lost power. Plays in outage order to show the player the sequence.
2. **Power outage**: greyed-out icon, shown until the facility is restored.

---

## 3. Interaction Methods

| Method | Used in | Selects |
| ------ | ------- | ------- |
| **Tap** | Levels 1, 5 | One facility per tap |
| **Connect** | Level 2 | An ordered chain of facilities |
| **Circle** | Levels 3, 4 | A group of up to 4 facilities |

### 3.1 Tap
- Tapping a facility restores it. Order is validated against the outage sequence.

### 3.2 Connect (drag between facilities)
1. `touchStart` on a facility begins the connection.
2. Drag to the next facility; a **dashed line follows the touch**.
3. Continue dragging through further facilities (the line snaps/connects to each one).
4. `touchEnd` ends the connection and **submits the order**.

### 3.3 Circle (group select)
1. `touchStart` begins drawing; a **dashed line** traces the touch path.
2. On `touchMove`, continuously compute which facilities are enclosed.
3. `touchEnd` closes the shape and **submits the selected group**.
- Max **4 facilities** per group.
- Groups are submitted in the order the groups lost power.

**TBD**: wrong-order feedback and retry behavior for each method; whether the circle auto-closes if the path doesn't loop; behavior when more than 4 are enclosed.

---

## 4. Game Flow

### 4.1 Intro
1. "A storm is coming" message displays the storm's **severity**.
2. **Establishing shot** (`INTRO_ESTABLISH_MS`): the map with the storm's zones (still blue), **all 20 zone name labels** (whether or not the zone is in the storm) and the **level-1 power station icons** fade in. Labels are PNGs in `public/electric-grid/zone-labels/` (canvas = the map viewBox, positions in `ZONE_LABELS` in `ElectricGridMap.tsx`); every on-canvas zone gets one, and English Turn, Waggerman and Kenner (off the canvas in the PSD) are not rendered.
3. A **storm with a weather-service Doppler radar look** fades in over the zones with outages (`INTRO_STORM_MS`). It does **not** slide in; it builds up in place and keeps churning while visible.
   - Rendered with a **WebGL fragment shader on a `<canvas>` overlay** above the map (`stormRadar.ts`), not SVG. Falls back to no storm if WebGL is unavailable.
   - Matches the reference footage in `radar.mp4`: textured, noisy rain cells with sharp banded reflectivity colors (not smooth blurs).
   - Colors by intensity, outer to core: cyan fringe, light green, green, dark green, yellow, orange, red, with magenta/white hot spots.
   - **Moves like a real radar loop**: the whole system drifts west to east (slightly north) while it's visible. The cells creep slowly along that heading and the rain texture streams through them faster. Movement is subtle; cells stay over their zones.
   - Intensity = soft cell falloff + slowly drifting, domain-warped noise, quantized onto the color bands.
   - **One cell per outage zone**, each the same size as its zone, with soft, feathered edges. Zones without outages get no storm. Cells are not masked to the zone shapes.
4. As the storm finishes the **zone labels hide**, then the zones **and their icons pop off in sequence** (`popOffZones`): the reverse of the outro's pop-on order (outer rings first, clockwise), one every `INTRO_POP_MS` with the outro's `zoneTick` sound.
5. A centered message (`COPY.stormAftermath`: "The storm has knocked out power and utilities and it's up to you to restore services to the region.") shows for `INTRO_MESSAGE_MS`, then level 1 starts.

### 4.2 Levels

| # | Interaction | Facility | Order to restore | Level indicator shows | Instruction shown |
| - | ----------- | -------- | ---------------- | --------------------- | ----------------- |
| 1 | Tap | Power stations | Each facility, in outage order | Level 1 | 1st |
| 2 | Connect | Power stations | Each facility, in outage order | Levels 1–2 | 2nd |
| 3 | Circle | Water facilities | Each group, in the order each group lost power | Levels 1–3 | 3rd |
| 4 | Circle | Hospitals **and** Shelters (each group mixes both) | Each group, in the order each group lost power | Levels 1–4 | 4th |
| 5 | Tap | Police **and** Fire stations | Each facility, in outage order | Levels 1–5 (all) | 5th |

The level indicator is cumulative: it reveals one more level each time the player advances. The level box keeps its 7 icon slots (hospital and shelter are lit together at level 4, police and fire together at level 5). Its progress bar fills to (lit slots / 7), and a short message (`LEVEL_INFO[n].message`, placeholder copy in `src/lib/electricGridStorms.ts`) is shown under it. The message is typed out character by character with a cursor that disappears when typing finishes (instant with `prefers-reduced-motion`). Every level completion has a payoff: the lit level icons pulse and every restored facility icon throbs (scales up and down), each with its own duration and delay derived from its id so the timing is uneven but stable. Completing level 2 (connect) also lights the **transmission lines** (below). Completing level 3 (water) also reveals the water exit paths (`EXIT_PATHS_LEVEL` in `ElectricGridGame.tsx`), hidden again when level 4 starts. The instruction panel has an in-panel button row above it (shown during watch/play): **Replay** (replays the outage order) and **Quit** (exits the game back to the "Begin" state, same as the inactivity reset, `onQuit` -> `reset`). Both are touch targets with press feedback. The panel SVG viewBox starts at y=867 so the row sits ~13 units above the box (box position unchanged). Only the flows whose water icons are all visible on the map are shown (a flow that would start at a hidden icon is skipped), fading in one after another.

**Level intro (linear, each step starts when the previous finishes):**
1. The level description (`LEVEL_INFO[n].message`) types out under a **spotlight** (the rest of the screen dims, the panel gets an amber outline).
2. The spotlight moves to the instruction panel, which fades in and has its caption "typed" (revealed left to right in steps). While shown, its art demonstrates the gesture on a loop (`startDemo` in `InstructionBox.tsx`): starting as the caption begins typing and repeating after a ~3 s hold on the design, the icons dim and the hand taps them in order (levels 1, 5), drags the dotted line through them (level 2) or circles them, drawing the dashed loop (levels 3, 4), lighting each icon as it is reached, then ends back on the design. Off with `prefers-reduced-motion`. The instruction is hidden during the previous level's payoff so it appears fresh here.
3. The spotlight lifts, the level's icons appear and the outage sequence plays ("Watching..."), then play begins.
Input is blocked during all three steps (phase `briefing`, then `watch`). All timers are tied to the run token, so reset/level change/unmount cancels them. With `prefers-reduced-motion` text and captions appear at once and the spotlight does not animate. The spotlight is a simple overlay in `ElectricGridGame.tsx` (`SPOTLIGHTS` holds the two target boxes as % of the map).

**Payoff sounds** (synthesized with WebAudio in `src/lib/electricGridSound.ts`, no audio files; all respect `setMuted`): every level completion (including level 5) plays `levelJingle` (~3 s melodic phrase with bass and a closing chord); the outro's final reveal plays `finalJingle` (~6 s two-part fanfare ending on a held chord with sparkle).

**Transmission lines (level 2 payoff):** after the player connects level 2, a layer of lines draws on in the style of the player's connect path (dark underlay, white dots; `showTransmission` in `ElectricGridMap.tsx`): first the player's own chain, then chains for every other visible power station (`transmissionChains` in `electricGridStorms.ts`). The others are **not** one network: they are split into several separate chains about as long as the player's, grouped by proximity with a per-storm seeded start, and fade in one after another like the water arrows (`TRANSMISSION_STAGGER_MS`). Afterwards the layer fades to a low opacity (`TRANSMISSION_DIM_OPACITY`) and stays, under the icons, for the rest of the game (cleared on reset).

**Icons per level:** when a new level begins, only that level's facility icons are shown. Icons from previous levels are hidden (along with any hint, selection and pulse rings) before the new level's icons fade in. Restored/outage states do not carry over between levels.

### 4.3 Outro
1. When the game completes, **all icons hide**.
2. **All active zones turn off** one at a time, from the map center outward and counter-clockwise: zones are grouped into 400-unit distance bands from the map center, and within a band go counter-clockwise (on screen) starting from due east (`hideZonesOutward`). Each zone switching off plays a short falling whoosh-tick (`zoneTick`, pitch sweeping down across the run) in sync with the 300ms stagger. The zone tint fades back in at a stronger opacity than the normal faint one (`OUTRO_ZONE_OPACITY` 0.3 vs 0.141 in `ElectricGridMap.tsx`, with the other zones held at their old look) so it is clearly visible.
3. **Every icon grows back on** in a random order (`growFacilities`: shuffled each run, each icon fades in while scaling up from nothing) spread over `OUTRO_GROW_MS` (12 s), each with a rising `popTick`. `finalJingle` starts so its closing chord lands as the last icon does, then the water flow directions show and all icons throb with staggered timing before the card.
4. A completion message is shown.
5. A button appears to exit; pressing it **restarts the experience** at the **"Begin"** button.

All text uses Helvetica Neue (falling back to Helvetica, Arial, sans-serif); the Geist fonts were removed from the app.

---

## 5. Inactivity Reset

- The timer runs only during level play (briefing / watch / play / level-done) and on the final completion card; it is off on the Begin and storm-picker screens and during the intro, storm and outro animations, and restarts each time it becomes active.
- After a period of inactivity, show an **"Are you still there?"** prompt.
- If there is no response, the game **resets** to the start.
- **Requirement:** build this as a **shared component/hook outside the Electric Grid experience** so other experiences can reuse it (see the existing inactivity timer in `evacuation/EvacuationKiosk.tsx`, which currently has no prompt).
- Timeout duration and prompt countdown length default 30 seconds (make configurable).

---

## 6. Data Model (proposed)

```ts
type FacilityType = "power" | "water" | "hospital" | "shelter" | "police" | "fire";

type Facility = { id: string; type: FacilityType; x: number; y: number; zoneId: number };

type OutageStep = { facilityIds: string[] }; // 1 id = single, 2–4 ids = group

type Storm = {
  severity: string;
  levels: Record<1 | 2 | 3 | 4 | 5, OutageStep[]>; // ≤ 6 outages, ≤ 3 groups per level (level 4 groups mix a hospital and a shelter)
};
```

- 4 `Storm` definitions: the player picks one each play from a "Choose a storm" modal shown after Begin (no rotation); it lists name, severity and number of areas hit, and Back/Escape returns to the begin card.

---

## 7. Assets

Located in `apps/katrina-beyond/public/electric-grid/`: base map, zone images (`zone-N.png`), boundary lines, facility icons, and `ui/` (instruction art for touch / connect / circle, level UI, transmission lines, replay / quit buttons), and `zone-labels/` (zone name labels).

---

## 8. Open Questions

- Restored-state visual and success/failure feedback per step. **Same functionality as previous game. ElectricGridKiosk**
- Wrong-answer behavior (retry, penalty, hint replay of the outage sequence). **Same functionality as previous game. ElectricGridKiosk**
- Storm names/severities and the outage data for all 4 storms. **Make temp decisions**
- Copy for the intro, five instructions, and outro messages. **Make temp decisions**
- Inactivity timing values. **see above**
