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
  /** Makes every level icon greyscale (incomplete) without transition. */
  reset: () => void;
  /** Shows the given levels in color. */
  completeLevels: (levels: LevelRef | LevelRef[], transition?: boolean) => void;
  /** Greys out the given levels, or all of them if none are given. */
  incompleteLevels: (levels?: LevelRef | LevelRef[], transition?: boolean) => void;
};

const FADE_MS = 500;

/** Incomplete levels are greyscale; a completed icon overrides the filter inline. */
const CSS = ".level-completion-box image[data-level] { filter: grayscale(1); }";

/** Generated from ui-10-29-26.psd (visible layers only). Group names become classNames. */
export default function LevelBox({
  ref,
  style,
  className,
  ...svgProps
}: Omit<SVGProps<SVGSVGElement>, "ref"> & { ref?: Ref<LevelBoxHandle> }) {
  const svg = useRef<SVGSVGElement>(null);

  const icon = (level: LevelRef) =>
    svg.current?.querySelector<SVGElement>(`[data-level="${typeof level === "number" ? LEVELS[level - 1] : level}"]`);

  const setComplete = (el: SVGElement | null | undefined, complete: boolean, transition: boolean) => {
    if (!el) return;
    el.style.transition = transition ? `filter ${FADE_MS}ms ease` : "none";
    if (complete) el.style.filter = "none";
    else el.style.removeProperty("filter");
  };

  useImperativeHandle(ref, () => ({
    reset() {
      svg.current?.querySelectorAll<SVGElement>("[data-level]").forEach((el) => setComplete(el, false, false));
    },
    completeLevels(levels, transition = true) {
      [levels].flat().forEach((level) => setComplete(icon(level), true, transition));
    },
    incompleteLevels(levels, transition = true) {
      if (!levels) return svg.current?.querySelectorAll<SVGElement>("[data-level]").forEach((el) => setComplete(el, false, transition));
      [levels].flat().forEach((level) => setComplete(icon(level), false, transition));
    },
  }));

  return (
    <>
      <style>{CSS}</style>
      <svg
        ref={svg}
        viewBox="90 69 691 117"
        xmlns="http://www.w3.org/2000/svg"
        className={["level-completion-box", className].filter(Boolean).join(" ")}
        style={{ position: "absolute", left: "3.0685%", top: "4.1818%", width: "23.5595%", height: "7.0909%", pointerEvents: "none", ...style }}
        {...svgProps}
      >
        <image href="/electric-grid/ui/rectangle-3.png" x={90} y={69} width={691} height={117} data-name="Rectangle 3" />
        <image href="/electric-grid/ui/firehouse-original-art-copy.png" x={683} y={83} width={64} height={80} data-name="firehouse original art" data-level="firehouse" />
        <image href="/electric-grid/ui/police-original-art-copy.png" x={590} y={89} width={71} height={77} data-name="police original art" data-level="police" />
        <image href="/electric-grid/ui/shelter-original-art-copy.png" x={506} y={83} width={65} height={81} data-name="shelter original art" data-level="shelter" />
        <image href="/electric-grid/ui/hospital-original-art-copy.png" x={414} y={89} width={71} height={70} data-name="hospital original art" data-level="hospital" />
        <image href="/electric-grid/ui/water-original-art.png" x={315} y={85} width={76} height={76} data-name="water original art" data-level="water" />
        <image href="/electric-grid/ui/transmission-lines.png" x={216} y={85} width={80} height={80} data-name="transmission lines" data-level="transmission-lines" />
        <image href="/electric-grid/ui/power-original-art-copy-5.png" x={119} y={86} width={77} height={77} data-name="power original art" data-level="power" />
      </svg>
    </>
  );
}
