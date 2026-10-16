"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import barrierIsland, {
  effectiveSurgeFt,
  marshCompromised,
  neutralLevels,
  outcomeFor,
  type Level,
  type ModifierId,
} from "@/lib/barrierIsland";
import {
  initialKioskState,
  useKioskSync,
  type KioskState,
} from "@/lib/barrierIslandSync";
import HelpAgent from "../HelpAgent";
import CrossSection from "./CrossSection";
import LevelSlider from "./LevelSlider";

const { severities, modifiers, levelLabels } = barrierIsland;

const tips = {
  idle: [],
  storm: [
    "Storm surge is water pushed onto land by a storm. It is the most dangerous part of a hurricane.",
    "A bigger storm pushes more water. Next you will choose the defenses that slow it down.",
  ],
  configure: [
    "Try one slider at a time and watch the picture change.",
    "Marsh is the hero. Its grass soaks up water and slows the surge.",
    "Marsh needs a barrier island. Without the island, waves wash the marsh away.",
    "No single wall can stop a big storm. Natural and built defenses work best together.",
    "Press Simulate when you are ready to see what the surge does.",
  ],
  simulating: [
    "Watch the water on the model. See how fast it rises, and where it slows down.",
    "More layers of protection slow the water, which gives people more time.",
  ],
  result: [
    "Look at the cars on the road. Roads flood before elevated homes do.",
    "Elevated homes are not a reason to stay. When officials say evacuate, go.",
    "Try again with different defenses and compare.",
  ],
} as const;

export default function BarrierIslandKiosk() {
  const [state, setState] = useState<KioskState>(() =>
    initialKioskState(severities[0].id),
  );
  const visit = useRef(0);
  useKioskSync("controller", state);

  const { phase, severityId, levels } = state;
  const severity = severities.find((s) => s.id === severityId) ?? severities[0];

  const reset = useCallback(
    () =>
      setState((s) => ({
        phase: "idle",
        severityId: s.severityId,
        levels: neutralLevels(),
      })),
    [],
  );

  // Return to the calm loop after inactivity (not mid-simulation).
  const [touches, setTouches] = useState(0);
  useEffect(() => {
    if (phase === "idle" || phase === "simulating") return;
    const t = setTimeout(reset, barrierIsland.idleTimeoutMs);
    return () => clearTimeout(t);
  }, [phase, touches, reset]);

  // Move on to the result once the water simulation has run.
  useEffect(() => {
    if (phase !== "simulating") return;
    const t = setTimeout(
      () => setState((s) => ({ ...s, phase: "result" })),
      barrierIsland.simulationMs,
    );
    return () => clearTimeout(t);
  }, [phase]);

  const wake = () => {
    const next = severities[visit.current++ % severities.length];
    setState({ phase: "storm", severityId: next.id, levels: neutralLevels() });
  };

  const setLevel = (id: ModifierId, level: Level) =>
    setState((s) => ({ ...s, levels: { ...s.levels, [id]: level } }));

  const ft = effectiveSurgeFt(severityId, levels);
  const outcome = outcomeFor(ft);

  return (
    <div
      className="flex min-h-screen flex-1 select-none flex-col bg-slate-950 p-8 pb-28 text-white"
      onPointerDown={() => setTouches((n) => n + 1)}
    >
      {phase === "idle" && (
        <button
          onClick={wake}
          className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
        >
          <span className="text-6xl font-semibold">Barrier Island</span>
          <span className="animate-pulse text-2xl text-sky-300">
            Touch to begin
          </span>
        </button>
      )}

      {phase === "storm" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <p className="text-xl uppercase tracking-widest text-sky-300">
            Storm warning
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight">
            A {severity.label} is approaching.
          </h1>
          <p className="text-2xl text-slate-300">
            Expected storm surge: {severity.surgeFt} ft · {severity.wind}
          </p>
          <p className="max-w-2xl text-xl text-slate-300">
            Choose how to protect the island, then simulate the storm.
          </p>
          <PrimaryButton
            onClick={() => setState((s) => ({ ...s, phase: "configure" }))}
          >
            Prepare the island
          </PrimaryButton>
        </div>
      )}

      {(phase === "configure" || phase === "simulating") && (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
          <h1 className="text-3xl font-semibold">
            {severity.label} · {severity.surgeFt} ft surge
          </h1>
          <CrossSection levels={levels} />
          <ul className="flex flex-col gap-3">
            {modifiers.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-6 rounded-xl bg-slate-900 p-4"
              >
                <div>
                  <h2 className="text-xl font-medium">
                    {m.hero && <span aria-hidden>⭐ </span>}
                    {m.label}
                  </h2>
                  <p className="text-slate-400">{m.description}</p>
                  {m.id === "marsh" && marshCompromised(levels) && (
                    <p className="mt-1 text-amber-300">{barrierIsland.marshNote}</p>
                  )}
                </div>
                <LevelSlider
                  label={m.label}
                  value={levels[m.id]}
                  labels={levelLabels}
                  disabled={phase === "simulating"}
                  onChange={(l) => setLevel(m.id, l)}
                />
              </li>
            ))}
          </ul>
          <div className="flex justify-center">
            {phase === "configure" ? (
              <PrimaryButton
                onClick={() => setState((s) => ({ ...s, phase: "simulating" }))}
              >
                Simulate
              </PrimaryButton>
            ) : (
              <p className="animate-pulse text-2xl text-sky-300">
                Storm surge arriving — watch the model…
              </p>
            )}
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <h1 className="text-5xl font-semibold">{outcome.title}</h1>
          <p className="max-w-2xl text-2xl text-slate-300">{outcome.text}</p>
          <p className="text-xl text-sky-300">
            {severity.surgeFt} ft of surge → {ft.toFixed(1)} ft reached the community
          </p>
          <div className="flex gap-4">
            <PrimaryButton
              onClick={() => setState((s) => ({ ...s, phase: "configure" }))}
            >
              Try different defenses
            </PrimaryButton>
            <button
              onClick={reset}
              className="h-16 rounded-full bg-slate-800 px-10 text-xl hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
      {phase !== "idle" && (
        <HelpAgent key={phase} tips={[...tips[phase]]} />
      )}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-16 rounded-full bg-sky-500 px-12 text-xl font-semibold text-slate-950 transition-colors hover:bg-sky-400"
    >
      {children}
    </button>
  );
}
