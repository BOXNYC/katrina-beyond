"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FACILITY_BY_ID, type Facility } from "@/lib/electricGridFacilities";
import { buzz, cheer, setMuted, tone, unlockAudio } from "@/lib/electricGridSound";
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
import HelpAgent from "../HelpAgent";
import { useIdlePrompt } from "../useIdlePrompt";
import ElectricGridMap, { type ElectricGridMapHandle, type MapPoint } from "./ElectricGridMap";

type Phase = "begin" | "intro" | "watch" | "play" | "levelDone" | "outro";

/** How close (map units) a touch must land to a facility to count as on it. */
const HIT_RADIUS = 64;
const OUTAGE_COLOR = "#f87171";
const RESTORED_COLOR = "#4ade80";
const STORM_KEY = "electric-grid-last-storm";

let memoryStorm = -1;

/** Storms rotate each play, remembered across page loads when storage is available. */
function nextStormIndex() {
  let last = memoryStorm;
  try {
    const stored = window.localStorage.getItem(STORM_KEY);
    if (stored !== null) last = Number(stored);
  } catch {}
  const next = last < 0 || Number.isNaN(last) ? Math.floor(Math.random() * STORMS.length) : (last + 1) % STORMS.length;
  memoryStorm = next;
  try {
    window.localStorage.setItem(STORM_KEY, String(next));
  } catch {}
  return next;
}

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
  const [level, setLevel] = useState<LevelNumber>(1);
  const [progress, setProgress] = useState(0);
  const [storm, setStorm] = useState<Storm>(STORMS[0]);
  const [card, setCard] = useState(false);
  const [assist, setAssist] = useState("");
  const [sound, setSound] = useState(true);

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
    setAssist("");
  };

  const reset = () => {
    run.current++;
    gesture.current = null;
    map.current?.reset();
    map.current?.level.reset();
    map.current?.instruction.reset();
    setCard(false);
    setAssist("");
    setProgress(0);
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
    setLevel(n);
    setProgress(0);
    clearFeedback();
    go("watch");
    map.current?.level.completeLevels(info.slots);
    map.current?.instruction.showInstruction(info.instruction);
    map.current?.hideFacilities(true); // only this level's icons stay on the map
    map.current?.setFacilities(ids, "ok", true);
    if (!(await wait(1600, token))) return;
    if (!(await playOutages(n, token, true))) return;
    go("play");
  };

  const outro = async (token: number) => {
    go("outro");
    map.current?.instruction.hideInstruction();
    if (!(await wait(800, token))) return;
    map.current?.hideZones(true);
    map.current?.hideFacilities(true);
    if (!(await wait(1500, token))) return;
    setCard(true);
  };

  const finishLevel = async () => {
    const token = run.current;
    go("levelDone");
    cheer();
    if (!(await wait(1500, token))) return;
    const n = live.current.level;
    if (n < 6) await startLevel((n + 1) as LevelNumber, token);
    else await outro(token);
  };

  const begin = async () => {
    unlockAudio();
    const token = ++run.current;
    const next = STORMS[nextStormIndex()];
    live.current.storm = next;
    setStorm(next);
    map.current?.reset();
    map.current?.level.reset();
    map.current?.instruction.reset();
    go("intro");
    setCard(true);
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
    go("watch");
    if (await playOutages(live.current.level, token, false)) go("play");
  };

  const expectedIds = () => live.current.storm.levels[live.current.level][live.current.progress]?.facilityIds ?? [];

  const showNext = () => {
    if (live.current.phase !== "play") return;
    map.current?.setRings("hint", expectedIds());
    setAssist("The next one to restore is circled on the map.");
  };

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
    setProgress(l.progress);
    map.current?.setRings("hint", []);
    setAssist("");
  };

  const wrong = (message: string) => {
    buzz();
    map.current?.setRings("hint", expectedIds());
    setAssist(message);
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

  const info = LEVEL_INFO[level];
  const steps = storm.levels[level];
  const tips =
    phase === "watch"
      ? [COPY.watching]
      : [...info.tips, "Stuck? Press Replay outages to see the order again, or Show next step."];

  return (
    <div
      className="relative flex min-h-screen select-none items-center justify-center bg-black"
      onPointerDown={() => unlockAudio()}
    >
      <div className="relative" style={{ width: "min(100vw, calc(100vh * 2927 / 1646))" }}>
        <ElectricGridMap
          ref={map}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{ width: "100%", height: "auto", touchAction: "none" }}
        />

        {phase !== "begin" && (
          <button
            onClick={() => {
              setSound(!sound);
              setMuted(sound);
            }}
            aria-label={sound ? "Mute sound" : "Unmute sound"}
            className="absolute bottom-4 right-4 rounded-full bg-slate-900/80 px-4 py-2 text-xl text-white"
          >
            {sound ? "🔊" : "🔇"}
          </button>
        )}

        {phase === "watch" && (
          <p className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-slate-950/80 px-6 py-3 text-2xl text-amber-200">
            {COPY.watching}
          </p>
        )}

        {(phase === "play" || phase === "watch") && (
          <div className="absolute bottom-4 left-4 flex items-center gap-3">
            <ControlButton onClick={replay} disabled={phase !== "play"}>
              {COPY.replay}
            </ControlButton>
            <ControlButton onClick={showNext} disabled={phase !== "play"}>
              {COPY.nextStep}
            </ControlButton>
            <p className="rounded-full bg-slate-950/80 px-4 py-2 text-lg text-slate-200">
              {info.title}: {Math.min(progress + 1, steps.length)} of {steps.length}
            </p>
          </div>
        )}

        {phase === "begin" && (
          <button onClick={begin} className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/55 text-center text-white">
            <span className="text-7xl font-semibold">{COPY.beginTitle}</span>
            <span className="animate-pulse rounded-full bg-amber-400 px-12 py-4 text-3xl font-semibold text-slate-950">Begin</span>
            <span className="text-xl text-slate-300">{COPY.beginHint}</span>
          </button>
        )}

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

      {(phase === "watch" || phase === "play" || phase === "levelDone") && (
        <HelpAgent
          position="top-right"
          key={`${level}-${phase === "watch"}-${assist}`}
          tips={tips}
          alert={assist ? { text: assist, actions: [{ label: "Got it", onClick: () => setAssist("") }] } : null}
        />
      )}

      {idle.prompting && <AreYouStillThere secondsLeft={idle.secondsLeft} onStay={idle.stay} />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-slate-950/80 p-10 text-center text-white">{children}</div>;
}

function ControlButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-h-14 rounded-full bg-slate-800/90 px-6 text-lg font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
