"use client";

import { useEffect, useRef } from "react";
import { stormZones, type Storm } from "@/lib/electricGridStorms";

/**
 * Modal shown after "Begin": the player picks which storm to play. Covers the map area of its
 * (relatively positioned) parent. Escape and the Back button return to the begin card.
 */
export default function StormPicker({ storms, onPick, onBack }: { storms: Storm[]; onPick: (index: number) => void; onBack?: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>("button")?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onBack?.();
      return;
    }
    if (e.key !== "Tab") return;
    // Keep focus inside the dialog.
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>("button") ?? []);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="storm-picker-title"
      onKeyDown={onKeyDown}
      className="storm-picker-fade absolute inset-0 flex flex-col items-center justify-center gap-8 bg-black/75 p-10 text-center text-white"
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <style>{`
        @keyframes storm-picker-fade { from { opacity: 0 } to { opacity: 1 } }
        .storm-picker-fade { animation: storm-picker-fade 300ms ease-out both }
        @media (prefers-reduced-motion: reduce) { .storm-picker-fade { animation: none } }
      `}</style>
      <h2 id="storm-picker-title" className="text-6xl font-semibold">
        Choose a storm
      </h2>
      <ul className="flex w-full max-w-4xl flex-col gap-4">
        {storms.map((storm, i) => {
          const zones = stormZones(storm).length;
          return (
            <li key={storm.name}>
              <button
                type="button"
                onClick={() => onPick(i)}
                className="flex min-h-24 w-full items-center justify-between gap-6 rounded-[30px] bg-black/75 px-10 py-4 text-left text-white ring-2 ring-white/30 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 active:bg-white/25"
              >
                <span className="flex flex-col">
                  <span className="text-4xl font-semibold">{storm.name}</span>
                  <span className="text-2xl text-slate-300">{storm.severity}</span>
                </span>
                <span className="shrink-0 text-2xl text-slate-300">
                  {zones} {zones === 1 ? "area" : "areas"} hit
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="h-20 rounded-full bg-black/75 px-14 text-3xl font-semibold text-white ring-2 ring-white/30 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 active:bg-white/25"
        >
          Back
        </button>
      )}
    </div>
  );
}
