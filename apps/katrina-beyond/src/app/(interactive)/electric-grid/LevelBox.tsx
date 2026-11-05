"use client";

import { useImperativeHandle, useRef, type Ref, type SVGProps } from "react";

export type LevelName =
  | "power"
  | "transmission-lines"
  | "water"
  | "hospital"
  | "shelter"
  | "police"
  | "firehouse";

/** Level order, left to right as laid out in the PSD. A level can also be given as its 1-based position. */
export const LEVELS: LevelName[] = ["power", "transmission-lines", "water", "hospital", "shelter", "police", "firehouse"];

type LevelRef = LevelName | number;

export type LevelBoxHandle = {
  /** Greys out every level icon, empties the progress bar and cancels pulses, all without transition. */
  reset: () => void;
  /** Shows the given levels in color. Does not change the progress bar. */
  completeLevels: (levels: LevelRef | LevelRef[], transition?: boolean) => void;
  /** Greys out the given levels, or all of them if none are given. */
  incompleteLevels: (levels?: LevelRef | LevelRef[], transition?: boolean) => void;
  /** Fills the progress bar (0 to 1). */
  setProgress: (fraction: number, transition?: boolean) => void;
  /** Pulses the given level icons in place. Restarts if they are already pulsing. */
  pulse: (levels: LevelRef | LevelRef[]) => void;
};

const FADE_MS = 500;
const PROGRESS_MS = 700;
/** Progress bar span in PSD pixels (x 73 to the right edge of the last icon). The PSD shows it at 2/7 (173px). */
const BAR_WIDTH = 626;

/**
 * Incomplete levels are dimmed greyscale (matches the PSD Hue/Saturation -100 / lightness -63 layers); a completed icon
 * overrides the filter inline. Pulses scale the icon around its own center.
 */
const CSS = `
.level-completion-box image[data-level] { filter: grayscale(1) brightness(0.42); transform-box: fill-box; transform-origin: center; }
.level-completion-box image[data-level].level-pulse { animation: level-box-pulse 900ms ease-in-out; }
@keyframes level-box-pulse { 0%, 50%, 100% { transform: scale(1); } 25%, 75% { transform: scale(1.25); } }
`;

/** Generated from map-v1.psd (visible layers only, "level completion box" group). Group names become classNames. */
export default function LevelBox({
  ref,
  style,
  className,
  ...svgProps
}: Omit<SVGProps<SVGSVGElement>, "ref"> & { ref?: Ref<LevelBoxHandle> }) {
  const svg = useRef<SVGSVGElement>(null);
  const bar = useRef<SVGRectElement>(null);

  const icons = (levels: LevelRef | LevelRef[]) =>
    [levels]
      .flat()
      .map((level) =>
        svg.current?.querySelector<SVGElement>(`[data-level="${typeof level === "number" ? LEVELS[level - 1] : level}"]`),
      )
      .filter((el): el is SVGElement => !!el);

  const allIcons = () => [...(svg.current?.querySelectorAll<SVGElement>("[data-level]") ?? [])];

  const setComplete = (el: SVGElement, complete: boolean, transition: boolean) => {
    el.style.transition = transition ? `filter ${FADE_MS}ms ease` : "none";
    if (complete) el.style.filter = "none";
    else el.style.removeProperty("filter");
  };

  const setProgress = (fraction: number, transition: boolean) => {
    if (!bar.current) return;
    bar.current.style.transition = transition ? `width ${PROGRESS_MS}ms ease` : "none";
    bar.current.style.width = `${BAR_WIDTH * Math.min(1, Math.max(0, fraction || 0))}px`;
  };

  useImperativeHandle(ref, () => ({
    reset() {
      allIcons().forEach((el) => {
        setComplete(el, false, false);
        el.classList.remove("level-pulse");
      });
      setProgress(0, false);
    },
    completeLevels(levels, transition = true) {
      icons(levels).forEach((el) => setComplete(el, true, transition));
    },
    incompleteLevels(levels, transition = true) {
      (levels === undefined ? allIcons() : icons(levels)).forEach((el) => setComplete(el, false, transition));
    },
    setProgress: (fraction, transition = true) => setProgress(fraction, transition),
    pulse(levels) {
      icons(levels).forEach((el) => {
        el.classList.remove("level-pulse");
        void el.getBoundingClientRect(); // restart the animation
        el.classList.add("level-pulse");
        el.addEventListener("animationend", () => el.classList.remove("level-pulse"), { once: true });
      });
    },
  }));

  return (
    <>
      <style>{CSS}</style>
      <svg
        ref={svg}
        viewBox="44 60 688 163"
        xmlns="http://www.w3.org/2000/svg"
        className={["level-completion-box", className].filter(Boolean).join(" ")}
        style={{ position: "absolute", left: "1.5007%", top: "3.6408%", width: "23.4652%", height: "9.8908%", pointerEvents: "none", ...style }}
        {...svgProps}
      >
        <rect className="container" x={46} y={61} width={684} height={160} rx={30} fill="#000" fillOpacity={0.749} data-name="Container" />
        <rect className="progress-track" x={73} y={185} width={BAR_WIDTH} height={10} rx={5} fill="#fff" fillOpacity={0.18} data-name="Progress Track" />
        <rect ref={bar} className="progress-bar" x={73} y={185} width={0} height={10} rx={5} fill="#fff" data-name="Progress Bar" />
        <image href="/electric-grid/ui/power-original-art.png" x={71} y={87} width={77} height={77} data-name="power original art" data-level="power" />
        <image href="/electric-grid/ui/transmission-lines.png" x={168} y={87} width={80} height={80} data-name="transmission lines" data-level="transmission-lines" />
        <image href="/electric-grid/ui/water-original-art.png" x={267} y={86} width={76} height={76} data-name="water original art" data-level="water" />
        <image href="/electric-grid/ui/hospital-original-art.png" x={366} y={90} width={71} height={70} data-name="hospital original art" data-level="hospital" />
        <image href="/electric-grid/ui/shelter-original-art.png" x={458} y={84} width={65} height={81} data-name="shelter original art" data-level="shelter" />
        <image href="/electric-grid/ui/police-original-art.png" x={542} y={90} width={71} height={77} data-name="police original art" data-level="police" />
        <image href="/electric-grid/ui/firehouse-original-art.png" x={635} y={84} width={64} height={80} data-name="firehouse original art" data-level="firehouse" />
      </svg>
    </>
  );
}
