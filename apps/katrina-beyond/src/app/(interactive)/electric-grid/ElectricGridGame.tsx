"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FACILITIES, FACILITY_BY_ID, type Facility } from "@/lib/electricGridFacilities";
import { buzz, finalJingle, levelJingle, playStorm, popTick, preloadStorm, simonChime, stopStorm, tone, unlockAudio, zoneTick } from "@/lib/electricGridSound";
import {
  COPY,
  LEVEL_INFO,
  STORMS,
  pointInPolygon,
  stormZones,
  transmissionChains,
  visibleFacilityIds,
  type LevelNumber,
  type Storm,
} from "@/lib/electricGridStorms";
import AreYouStillThere from "../AreYouStillThere";
import { useIdlePrompt } from "../useIdlePrompt";
import StormPicker from "./StormPicker";
import ElectricGridMap, { type ElectricGridMapHandle, type MapPoint } from "./ElectricGridMap";

type Phase = "begin" | "choose" | "intro" | "briefing" | "watch" | "play" | "levelDone" | "outro";

/** How close (map units) a touch must land to a facility to count as on it. */
const HIT_RADIUS = 64;
const RESTORED_COLOR = "#4ade80";
/** Simon-style colors for the sequence, by step (blue, green, red, yellow, repeating); each has its own chime (simonChime, same index). */
const SIMON_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#facc15"];
const simonColor = (step: number) => SIMON_COLORS[step % SIMON_COLORS.length];
/**
 * The level whose completion reveals the water exit paths. Assumption: "on the 3rd level the water exits
 * is displayed" means shown as that level's completion reward. Only flows whose water icons are all on the map
 * (in this storm's zones) are drawn, so no flow starts from an icon the player can't see. To show them for the whole of level 3 while
 * playing instead, call showExitPaths in startLevel(EXIT_PATHS_LEVEL) and drop it from finishLevel.
 */
const EXIT_PATHS_LEVEL: LevelNumber = 3;
/** The level whose completion lights the transmission lines of the other stations (see transmissionChains). */
const TRANSMISSION_LEVEL: LevelNumber = 2;
/** Matches TRANSMISSION_STAGGER_MS in ElectricGridMap.tsx. */
const TRANSMISSION_STAGGER_MS = 450;
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
/** Outro final reveal: every icon grows on in random order over OUTRO_GROW_MS while the final jingle (~6 s) plays; the water flows show as its closing chord lands, and the throbbing then settles for OUTRO_SETTLE_MS before the card. */
const OUTRO_GROW_MS = 3500;
const OUTRO_JINGLE_MS = 5000; // where the jingle's closing chord falls
const OUTRO_SETTLE_MS = 3500;
/** Pre-storm intro beats: the establishing shot (zones, labels and level-1 icons) before the storm, the storm, then the message. */
const INTRO_ESTABLISH_MS = 3500;
const INTRO_STORM_MS = 5000;
const INTRO_POP_MS = 300; // gap between zones popping off
const INTRO_MESSAGE_MS = 5000;
/** How long the transmission-line payoff (level 2) plays, so its chains (TRANSMISSION_STAGGER_MS apart) can be seen. */
const TRANSMISSION_DONE_MS = 4500;

/** Level 2 guide path: how long it takes to draw through the stations, and how long it holds before fading off. */
const GUIDE_DRAW_MS = 2600;
const GUIDE_HOLD_MS = 700;
const GUIDE_FADE_MS = 900; // matches GUIDE_FADE_MS in ElectricGridMap.tsx

/** Fade to black after the game is done, then back in to the begin page; and the final card waits this long for a tap before fading by itself. */
const FADE_MS = 1500;
const OUTRO_CARD_MS = 20_000;
/** Begin page quiet time before the storm screensaver starts (a minute after returning from a finished game), how long each storm shows, and the pause before the next. */
const BEGIN_IDLE_MS = 45_000;
const BEGIN_IDLE_AFTER_DONE_MS = 60_000;
const SAVER_FADE_MS = 2500;
const SAVER_HOLD_MS = 12_000;
const SAVER_PAUSE_MS = 4000;

/** Level intro beats: spotlight fade, the slow glide between its two targets, and pauses after each typed panel so it can be read. */
const SPOT_FADE_MS = 1200; // matches the spotlight opacity transition
const SPOT_MOVE_MS = 3600; // matches the spotlight left/top/width transition when it moves while on
const READ_PAUSE_MS = 700;

