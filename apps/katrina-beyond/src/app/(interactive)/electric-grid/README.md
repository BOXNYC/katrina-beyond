# Electric Grid

Spec for the **ElectricGrid** touch-kiosk game. A storm knocks out facilities across the map; the player restores them **in the order they lost power**.

---

## 1. Overview

- A storm hits several **zones** on the map and causes **outages** on facilities (shown as icons).
- There are **4 storms** with different severities; each storm has its own set of outages.
- The player must restore facilities in the **exact order** they went out.
- The game has **6 levels**. Each level introduces one facility type and one interaction method.
- Limits per level: **max 6 outages** and **max 3 outage groups**.
- Zones displayed are those containing outages for any of the 6 levels.

---

## 2. Facility Icons

Each facility type is used by one level (Level 6 uses two).

| Level | Facility type            |
| ----- | ------------------------ |
| 1     | Power station            |
| 2     | Power station            |
| 3     | Water facility           |
| 4     | Hospital                 |
| 5     | Shelter                  |
| 6     | Police **and** Fire station |

### Icon states

1. **Outage alert**: flash / pulse / radar-blip animation on the facility (or group of facilities) that just lost power. Plays in outage order to show the player the sequence.
2. **Power outage**: greyed-out icon, shown until the facility is restored.

---

## 3. Interaction Methods

| Method | Used in | Selects |
| ------ | ------- | ------- |
| **Tap** | Levels 1, 4, 6 | One facility per tap |
| **Connect** | Level 2 | An ordered chain of facilities |
| **Circle** | Levels 3, 5 | A group of up to 4 facilities |

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
2. A **storm with a weather-service Doppler radar look** fades in over the zones with outages. It does **not** slide in; it builds up in place and keeps churning while visible.
   - Rendered with a **WebGL fragment shader on a `<canvas>` overlay** above the map (`stormRadar.ts`), not SVG. Falls back to no storm if WebGL is unavailable.
   - Matches the reference footage in `radar.mp4`: textured, noisy rain cells with sharp banded reflectivity colors (not smooth blurs).
   - Colors by intensity, outer to core: cyan fringe, light green, green, dark green, yellow, orange, red, with magenta/white hot spots.
   - **Moves like a real radar loop**: the whole system drifts west to east (slightly north) while it's visible. The cells creep slowly along that heading and the rain texture streams through them faster. Movement is subtle; cells stay over their zones.
   - Intensity = soft cell falloff + slowly drifting, domain-warped noise, quantized onto the color bands.
   - **One cell per outage zone**, each the same size as its zone, with soft, feathered edges. Zones without outages get no storm. Cells are not masked to the zone shapes.
3. Zones with outages appear, **animated with staggered delays**, then the storm fades out.

### 4.2 Levels

| # | Interaction | Facility | Order to restore | Level indicator shows | Instruction shown |
| - | ----------- | -------- | ---------------- | --------------------- | ----------------- |
| 1 | Tap | Power stations | Each facility, in outage order | Level 1 | 1st |
| 2 | Connect | Power stations | Each facility, in outage order | Levels 1–2 | 2nd |
| 3 | Circle | Water facilities | Each group, in the order each group lost power | Levels 1–3 | 3rd |
| 4 | Tap | Hospitals | Each facility, in outage order | Levels 1–4 | 4th |
| 5 | Circle | Shelters | Each group, in the order each group lost power | Levels 1–5 | 5th |
| 6 | Tap | Police **and** Fire stations | Each facility, in outage order | Levels 1–6 (all) | 6th |

The level indicator is cumulative: it reveals one more level each time the player advances. Its progress bar fills to (lit levels / 7), and a short message (`LEVEL_INFO[n].message`, placeholder copy in `src/lib/electricGridStorms.ts`) is shown under it. When a level is completed the lit level icons pulse; completing level 3 (water) also reveals the water exit paths (`EXIT_PATHS_LEVEL` in `ElectricGridGame.tsx`), hidden again when level 4 starts. The instruction panel has an in-panel replay button (shown during watch/play) that replays the outage order.

**Icons per level:** when a new level begins, only that level's facility icons are shown. Icons from previous levels are hidden (along with any hint, selection and pulse rings) before the new level's icons fade in. Restored/outage states do not carry over between levels.

### 4.3 Outro
1. When the game completes, **all zones turn off**.
2. A completion message is shown.
3. A button appears to exit; pressing it **restarts the experience** at the **"Begin"** button.

---

## 5. Inactivity Reset

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
  levels: Record<1 | 2 | 3 | 4 | 5 | 6, OutageStep[]>; // ≤ 6 outages, ≤ 3 groups per level
};
```

- 4 `Storm` definitions: how a storm is chosen each play (rotating).

---

## 7. Assets

Located in `apps/katrina-beyond/public/electric-grid/`: base map, zone images (`zone-N.png`), boundary lines, facility icons, and `ui/` (instruction art for touch / connect / circle, level UI, transmission lines).

---

## 8. Open Questions

- Restored-state visual and success/failure feedback per step. **Same functionality as previous game. ElectricGridKiosk**
- Wrong-answer behavior (retry, penalty, hint replay of the outage sequence). **Same functionality as previous game. ElectricGridKiosk**
- Storm names/severities and the outage data for all 4 storms. **Make temp decisions**
- Copy for the intro, six instructions, and outro messages. **Make temp decisions**
- Inactivity timing values. **see above**
