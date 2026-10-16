"use client";

import { useEffect, useState } from "react";
import electricGrid, {
  DEFAULT_VARIANT,
  explainMistake,
  hoursLabel,
  stepHours,
  stepLabel,
  randomVariant,
  stepsFor,
  toneFor,
  type Variant,
} from "@/lib/electricGrid";
import { buzz, cheer, setMuted, tone, unlockAudio } from "@/lib/electricGridSound";
import HelpAgent from "../HelpAgent";

const { kinds, areas, edges, feeds, ties, tieCurve, rounds, demo } = electricGrid;
const CUE = "#fbbf24";
const areaIds = Object.keys(areas);
const lastRound = rounds[rounds.length - 1];

type Phase = "demo" | "intro" | "outage" | "watch" | "play" | "roundDone" | "final";

type State = {
  phase: Phase;
  round: number;
  /** Bumps whenever a pattern (re)starts so timers reset. */
  attempt: number;
  /** Index of the cue lit while the pattern plays. */
  cue: number;
  /** Steps repeated correctly so far. */
  progress: number;
  /** Times the Help Agent stepped in or the player asked for help. */
  helps: number;
  /** Message from the agent after a wrong tap. */
  assist: string;
  /** Show the next correct step on the map. */
  hint: boolean;
  /** Hours of restoration work completed this session. */
  hours: number;
  restoredAreas: number;
  customers: number;
  demoDone: number;
  /** Direction of this round's zig-zag, chosen at random. */
  variant: Variant;
  demoVariant: Variant;
};

const initial: State = {
  phase: "demo",
  round: 0,
  attempt: 0,
  cue: -1,
  progress: 0,
  helps: 0,
  assist: "",
  hint: false,
  hours: 0,
  restoredAreas: 0,
  customers: 0,
  demoDone: 0,
  variant: DEFAULT_VARIANT,
  demoVariant: DEFAULT_VARIANT,
};