/** Spotlight targets: a circle centered on the level message / instruction panel (cx, cy in % of the map), diameter in % of the map width. Much larger than the target so the text never clips. */
const SPOTLIGHTS = {
  message: { cx: 13.2, cy: 18.2, d: 56 },
  instruction: { cx: 87.9, cy: 78, d: 50 },
} as const;
type Spot = keyof typeof SPOTLIGHTS;

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
  const [aftermath, setAftermath] = useState(false); // the centered "up to you" message after the storm
  const [fading, setFading] = useState(false); // black overlay: fading out after the game, and back in on the begin page
  const beginIdleMs = useRef(BEGIN_IDLE_MS);
  // Spotlight: the box keeps its last target while it fades out (`on` false). `jump` places it at its new target unseen (it was off), instead of gliding there.
  const [spotState, setSpotState] = useState<{ target: Spot; on: boolean; jump: boolean }>({ target: "message", on: false, jump: true });
  const setSpot = (target: Spot | null) => setSpotState((p) => ({ target: target ?? p.target, on: target !== null, jump: !p.on }));

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
    setSpot(null);
    setCard(false);
    setAftermath(false);
    setFading(false);
    beginIdleMs.current = BEGIN_IDLE_MS;
    go("begin");
  };

  /** After the game: fades to black, then back in to the begin page (whose idle wait is then a minute). */
  const finish = async () => {
    if (live.current.phase !== "outro") return;
    const token = run.current;
    setFading(true);
    if (!(await wait(FADE_MS, token))) return;
    reset();
    beginIdleMs.current = BEGIN_IDLE_AFTER_DONE_MS;
  };

  // The final card fades out on its own if nobody taps Exit.
  useEffect(() => {
    if (phase !== "outro" || !card) return;
    const t = window.setTimeout(() => void finish(), OUTRO_CARD_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, card]);

  // Begin page screensaver: after a quiet spell a random storm's Doppler radar plays over the map, one after another, until someone touches the screen.
  useEffect(() => {
    if (phase !== "begin") return;
    const m = map.current;
    let timer: number | undefined;
    let showing = false;
    const play = () => {
      const zones = stormZones(STORMS[Math.floor(Math.random() * STORMS.length)]);
      showing = true;
      m?.showStorm(zones, SAVER_FADE_MS);
      timer = window.setTimeout(() => {
        m?.hideStorm(SAVER_FADE_MS);
        showing = false;
        timer = window.setTimeout(play, SAVER_FADE_MS + SAVER_PAUSE_MS);
      }, SAVER_FADE_MS + SAVER_HOLD_MS);
    };
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(play, beginIdleMs.current);
    };
    const activity = () => {
      if (showing) m?.hideStorm(600);
      showing = false;
      arm();
    };
    const events = ["pointerdown", "pointermove", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, activity, { passive: true }));
    arm();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, activity));
      if (showing) m?.hideStorm(600);
    };
  }, [phase]);

  // Only watch for inactivity during real play (levels), not the begin/choose screens, the intro / storm / outro animations (those are long and hands-off) or the final card (that fades out by itself). The timer restarts each time it becomes active.
  const idleActive = phase === "briefing" || phase === "watch" || phase === "play" || phase === "levelDone";
  const idle = useIdlePrompt({ active: idleActive, timeoutMs: idleTimeoutMs, countdownMs: idleCountdownMs, onReset: reset });

  /**
   * Pulses each remaining outage step in order, in its Simon color with that color's chime. When `lose` is set the
   * facilities also go grey. The connect level instead draws a path through the remaining stations in order, which then fades off.
   */
  const playOutages = async (n: LevelNumber, token: number, lose: boolean) => {
    const steps = live.current.storm.levels[n];
    const from = lose ? 0 : live.current.progress;
    if (LEVEL_INFO[n].interaction === "connect" && steps.length - from > 1) {
      const ids = steps.slice(from).map((st) => st.facilityIds[0]);
      map.current?.showGuidePath(ids, GUIDE_DRAW_MS, GUIDE_HOLD_MS, (i) => {
        map.current?.pulse([ids[i]], simonColor(from + i));
        simonChime(from + i);
      });
      return wait(GUIDE_DRAW_MS + GUIDE_HOLD_MS + GUIDE_FADE_MS + 400, token);
    }
    for (let i = from; i < steps.length; i++) {
      const ids = steps[i].facilityIds;
      map.current?.pulse(ids, simonColor(i));
      simonChime(i);
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
    go("briefing");
    map.current?.hideExitPaths(true);
    map.current?.level.completeLevels(info.slots);
    map.current?.level.setProgress(info.slots.length / 7);
    map.current?.instruction.hideInstruction(false); // shown fresh at step 2
    map.current?.instruction.hideReplay(false);
    // Only this level's icons stay on the map, shown through the briefing. The icons that lost power are already out (level 1 keeps them from the intro).
    if (n > 1) {
      map.current?.hideFacilities(true);
      map.current?.setFacilities(ids, "ok", true);
      // The connect level keeps its stations powered: power was just restored, so it isn't shown off again (a guide path shows the order instead).
      if (LEVEL_INFO[n].interaction !== "connect") map.current?.setFacilities(l.storm.levels[n].flatMap((st) => st.facilityIds), "outage", true);
    }
    // 1. The level description types out under a spotlight.
    setSpot("message");
    if (!(await wait(SPOT_FADE_MS, token))) return;
    await map.current?.message.setMessage(info.message);
    if (!(await wait(READ_PAUSE_MS, token))) return;
    // 2. The spotlight moves to the instructions, which appear and type out.
    setSpot("instruction");
    if (!(await wait(SPOT_MOVE_MS, token))) return;
    await map.current?.instruction.showInstruction(info.instruction);
    if (!(await wait(READ_PAUSE_MS, token))) return;
    // 3. The spotlight lifts and the icon sequence plays.
    setSpot(null);
    if (!(await wait(SPOT_FADE_MS, token))) return;
    go("watch");
    map.current?.instruction.showReplay();
    if (!(await wait(1600, token))) return;
    if (!(await playOutages(n, token, false))) return; // the out icons stay out; the order just blips (or, for connect, a path is drawn), as with replay
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
    map.current?.hideZonesOutward(zones, OUTRO_ZONE_MS, zoneTick); // 2. zones off, center out, counter-clockwise
    if (!(await wait(zones.length * OUTRO_ZONE_MS + 1000, token))) return;
    const all = FACILITIES.map((f) => f.id); // 3. every icon grows back on in random order, then the water flows, all throbbing
    map.current?.growFacilities(all, OUTRO_GROW_MS, popTick);
    finalJingle();
    if (!(await wait(OUTRO_JINGLE_MS - 1500, token))) return;
    map.current?.showExitPaths(true);
    if (!(await wait(1500, token))) return;
    map.current?.throb(all, 3);
    if (!(await wait(OUTRO_SETTLE_MS, token))) return;
    setCard(true);
  };

  const finishLevel = async () => {
    const token = run.current;
    go("levelDone");
    const n = live.current.level;
    levelJingle();
    map.current?.instruction.hideInstruction(); // hidden for the payoff; the next level shows it fresh
    map.current?.instruction.hideReplay();
    map.current?.level.pulse(LEVEL_INFO[n].slots);
    // Payoff: every restored icon throbs; the water level also shows the flows between its (visible) icons.
    map.current?.throb([...live.current.restored]);
    const revealPaths = n === EXIT_PATHS_LEVEL;
    if (revealPaths) map.current?.showExitPaths(true, visibleFacilityIds(live.current.storm, n));
    // Level 2 also lights the transmission lines: the player's own chain first, then separate chains for the other stations.
    const lines = n === TRANSMISSION_LEVEL;
    if (lines) {
      const mine = live.current.storm.levels[n].map((st) => st.facilityIds[0]);
      const chains = [mine, ...transmissionChains(live.current.storm)];
      map.current?.showTransmission(chains);
      chains.forEach((_, i) => window.setTimeout(() => run.current === token && tone(330 + i * 110, 300, "triangle"), i * TRANSMISSION_STAGGER_MS));
    }
    if (!(await wait(revealPaths ? EXIT_PATHS_DONE_MS : lines ? TRANSMISSION_DONE_MS : LEVEL_DONE_MS, token))) return;
    if (lines) map.current?.dimTransmission(); // stays under the icons for the rest of the game
    if (n < 5) await startLevel((n + 1) as LevelNumber, token);
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
    setSpot(null);
    go("intro");
    setCard(true);
    playStorm();
    if (!(await wait(3600, token))) return;
    setCard(false);
    // 0. Establishing shot: the affected zones (still blue), every zone name label, and every power station inside the affected zones, all on.
    const zones = stormZones(next);
    const power = visibleFacilityIds(next, 1); // the power stations inside the affected zones
    map.current?.showZoneLabels();
    map.current?.setFacilities(power, "ok", true);
    if (!(await wait(INTRO_ESTABLISH_MS, token))) return;
    // 1. The storm rolls in. 2. The affected power stations go out one by one as it passes over them.
    map.current?.showStorm(zones, INTRO_STORM_MS);
    const out = next.levels[1].flatMap((st) => st.facilityIds); // the ones that lose power, in outage order
    out.forEach((id, i) => {
      window.setTimeout(() => {
        if (run.current !== token) return;
        map.current?.setFacilities([id], "outage", true);
        tone(200 + (i % 5) * 40, 160, "triangle");
      }, INTRO_STORM_MS * 0.25 + (INTRO_STORM_MS * 0.6 * i) / Math.max(1, out.length));
    });
    if (!(await wait(INTRO_STORM_MS, token))) return;
    // 3. The message shows, centered, over the storm. 4. Then the storm goes away and the labels and zones clear.
    setAftermath(true);
    if (!(await wait(INTRO_MESSAGE_MS, token))) return;
    setAftermath(false);
    map.current?.hideZoneLabels(true);
    map.current?.hideStorm(1200);
    map.current?.popOffZones(zones, INTRO_POP_MS, zoneTick);
    // 5. Level 1 begins right away, with no wait; the zones keep popping off behind its first highlight.
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

  /** A wrong move: the buzz, then the next correct move is ringed in its Simon color. */
  const wrong = () => {
    buzz();
    map.current?.setRings("hint", expectedIds(), simonColor(live.current.progress));
  };

  const afterSubmit = () => {
    const l = live.current;
    if (l.progress >= l.storm.levels[l.level].length) void finishLevel();
  };

  const submitTap = (id: string) => {
    if (expectedIds()[0] === id) restoreStep();
    else return wrong();
    afterSubmit();
  };

  const submitChain = (chain: string[]) => {
    const l = live.current;
    const remaining = l.storm.levels[l.level].slice(l.progress).map((st) => st.facilityIds[0]);
    let k = 0;
    while (k < chain.length && chain[k] === remaining[k]) k++;
    for (let i = 0; i < k; i++) restoreStep(i);
    if (k < chain.length) return wrong();
    afterSubmit();
  };

  const submitGroup = (ids: string[]) => {
    if (!ids.length) return;
    if (ids.length > 4) return wrong();
    const want = expectedIds();
    if (ids.length === want.length && want.every((id) => ids.includes(id))) restoreStep();
    else return wrong();
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

  return (
    <div
      className="relative flex min-h-screen select-none items-center justify-center bg-black"
      onPointerDown={() => unlockAudio()}
    >
      <div className="relative overflow-hidden" style={{ width: "min(100vw,calc(100vh * 2932 / 1648))" }}>
        <ElectricGridMap
          ref={map}
          onReplay={replay}
          onQuit={reset}
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

        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-[opacity,left,top,width] ease-in-out motion-reduce:transition-none ${
            spotState.jump ? "[transition-duration:1200ms,0ms,0ms,0ms]" : "[transition-duration:1200ms,3600ms,3600ms,3600ms]"
          }`}
          style={{
            left: `${SPOTLIGHTS[spotState.target].cx}%`,
            top: `${SPOTLIGHTS[spotState.target].cy}%`,
            width: `${SPOTLIGHTS[spotState.target].d}%`,
            aspectRatio: "1",
            opacity: spotState.on ? 1 : 0,
            boxShadow: "0 0 0 100vmax rgba(2,6,23,0.65)",
          }}
        />

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

        {phase === "intro" && aftermath && (
          <p className="pointer-events-none absolute left-1/2 top-1/2 w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-slate-950/80 px-12 py-8 text-center text-4xl leading-snug text-white">
            {COPY.stormAftermath}
          </p>
        )}

        {phase === "outro" && card && (
          <Card>
            <h2 className="text-6xl font-semibold text-green-400">{COPY.outroTitle}</h2>
            <p className="max-w-2xl text-2xl text-slate-200">{COPY.outroBody}</p>
            <button onClick={() => void finish()} className="h-16 rounded-full bg-amber-400 px-12 text-2xl font-semibold text-slate-950 hover:bg-amber-300">
              {COPY.exit}
            </button>
          </Card>
        )}

        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-black transition-opacity duration-[1500ms] ease-in-out motion-reduce:transition-none ${fading ? "opacity-100" : "pointer-events-none opacity-0"}`}
        />
      </div>

      {idle.prompting && <AreYouStillThere secondsLeft={idle.secondsLeft} onStay={idle.stay} />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-slate-950/80 p-10 text-center text-white">{children}</div>;
}
