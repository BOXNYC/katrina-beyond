"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FACILITIES, FACILITY_BY_ID, type Facility } from "@/lib/electricGridFacilities";
import { buzz, cheer, playStorm, preloadStorm, stopStorm, tone, unlockAudio } from "@/lib/electricGridSound";
import {
  COPY,
  LEVEL_INFO,
  STORMS,
  explainMistake,
  pointInPolygon,
  stormZones,
  visibleFacilityIds,
  type LevelNumber,
  type Storm,
} from "@/lib/electricGridStorms";
import AreYouStillThere from "../AreYouStillThere";
import { useIdlePrompt } from "../useIdlePrompt";
import StormPicker from "./StormPicker";
import ElectricGridMap, { type ElectricGridMapHandle, type MapPoint } from "./ElectricGridMap";

type Phase = "begin" | "choose" | "intro" | "watch" | "play" | "levelDone" | "outro";

/** How close (map units) a touch must land to a facility to count as on it. */
const HIT_RADIUS = 64;
const OUTAGE_COLOR = "#f87171";
const RESTORED_COLOR = "#4ade80";
/**
 * The level whose completion reveals the water exit paths. Assumption: "on the 3rd level the water exits
 * is displayed" means shown as that level's completion reward. Only flows whose water icons are all on the map
 * (in this storm's zones) are drawn, so no flow starts from an icon the player can't see. To show them for the whole of level 3 while
 * playing instead, call showExitPaths in startLevel(EXIT_PATHS_LEVEL) and drop it from finishLevel.
 */
const EXIT_PATHS_LEVEL: LevelNumber = 3;
/**
 * Completion beat (the payoff) before the next level starts; the level-box pulse (900ms) and the icon throb (up to
 * ~700ms delay + 2 x 1100ms) must finish inside it.
 */
const LEVEL_DONE_MS = 3000;
/** Longer beat when the exit paths are revealed (they fade in one after another), so they can be seen. */
const EXIT_PATHS_DONE_MS = 4500;
/** Outro: pause with every icon hidden, gap between zones switching off, and how long the final reveal plays before the card. */
const OUTRO_HIDDEN_MS = 1000;
const OUTRO_ZONE_MS = 300;
const OUTRO_REVEAL_MS = 4000;

type Gesture =
  | { kind: "connect"; pointerId: number; chain: string[] }
  | { kind: "circle"; pointerId: number; points: MapPoint[]; enclosed: string[] };