export default function ElectricGridKiosk() {
  const [s, setS] = useState<State>(initial);
  const [touches, setTouches] = useState(0);
  const [sound, setSound] = useState(true);

  const set = (patch: Partial<State>) => setS((p) => ({ ...p, ...patch }));
  const round = rounds[s.round];
  const steps = stepsFor(round, s.variant);
  const demoSteps = stepsFor(lastRound, s.demoVariant);
  const expected = steps[s.progress];

  // Back to the light-show demo after inactivity.
  useEffect(() => {
    if (s.phase === "demo") return;
    const t = setTimeout(() => setS(initial), electricGrid.idleTimeoutMs);
    return () => clearTimeout(t);
  }, [s.phase, s.progress, touches]);

  // Demo: the whole grid relights in order, faster and faster, then loops.
  useEffect(() => {
    if (s.phase !== "demo") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = demo.pauseMs / 2;
    stepsFor(lastRound, s.demoVariant).forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setS((p) => ({ ...p, demoDone: i + 1 }));
        }, at),
      );
      at += demo.stepMs;
    });
    timers.push(setTimeout(() => setS((p) => ({ ...p, demoDone: 0, demoVariant: randomVariant(), attempt: p.attempt + 1 })), at + demo.pauseMs));
    return () => timers.forEach(clearTimeout);
  }, [s.phase, s.attempt, s.demoVariant]);

  // Outage: the storm hits. Areas dim one by one, in pattern order, then go red.
  useEffect(() => {
    if (s.phase !== "outage") return;
    const seq = stepsFor(rounds[s.round], s.variant);
    const stepMs = Math.max(250, rounds[s.round].showMs * 0.6);
    const timers: ReturnType<typeof setTimeout>[] = [];
    seq.forEach((step, i) => {
      timers.push(
        setTimeout(() => {
          setS((p) => ({ ...p, cue: i }));
          tone(toneFor(step.target) / 2, 140, "triangle");
        }, 600 + i * stepMs),
      );
    });
    timers.push(
      setTimeout(
        () => setS((p) => ({ ...p, phase: "watch", cue: -1 })),
        600 + seq.length * stepMs + 500,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [s.phase, s.round, s.attempt, s.variant]);

  // Watch: play the pattern, then hand over to the player.
  useEffect(() => {
    if (s.phase !== "watch") return;
    const seq = stepsFor(rounds[s.round], s.variant);
    const { showMs } = rounds[s.round];
    const timers: ReturnType<typeof setTimeout>[] = [];
    seq.forEach((step, i) => {
      const start = 700 + i * (showMs + 250);
      timers.push(
        setTimeout(() => {
          setS((p) => ({ ...p, cue: i }));
          tone(toneFor(step.target), showMs * 0.8);
        }, start),
        setTimeout(() => setS((p) => ({ ...p, cue: -1 })), start + showMs),
      );
    });
    timers.push(
      setTimeout(
        () => setS((p) => ({ ...p, phase: "play" })),
        700 + seq.length * (showMs + 250),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [s.phase, s.round, s.attempt, s.variant]);

  const begin = () => {
    unlockAudio();
    setS({ ...initial, phase: "intro", variant: randomVariant(), demoVariant: randomVariant() });
  };

  const startWatch = (extra: Partial<State> = {}) =>
    setS((p) => ({ ...p, phase: "watch", attempt: p.attempt + 1, cue: -1, assist: "", hint: false, ...extra }));

  const startOutage = () =>
    setS((p) => ({ ...p, phase: "outage", attempt: p.attempt + 1, cue: -1, assist: "", hint: false }));

  const poweredNow = () =>
    new Set([
      ...areaIds.filter((id) => !round.outage.includes(id)),
      ...steps.slice(0, s.progress).filter((st) => !st.isTie).map((st) => st.target),
    ]);

  const pickTarget = (target: string, isTie: boolean) => {
    if (s.phase !== "play") return;
    if (isTie ? restoredTies.has(target) : isLit(target)) return; // already back on
    if (target === expected.target) {
      const progress = s.progress + 1;
      tone(toneFor(target), 250);
      const done = progress === steps.length;
      if (done) cheer();
      setS((p) => ({
        ...p,
        progress,
        assist: "",
        hint: false,
        hours: p.hours + stepHours(expected),
        restoredAreas: p.restoredAreas + (isTie ? 0 : 1),
        customers: p.customers + (isTie ? 0 : areas[target].customers),
        phase: done ? "roundDone" : "play",
      }));
    } else {
      // Help, then let the player finish the round. Nothing restarts.
      buzz();
      setS((p) => ({
        ...p,
        helps: p.helps + 1,
        hint: true,
        assist: explainMistake(expected, { target, isTie }, poweredNow(), round.pattern),
      }));
    }
  };

  const nextRound = () => {
    if (s.round + 1 >= rounds.length) set({ phase: "final" });
    else setS((p) => ({ ...p, round: p.round + 1, variant: randomVariant(), phase: "intro", attempt: p.attempt + 1, progress: 0, assist: "", hint: false }));
  };

  const inDemo = s.phase === "demo";
  const demoTies = new Set(demoSteps.slice(0, s.demoDone).filter((st) => st.isTie).map((st) => st.target));
  const doneSteps = steps.slice(0, s.phase === "roundDone" ? steps.length : s.progress);
  // Before each round the grid is lit; the storm then dims areas in pattern
  // order, and only afterwards do the dark areas turn red.
  const dimmed = new Set(s.phase === "outage" ? steps.slice(0, s.cue + 1).map((st) => st.target) : []);
  const outage = inDemo
    ? areaIds
    : s.phase === "intro"
      ? []
      : s.phase === "outage"
        ? round.outage.filter((id) => dimmed.has(id))
        : round.outage;
  const showRed = s.phase !== "outage";
  const restored = new Set((inDemo ? demoSteps.slice(0, s.demoDone) : doneSteps).filter((st) => !st.isTie).map((st) => st.target));
  const restoredTies = inDemo ? demoTies : new Set(doneSteps.filter((st) => st.isTie).map((st) => st.target));
  const cueStep = s.phase === "watch" && s.cue >= 0 ? steps[s.cue] : null;
  const hintStep = s.phase === "play" && s.hint ? expected : null;
  const out = outage.filter((id) => !restored.has(id));
  const online = areaIds.length - out.length;
  const customersOut = out.reduce((n, id) => n + areas[id].customers, 0);
  const isLit = (id: string) => !outage.includes(id) || restored.has(id);

  const tips =
    s.phase === "outage"
      ? ["The storm is knocking out power. Notice the order, because that's the pattern you'll repeat."]
      : s.phase === "watch"
      ? ["Watch the order the places light up. Listen for the notes too.", "Say the names in your head, or work with a friend."]
      : s.phase === "play"
        ? [
            "Tap the places in the same order they lit up.",
            ...(round.pattern === "priority"
              ? ["Hospitals and city services light up first, then neighborhoods."]
              : []),
            "Power spreads from neighbor to neighbor, so a place can't come back before the one next to it.",
            "Stuck? Press Replay pattern or Show next step. It's okay to ask.",
          ]
        : s.phase === "intro"
          ? ["Watch the pattern first. Then tap the same places in the same order.", "You can replay the pattern any time."]
          : ["Great work! Each round is bigger, just like a real storm."];

  return (
    <div
      className="flex min-h-screen flex-1 select-none flex-col bg-slate-950 p-6 pb-28 text-white"
      onPointerDown={() => {
        setTouches((n) => n + 1);
        unlockAudio();
      }}
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-amber-300">Electricity: Grid Distribution</h1>
          <p className="text-slate-400">Bring the lights back, one area at a time.</p>
        </div>
        <button
          onClick={() => {
            setSound(!sound);
            setMuted(sound);
          }}
          aria-label={sound ? "Mute sound" : "Unmute sound"}
          className="rounded-full bg-slate-800 px-4 py-2 text-xl"
        >
          {sound ? "🔊" : "🔇"}
        </button>
      </header>

      <div className="flex flex-1 gap-6">
        <div className="relative flex-1 rounded-2xl bg-slate-900 p-2">
          <svg viewBox="0 0 1000 540" className="h-full w-full" role="img" aria-label="Map of city areas and power lines">
            {edges.map(([a, b]) => {
              const live = isLit(a) && isLit(b);
              return (
                <line
                  key={a + b}
                  x1={areas[a].x} y1={areas[a].y} x2={areas[b].x} y2={areas[b].y}
                  stroke={live ? (inDemo ? "#67e8f9" : "#0e7490") : "#334155"}
                  strokeWidth={live && inDemo ? 6 : 4}
                />
              );
            })}
            {Object.entries(feeds).map(([id, f]) => (
              <g key={id}>
                {f.to.map((t) => (
                  <line key={t} x1={f.x} y1={f.y} x2={areas[t].x} y2={areas[t].y} stroke={isLit(t) ? "#0e7490" : "#334155"} strokeWidth="4" strokeDasharray="8 6" />
                ))}
                <circle cx={f.x} cy={f.y} r="26" fill="#0f172a" stroke="#22c55e" strokeWidth="5" />
                <text x={f.x} y={f.y + 10} textAnchor="middle" fontSize="26">⚡</text>
                <text x={f.x} y={f.y + 52} textAnchor="middle" fontSize="14" fill="#cbd5e1">{f.label}</text>
              </g>
            ))}

            {Object.entries(ties).map(([id, t]) => {
              const tieOut = inDemo
                ? demoSteps.some((st) => st.target === id)
                : s.phase === "intro"
                  ? false
                  : s.phase === "outage"
                    ? dimmed.has(id)
                    : !!round.ties?.includes(id);
              const cut = tieOut && !restoredTies.has(id);
              const cur = tieCurve[id];
              const a = areas[t.a];
              const b = areas[t.b];
              const d = `M${a.x} ${a.y} Q${cur.cx} ${cur.cy} ${b.x} ${b.y}`;
              const isCue = cueStep?.target === id || hintStep?.target === id;
              const color = isCue ? CUE : cut ? (showRed ? "#ef4444" : "#475569") : "#0e7490";
              return (
                <g key={id} onClick={() => pickTarget(id, true)} style={{ cursor: s.phase === "play" && cut ? "pointer" : "default" }}>
                  <path d={d} fill="none" stroke={color} strokeWidth={isCue ? 8 : 4} strokeDasharray={cut ? "10 8" : undefined} className={isCue ? "animate-pulse" : ""} />
                  <path d={d} fill="none" stroke="transparent" strokeWidth="32" />
                  {isCue && (
                    <text x={(a.x + 2 * cur.cx + b.x) / 4} y={(a.y + 2 * cur.cy + b.y) / 4 - 10} textAnchor="middle" fontSize="26" fill={color}>
                      ⚡
                    </text>
                  )}
                </g>
              );
            })}

            {areaIds.map((id) => {
              const a = areas[id];
              const k = kinds[a.kind];
              const isOut = !isLit(id);
              const cue = cueStep?.target === id;
              const hint = hintStep?.target === id;
              const color = CUE;
              const fill = cue ? color : isOut ? "#1e293b" : restored.has(id) ? "#16a34a" : "#0e7490";
              return (
                <g key={id} onClick={() => pickTarget(id, false)} style={{ cursor: s.phase === "play" && isOut ? "pointer" : "default" }}>
                  {((isOut && showRed) || cue || hint) && (
                    <circle cx={a.x} cy={a.y} r={cue || hint ? 56 : 48} fill="none" stroke={cue ? color : hint ? "#fff" : "#ef4444"} strokeWidth={cue || hint ? 6 : 3} className={cue ? "" : "animate-pulse"} />
                  )}
                  <circle cx={a.x} cy={a.y} r="42" fill={fill} stroke="#0f172a" strokeWidth="4" />
                  <text x={a.x} y={a.y + 12} textAnchor="middle" fontSize="36">{k.icon}</text>
                  <text x={a.x} y={a.y + 70} textAnchor="middle" fontSize="18" fill="#cbd5e1">{a.label}</text>
                </g>
              );
            })}
          </svg>

          {inDemo && (
            <button onClick={begin} className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-950/50 p-10 text-center">
              <span className="text-5xl font-semibold">Restore the Grid</span>
              <span className="animate-pulse text-2xl text-amber-300">Touch to begin</span>
            </button>
          )}

          {s.phase === "intro" && (
            <Overlay>
              <h2 className="text-4xl font-semibold text-amber-300">{round.title}</h2>
              <p className="max-w-xl text-xl text-slate-200">{round.storm}</p>
              <p className="max-w-xl text-lg text-slate-400">
                Watch the places light up, in order. Then tap the same places in the same order.
              </p>
              <Action onClick={startOutage}>Start</Action>
            </Overlay>
          )}

          {s.phase === "roundDone" && (
            <Overlay>
              <h2 className="text-4xl font-semibold text-green-400">Power restored!</h2>
              <p className="text-xl text-slate-200">Everything in this round is back online.</p>
              <p className="text-lg text-slate-400">
                In real life this would take about {hoursLabel(steps.reduce((n, st) => n + stepHours(st), 0))} of work.
              </p>
              <Action onClick={nextRound}>{s.round + 1 >= rounds.length ? "Finish" : "Next storm"}</Action>
            </Overlay>
          )}

          {s.phase === "final" && (
            <Overlay>
              <h2 className="text-4xl font-semibold text-amber-300">The city is back online!</h2>
              <p className="text-xl text-slate-200">
                You restored {s.restoredAreas} areas and about {s.customers.toLocaleString()} customers,
                roughly {hoursLabel(s.hours)} of crew work.
              </p>
              <ul className="max-w-xl space-y-1 text-left text-lg text-slate-300">
                {electricGrid.takeaways.map((t) => (
                  <li key={t}>• {t}</li>
                ))}
              </ul>
              <div className="flex gap-4">
                <Action onClick={begin}>Play again</Action>
                <Action secondary onClick={() => setS(initial)}>Done</Action>
              </div>
            </Overlay>
          )}
        </div>

        <aside className="w-64 shrink-0 rounded-2xl bg-slate-900 p-5">
          <h2 className="mb-4 text-sm uppercase tracking-widest text-slate-400">
            {s.phase === "intro" || s.phase === "outage" || s.phase === "watch" || s.phase === "play" || s.phase === "roundDone" ? round.title.split(":")[0] : "System status"}
          </h2>
          <Stat label="Areas online" value={`${online} / ${areaIds.length}`} />
          <Stat label="Customers without power" value={customersOut.toLocaleString()} />
          {!inDemo && <Stat label="Restoration clock" value={hoursLabel(s.hours)} />}
          {s.phase === "play" && (
            <div className="mt-2 space-y-3">
              <Small onClick={() => startWatch({ helps: s.helps })}>Replay pattern</Small>
              <Small
                onClick={() => {
                  set({ hint: true, helps: s.helps + 1, assist: `The next one is ${stepLabel(expected)}.` });
                }}
              >
                Show next step
              </Small>
              <p className="text-sm text-slate-400">
                Step {s.progress + 1} of {steps.length}
              </p>
            </div>
          )}
          {s.phase === "outage" && <p className="mt-4 text-lg text-amber-200">The storm hits…</p>}
          {s.phase === "watch" && <p className="mt-4 text-lg text-amber-200">Watch the pattern…</p>}
        </aside>
      </div>

      {!inDemo && s.phase !== "final" && (
        <HelpAgent
          key={`${s.phase}-${s.round}-${s.assist}`}
          tips={tips}
          alert={
            s.assist
              ? {
                  text: s.assist,
                  actions: [{ label: "Got it", onClick: () => set({ assist: "", hint: s.hint }) }],
                }
              : null
          }
        />
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-2xl bg-slate-950/90 p-8 text-center">
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Small({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="min-h-12 w-full rounded-lg bg-slate-800 px-4 text-base font-medium hover:bg-slate-700">
      {children}
    </button>
  );
}

function Action({ children, onClick, secondary }: { children: React.ReactNode; onClick: () => void; secondary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`h-16 rounded-full px-10 text-xl font-semibold transition-colors ${
        secondary ? "bg-slate-800 hover:bg-slate-700" : "bg-amber-400 text-slate-950 hover:bg-amber-300"
      }`}
    >
      {children}
    </button>
  );
}