export default function ElectricGridGame({
  idleTimeoutMs = 30_000,
  idleCountdownMs = 30_000,
}: {
  /** Quiet time before "Are you still there?" appears. */
  idleTimeoutMs?: number;
  /** How long that prompt waits before the game resets. */
  idleCountdownMs?: number;
}) {
  const map = useRef<ElectricGridMapHandle>(null);
  const run = useRef(0); // bumps to cancel any running sequence
  const gesture = useRef<Gesture | null>(null);
  const live = useRef({
    phase: "begin" as Phase,
    level: 1 as LevelNumber,
    progress: 0,
    storm: STORMS[0] as Storm,
    candidates: [] as Facility[],
    restored: new Set<string>(),
  });

  const [phase, setPhase] = useState<Phase>("begin");
  const [storm, setStorm] = useState<Storm>(STORMS[0]);
  const [card, setCard] = useState(false);

  useEffect(() => {
    const token = run;
    return () => {
      token.current++;
    };
  }, []);

  const go = (next: Phase) => {
    live.current.phase = next;
    setPhase(next);
  };

  const wait = (ms: number, token: number) =>
    new Promise<boolean>((resolve) => window.setTimeout(() => resolve(run.current === token), ms));

  const clearFeedback = () => {
    map.current?.setRings("hint", []);
    map.current?.setRings("select", []);
    map.current?.setPath(null);
  };

  const reset = () => {
    run.current++;
    stopStorm();
    gesture.current = null;
    map.current?.reset();
    map.current?.level.reset();
    map.current?.instruction.reset();
    map.current?.message.reset();
    setCard(false);
    go("begin");
  };

  const idle = useIdlePrompt({ active: phase !== "begin", timeoutMs: idleTimeoutMs, countdownMs: idleCountdownMs, onReset: reset });

  /** Pulses each remaining outage step in order, with a blip of sound. When `lose` is set the facilities also go grey. */
  const playOutages = async (n: LevelNumber, token: number, lose: boolean) => {
    const steps = live.current.storm.levels[n];
    for (let i = lose ? 0 : live.current.progress; i < steps.length; i++) {
      const ids = steps[i].facilityIds;
      map.current?.pulse(ids, OUTAGE_COLOR);
      tone(260 + i * 70, 220, "triangle");
      if (lose) map.current?.setFacilities(ids, "outage", true);
      if (!(await wait(ids.length > 1 ? 1500 : 1100, token))) return false;
    }
    return wait(400, token);
  };

  const startLevel = async (n: LevelNumber, token: number) => {
    const info = LEVEL_INFO[n];
    const l = live.current;
    l.level = n;
    l.progress = 0;
    l.restored = new Set();
    const ids = visibleFacilityIds(l.storm, n);
    l.candidates = ids.map((id) => FACILITY_BY_ID[id]);
    clearFeedback();
    go("watch");
    map.current?.hideExitPaths(true);
    map.current?.level.completeLevels(info.slots);
    map.current?.level.setProgress(info.slots.length / 7);
    map.current?.message.setMessage(info.message);
    map.current?.instruction.showInstruction(info.instruction);
    map.current?.instruction.showReplay();
    map.current?.hideFacilities(true); // only this level's icons stay on the map
    map.current?.setFacilities(ids, "ok", true);
    if (!(await wait(1600, token))) return;
    if (!(await playOutages(n, token, true))) return;
    go("play");
  };

  const outro = async (token: number) => {
    go("outro");
    map.current?.instruction.hideInstruction();
    map.current?.instruction.hideReplay();
    map.current?.message.hideMessage();
    map.current?.hideExitPaths(true);
    map.current?.hideFacilities(true); // 1. every icon off
    if (!(await wait(OUTRO_HIDDEN_MS, token))) return;
    const zones = stormZones(live.current.storm);
    map.current?.hideZonesOutward(zones, OUTRO_ZONE_MS); // 2. zones off, center out, counter-clockwise
    if (!(await wait(zones.length * OUTRO_ZONE_MS + 1000, token))) return;
    const all = FACILITIES.map((f) => f.id); // 3. every icon back, with the water flows, all throbbing
    map.current?.setFacilities(all, "ok", true);
    map.current?.showExitPaths(true);
    map.current?.throb(all, 3);
    if (!(await wait(OUTRO_REVEAL_MS, token))) return;
    setCard(true);
  };

  const finishLevel = async () => {
    const token = run.current;
    go("levelDone");
    cheer();
    const n = live.current.level;
    map.current?.instruction.hideMessage();
    map.current?.instruction.hideReplay();
    map.current?.level.pulse(LEVEL_INFO[n].slots);
    // Payoff: every restored icon throbs; the water level also shows the flows between its (visible) icons.
    map.current?.throb([...live.current.restored]);
    const revealPaths = n === EXIT_PATHS_LEVEL;
    if (revealPaths) map.current?.showExitPaths(true, visibleFacilityIds(live.current.storm, n));
    if (!(await wait(revealPaths ? EXIT_PATHS_DONE_MS : LEVEL_DONE_MS, token))) return;
    if (n < 6) await startLevel((n + 1) as LevelNumber, token);
    else await outro(token);
  };

  const begin = () => {
    unlockAudio();
    preloadStorm();
    go("choose");
  };

  const pickStorm = async (index: number) => {
    if (live.current.phase !== "choose") return;
    const token = ++run.current;
    const next = STORMS[index];
    live.current.storm = next;
    setStorm(next);
    map.current?.reset();
    map.current?.level.reset();
    map.current?.instruction.reset();
    map.current?.message.reset();
    go("intro");
    setCard(true);
    playStorm();
    if (!(await wait(3600, token))) return;
    setCard(false);
    const zones = stormZones(next);
    map.current?.showStorm(zones, 3500);
    if (!(await wait(1200, token))) return;
    map.current?.showZones(zones, true, 350);
    if (!(await wait(Math.max(2600, zones.length * 350 + 800), token))) return;
    map.current?.hideStorm(1200);
    if (!(await wait(1400, token))) return;
    await startLevel(1, token);
  };

  const replay = async () => {
    if (live.current.phase !== "play") return;
    const token = run.current;
    clearFeedback();
    map.current?.instruction.hideMessage();
    go("watch");
    if (await playOutages(live.current.level, token, false)) go("play");
  };

  const expectedIds = () => live.current.storm.levels[live.current.level][live.current.progress]?.facilityIds ?? [];

  /** Restores the next outage step in order. `i` staggers the sound when several land at once. */
  const restoreStep = (i = 0) => {
    const l = live.current;
    const ids = l.storm.levels[l.level][l.progress].facilityIds;
    ids.forEach((id) => l.restored.add(id));
    map.current?.setFacilities(ids, "ok", true);
    map.current?.pulse(ids, RESTORED_COLOR);
    const note = 520 + l.progress * 60;
    window.setTimeout(() => tone(note, 250), i * 140);
    l.progress++;
    map.current?.setRings("hint", []);
  };

  const wrong = (message: string) => {
    buzz();
    map.current?.setRings("hint", expectedIds());
    map.current?.instruction.showMessage(message);
  };

  const afterSubmit = () => {
    const l = live.current;
    if (l.progress >= l.storm.levels[l.level].length) void finishLevel();
  };

  const submitTap = (id: string) => {
    if (expectedIds()[0] === id) restoreStep();
    else return wrong(explainMistake("tap", live.current.progress + 1));
    afterSubmit();
  };

  const submitChain = (chain: string[]) => {
    const l = live.current;
    const remaining = l.storm.levels[l.level].slice(l.progress).map((st) => st.facilityIds[0]);
    let k = 0;
    while (k < chain.length && chain[k] === remaining[k]) k++;
    for (let i = 0; i < k; i++) restoreStep(i);
    if (k < chain.length) return wrong(explainMistake("connect", l.progress + 1));
    afterSubmit();
  };

  const submitGroup = (ids: string[]) => {
    if (!ids.length) return;
    if (ids.length > 4) return wrong(COPY.tooMany);
    const want = expectedIds();
    if (ids.length === want.length && want.every((id) => ids.includes(id))) restoreStep();
    else return wrong(explainMistake("circle", live.current.progress + 1));
    afterSubmit();
  };

  const nearest = (p: MapPoint, skipRestored = true) => {
    let best: Facility | null = null;
    let bestD = HIT_RADIUS;
    for (const f of live.current.candidates) {
      if (skipRestored && live.current.restored.has(f.id)) continue;
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  };

  const mapPoint = (e: ReactPointerEvent) => map.current?.toMapPoint(e.clientX, e.clientY) ?? null;

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (live.current.phase !== "play" || gesture.current) return;
    map.current?.instruction.hideMessage(); // the mistake message gives way to the instruction on the next input
    const p = mapPoint(e);
    if (!p) return;
    const { interaction } = LEVEL_INFO[live.current.level];
    if (interaction === "tap") {
      const f = nearest(p);
      if (f) submitTap(f.id);
      return;
    }
    if (interaction === "connect") {
      const f = nearest(p);
      if (!f) return;
      tone(440, 90);
      gesture.current = { kind: "connect", pointerId: e.pointerId, chain: [f.id] };
      map.current?.setPath([f, p]);
    } else {
      gesture.current = { kind: "circle", pointerId: e.pointerId, points: [p], enclosed: [] };
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const p = mapPoint(e);
    if (!p) return;
    if (g.kind === "connect") {
      const f = nearest(p);
      if (f && !g.chain.includes(f.id)) {
        g.chain.push(f.id);
        tone(440 + g.chain.length * 50, 90);
      }
      map.current?.setPath([...g.chain.map((id) => FACILITY_BY_ID[id]), p]);
      return;
    }
    const last = g.points[g.points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 8) return;
    g.points.push(p);
    // Live hit-test: whatever the loop would enclose if closed right now.
    const enclosed = g.points.length >= 3 ? live.current.candidates.filter((f) => !live.current.restored.has(f.id) && pointInPolygon(f, g.points)).map((f) => f.id) : [];
    if (enclosed.join() !== g.enclosed.join()) {
      g.enclosed = enclosed;
      map.current?.setRings("select", enclosed);
    }
    map.current?.setPath(g.points);
  };

  const onPointerEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    map.current?.setPath(null);
    map.current?.setRings("select", []);
    if (live.current.phase !== "play") return;
    if (g.kind === "connect") submitChain(g.chain);
    else if (g.points.length >= 6) submitGroup(g.enclosed);
  };

  return (
    <div
      className="relative flex min-h-screen select-none items-center justify-center bg-black"
      onPointerDown={() => unlockAudio()}
    >
      <div className="relative" style={{ width: "min(100vw, calc(100vh * 2932 / 1648))" }}>
        <ElectricGridMap
          ref={map}
          onReplay={replay}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{ width: "100%", height: "auto", touchAction: "none" }}
        />

        {phase === "watch" && (
          <p className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-slate-950/80 px-6 py-3 text-2xl text-amber-200">
            {COPY.watching}
          </p>
        )}

        {phase === "begin" && (
          <button onClick={begin} className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/55 text-center text-white">
            <span className="text-7xl font-semibold">{COPY.beginTitle}</span>
            <span className="animate-pulse rounded-full bg-amber-400 px-12 py-4 text-3xl font-semibold text-slate-950">Begin</span>
            <span className="text-xl text-slate-300">{COPY.beginHint}</span>
          </button>
        )}

        {phase === "choose" && <StormPicker storms={STORMS} onPick={pickStorm} onBack={() => go("begin")} />}

        {phase === "intro" && card && (
          <Card>
            <p className="text-2xl uppercase tracking-widest text-slate-300">{COPY.stormComing}</p>
            <h2 className="text-6xl font-semibold text-amber-300">{storm.severity}</h2>
            <p className="text-3xl text-white">{storm.name}</p>
            <p className="max-w-2xl text-2xl text-slate-200">{storm.blurb}</p>
          </Card>
        )}

        {phase === "outro" && card && (
          <Card>
            <h2 className="text-6xl font-semibold text-green-400">{COPY.outroTitle}</h2>
            <p className="max-w-2xl text-2xl text-slate-200">{COPY.outroBody}</p>
            <button onClick={reset} className="h-16 rounded-full bg-amber-400 px-12 text-2xl font-semibold text-slate-950 hover:bg-amber-300">
              {COPY.exit}
            </button>
          </Card>
        )}
      </div>

      {idle.prompting && <AreYouStillThere secondsLeft={idle.secondsLeft} onStay={idle.stay} />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-slate-950/80 p-10 text-center text-white">{children}</div>;
}
