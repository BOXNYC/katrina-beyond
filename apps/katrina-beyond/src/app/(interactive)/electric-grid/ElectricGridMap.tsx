"use client";

import { useEffect, useImperativeHandle, useRef, type Ref, type SVGProps } from "react";
import { createStormRadar, type StormRadar } from "./stormRadar";
import InstructionBox, { type InstructionBoxHandle } from "./InstructionBox";
import { FACILITY_BY_ID } from "@/lib/electricGridFacilities";
import LevelBox, { type LevelBoxHandle } from "./LevelBox";
import LevelMessage, { type LevelMessageHandle } from "./LevelMessage";

export type IconName = "firestation" | "police" | "hospital" | "water" | "power" | "shelter";

export type FacilityState = "hidden" | "ok" | "outage";
export type MapPoint = { x: number; y: number };

export type ElectricGridMapHandle = {
  /** Hides all zones and icons without transition. */
  reset: () => void;
  /** Shows zones by number (data-name "zone N"), optionally fading in with `delay` ms between each. */
  showZones: (zones: (number | string)[], transition?: boolean, delay?: number | null) => void;
  /** Hides all zones, instantly unless `transition` is true. */
  hideZones: (transition?: boolean) => void;
  /** Shows only the given icon types (hides all others first). */
  showIcons: (names: IconName | IconName[]) => void;
  /** Hides all icons. */
  hideIcons: () => void;
  /** Sets the fill of all zones, or only the given zone numbers. Any CSS color. */
  setZoneColor: (color: string, zones?: (number | string)[]) => void;
  /** Sets individual facilities (by data-fid, e.g. "power-3") to hidden, powered (ok) or greyed-out (outage). */
  setFacilities: (ids: string[], state: FacilityState, transition?: boolean) => void;
  /** Hides every facility icon. */
  hideFacilities: (transition?: boolean) => void;
  /** Plays a radar-blip pulse over the given facilities. */
  pulse: (ids: string[], color?: string) => void;
  /** Draws persistent rings on facilities. "hint" marks the expected one, "select" marks what a loop currently encloses. */
  setRings: (kind: "hint" | "select", ids: string[]) => void;
  /** Draws (or with null clears) the dashed gesture path. */
  setPath: (points: MapPoint[] | null) => void;
  /** Converts client (screen) coordinates to map units. */
  toMapPoint: (clientX: number, clientY: number) => MapPoint | null;
  /** Fades in a WebGL Doppler radar storm over the given zones (one cell per zone, sized to the zone). */
  showStorm: (zones: (number | string)[], durationMs?: number) => void;
  /** Fades the storm overlay out. */
  hideStorm: (fadeMs?: number) => void;
  /** Fades in the dotted exit-path routes (hidden by default). */
  showExitPaths: (transition?: boolean) => void;
  /** Hides the exit paths, instantly unless `transition` is true. */
  hideExitPaths: (transition?: boolean) => void;
  /** The level completion display laid over the map. */
  level: LevelBoxHandle;
  /** The instruction panel laid over the map. */
  instruction: InstructionBoxHandle;
  /** The message text under the level box. */
  message: LevelMessageHandle;
};

const FADE_MS = 500;

/**
 * Icons are hidden by default. A zone's rect is what dims the map, so a shown zone's rect is hidden.
 * Zone color comes from --zone-color (#1e00fc by default), or an inline fill on a single zone.
 * The exit-paths group is hidden by default too; see showExitPaths/hideExitPaths.
 */
const CSS = [
  ".electric-grid-map { display: block; touch-action: none; user-select: none; -webkit-user-select: none; }",
  ".electric-grid-map use { opacity: 0; }",
  ".electric-grid-map .exit-paths { opacity: 0; }",
  ".electric-grid-map .zones rect { fill: var(--zone-color, #1e00fc); }",
  ".electric-grid-map .pulse-ring { fill: none; stroke-width: 7; transform-box: fill-box; transform-origin: center; animation: eg-pulse 0.9s ease-out 2 forwards; }",
  ".electric-grid-map .static-ring { fill: none; stroke-width: 7; }",
  ".electric-grid-map .static-ring.hint { stroke: #fbbf24; animation: eg-throb 0.8s ease-in-out infinite alternate; }",
  ".electric-grid-map .static-ring.select { stroke: #67e8f9; }",
  "@keyframes eg-pulse { from { transform: scale(0.6); opacity: 1; } to { transform: scale(2.4); opacity: 0; } }",
  "@keyframes eg-throb { from { opacity: 0.4; } to { opacity: 1; } }",
].join(" ");

const SVG_NS = "http://www.w3.org/2000/svg";
const RING_R = 44;

/** Generated from map-v1.psd (visible layers only; zones blue, exit paths included). Group names become classNames. */
export default function ElectricGridMap({
  ref,
  className,
  onReplay,
  ...svgProps
}: Omit<SVGProps<SVGSVGElement>, "ref"> & { ref?: Ref<ElectricGridMapHandle>; onReplay?: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const timers = useRef<number[]>([]);
  const stormCanvas = useRef<HTMLCanvasElement>(null);
  const radar = useRef<StormRadar | null>(null);

  useEffect(() => () => radar.current?.destroy(), []);

  /** Created on first use so a remount never reuses a torn-down WebGL context. */
  const getRadar = () => {
    if (!radar.current && stormCanvas.current) radar.current = createStormRadar(stormCanvas.current);
    return radar.current;
  };
  const levelBox = useRef<LevelBoxHandle>(null);
  const instructionBox = useRef<InstructionBoxHandle>(null);
  const messageBox = useRef<LevelMessageHandle>(null);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const zoneEl = (zone: number | string) =>
    svg.current?.querySelector<SVGElement>(`.zones [data-name="zone ${zone}"]`);

  const allIcons = () => svg.current?.querySelectorAll<SVGElement>("use") ?? [];

  const hideZones = (transition = false) => {
    clearTimers();
    svg.current?.querySelectorAll<SVGElement>(".zones [data-name]").forEach((el) => {
      el.style.transition = transition ? `opacity ${FADE_MS}ms ease` : "none";
      el.style.removeProperty("opacity");
    });
  };

  const facilityEl = (id: string) => svg.current?.querySelector<SVGElement>(`use[data-fid="${id}"]`);
  const ringGroup = (cls: string) => svg.current?.querySelector<SVGGElement>(`.overlay .${cls}`);

  const addRing = (parent: Element, id: string, className: string, color?: string) => {
    const f = FACILITY_BY_ID[id];
    if (!f) return null;
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", String(f.x));
    ring.setAttribute("cy", String(f.y));
    ring.setAttribute("r", String(RING_R));
    ring.setAttribute("class", className);
    if (color) ring.setAttribute("stroke", color);
    parent.appendChild(ring);
    return ring;
  };

  const exitPaths = () => svg.current?.querySelector<SVGElement>(".exit-paths");
  const hideExitPaths = (transition = false) => {
    const el = exitPaths();
    if (!el) return;
    el.style.transition = transition ? `opacity ${FADE_MS}ms ease` : "none";
    el.style.removeProperty("opacity");
  };

  const hideIcons = () => {
    allIcons().forEach((el) => {
      el.style.transition = "none";
      el.style.removeProperty("opacity");
      el.style.removeProperty("filter");
    });
  };

  useImperativeHandle(ref, () => ({
    get level() {
      return levelBox.current!;
    },
    get instruction() {
      return instructionBox.current!;
    },
    get message() {
      return messageBox.current!;
    },
    reset() {
      hideZones();
      hideIcons();
      hideExitPaths();
      ringGroup("static-rings")?.replaceChildren();
      ringGroup("pulses")?.replaceChildren();
      ringGroup("path")?.querySelectorAll("path").forEach((p) => p.removeAttribute("d"));
      radar.current?.clear();
    },
    hideZones,
    hideIcons,
    hideExitPaths,
    showExitPaths(transition = true) {
      const el = exitPaths();
      if (!el) return;
      el.style.transition = transition ? `opacity ${FADE_MS}ms ease` : "none";
      el.style.opacity = "1";
    },
    setFacilities(ids, state, transition = true) {
      ids.forEach((id) => {
        const el = facilityEl(id);
        if (!el) return;
        el.style.transition = transition ? `opacity ${FADE_MS}ms ease` : "none";
        if (state === "hidden") {
          el.style.removeProperty("opacity");
          el.style.removeProperty("filter");
        } else {
          el.style.opacity = state === "ok" ? "1" : "0.7";
          if (state === "ok") el.style.removeProperty("filter");
          else el.style.filter = "url(#eg-grey)";
        }
      });
    },
    hideFacilities(transition = false) {
      svg.current?.querySelectorAll<SVGElement>("use[data-fid]").forEach((el) => {
        el.style.transition = transition ? `opacity ${FADE_MS}ms ease` : "none";
        el.style.removeProperty("opacity");
        el.style.removeProperty("filter");
      });
      ringGroup("static-rings")?.replaceChildren();
      ringGroup("pulses")?.replaceChildren();
      ringGroup("path")?.querySelectorAll("path").forEach((p) => p.removeAttribute("d"));
    },
    pulse(ids, color = "#fbbf24") {
      const group = ringGroup("pulses");
      if (!group) return;
      ids.forEach((id) => {
        const ring = addRing(group, id, "pulse-ring", color);
        ring?.addEventListener("animationend", () => ring.remove(), { once: true });
      });
    },
    setRings(kind, ids) {
      const group = ringGroup("static-rings");
      if (!group) return;
      group.querySelectorAll(`.${kind}`).forEach((el) => el.remove());
      ids.forEach((id) => addRing(group, id, `static-ring ${kind}`));
    },
    setPath(points) {
      const d = points && points.length > 1 ? `M${points.map((p) => `${Math.round(p.x)} ${Math.round(p.y)}`).join("L")}` : "";
      ringGroup("path")?.querySelectorAll("path").forEach((p) => (d ? p.setAttribute("d", d) : p.removeAttribute("d")));
    },
    toMapPoint(clientX, clientY) {
      const el = svg.current;
      const m = el?.getScreenCTM();
      if (!el || !m) return null;
      const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    },
    showStorm(zones, durationMs = 3000) {
      const boxes = zones.map((z) => zoneEl(z)).filter(Boolean).map((el) => (el as unknown as SVGGraphicsElement).getBBox());
      if (boxes.length) getRadar()?.show(boxes, durationMs);
    },
    hideStorm(fadeMs = 1000) {
      radar.current?.hide(fadeMs);
    },
    setZoneColor(color, zones) {
      if (!zones) return svg.current?.style.setProperty("--zone-color", color);
      zones.forEach((zone) => zoneEl(zone)?.style.setProperty("fill", color));
    },
    showZones(zones, transition = false, delay = null) {
      zones.forEach((zone, i) => {
        const reveal = () => {
          const el = zoneEl(zone);
          if (!el) return;
          el.style.transition = transition ? `opacity ${FADE_MS}ms ease` : "none";
          el.style.opacity = "0";
        };
        if (delay) timers.current.push(window.setTimeout(reveal, i * delay));
        else reveal();
      });
    },
    showIcons(names) {
      hideIcons();
      [names].flat().forEach((name) => {
        svg.current?.querySelectorAll<SVGElement>(`use[href="#icon-${name}"]`).forEach((el) => {
          el.style.transition = `opacity ${FADE_MS}ms ease`;
          el.style.opacity = "1";
        });
      });
    },
  }));

  return (
    <div style={{ position: "relative" }}>
      <style>{CSS}</style>
      <svg
        ref={svg}
        viewBox="0 0 2932 1648"
        xmlns="http://www.w3.org/2000/svg"
        className={["electric-grid-map", className].filter(Boolean).join(" ")}
        {...svgProps}
      >
        <defs>
        <filter id="eg-grey" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.55" />
            <feFuncG type="linear" slope="0.55" />
            <feFuncB type="linear" slope="0.55" />
          </feComponentTransfer>
        </filter>
        <image id="icon-water" href="/electric-grid/icon-water.png" width={76} height={76} />
        <image id="icon-power" href="/electric-grid/icon-power.png" width={77} height={77} />
        <image id="icon-hospital" href="/electric-grid/icon-hospital.png" width={71} height={70} />
        <image id="icon-shelter" href="/electric-grid/icon-shelter.png" width={65} height={81} />
        <image id="icon-firestation" href="/electric-grid/icon-firestation.png" width={64} height={80} />
        <image id="icon-police" href="/electric-grid/icon-police.png" width={71} height={77} />
        <mask id="zone-1-mask" maskUnits="userSpaceOnUse" x={806} y={767} width={398} height={408} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-1.png" x={806} y={767} width={398} height={408} />
        </mask>
        <mask id="zone-2-mask" maskUnits="userSpaceOnUse" x={753} y={537} width={281} height={430} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-2.png" x={753} y={537} width={281} height={430} />
        </mask>
        <mask id="zone-3-mask" maskUnits="userSpaceOnUse" x={1016} y={493} width={393} height={347} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-3.png" x={1016} y={493} width={393} height={347} />
        </mask>
        <mask id="zone-4-mask" maskUnits="userSpaceOnUse" x={1072} y={700} width={393} height={391} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-4.png" x={1072} y={700} width={393} height={391} />
        </mask>
        <mask id="zone-5-mask" maskUnits="userSpaceOnUse" x={1083} y={1019} width={124} height={130} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-5.png" x={1083} y={1019} width={124} height={130} />
        </mask>
        <mask id="zone-6-mask" maskUnits="userSpaceOnUse" x={1014} y={1084} width={163} height={148} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-6.png" x={1014} y={1084} width={163} height={148} />
        </mask>
        <mask id="zone-7-mask" maskUnits="userSpaceOnUse" x={895} y={1128} width={283} height={309} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-7.png" x={895} y={1128} width={283} height={309} />
        </mask>
        <mask id="zone-8-mask" maskUnits="userSpaceOnUse" x={669} y={941} width={269} height={503} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-8.png" x={669} y={941} width={269} height={503} />
        </mask>
        <mask id="zone-9-mask" maskUnits="userSpaceOnUse" x={0} y={504} width={778} height={832} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-9.png" x={0} y={504} width={778} height={832} />
        </mask>
        <mask id="zone-10-mask" maskUnits="userSpaceOnUse" x={1359} y={186} width={632} height={623} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-10.png" x={1359} y={186} width={632} height={623} />
        </mask>
        <mask id="zone-11-mask" maskUnits="userSpaceOnUse" x={1400} y={922} width={200} height={236} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-11.png" x={1400} y={922} width={200} height={236} />
        </mask>
        <mask id="zone-12-mask" maskUnits="userSpaceOnUse" x={1212} y={1103} width={610} height={545} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-12.png" x={1212} y={1103} width={610} height={545} />
        </mask>
        <mask id="zone-13-mask" maskUnits="userSpaceOnUse" x={1120} y={1229} width={373} height={419} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-13.png" x={1120} y={1229} width={373} height={419} />
        </mask>
        <mask id="zone-14-mask" maskUnits="userSpaceOnUse" x={1023} y={1407} width={236} height={241} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-14.png" x={1023} y={1407} width={236} height={241} />
        </mask>
        <mask id="zone-15-mask" maskUnits="userSpaceOnUse" x={671} y={1451} width={412} height={197} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-15.png" x={671} y={1451} width={412} height={197} />
        </mask>
        <mask id="zone-16-mask" maskUnits="userSpaceOnUse" x={115} y={1131} width={608} height={517} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-16.png" x={115} y={1131} width={608} height={517} />
        </mask>
        <mask id="zone-17-mask" maskUnits="userSpaceOnUse" x={1955} y={0} width={699} height={713} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-17.png" x={1955} y={0} width={699} height={713} />
        </mask>
        <mask id="zone-18-mask" maskUnits="userSpaceOnUse" x={1448} y={299} width={1484} height={667} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-18.png" x={1448} y={299} width={1484} height={667} />
        </mask>
        <mask id="zone-19-mask" maskUnits="userSpaceOnUse" x={1527} y={738} width={1405} height={910} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-19.png" x={1527} y={738} width={1405} height={910} />
        </mask>
        <mask id="zone-20-mask" maskUnits="userSpaceOnUse" x={1683} y={1382} width={514} height={266} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-20.png" x={1683} y={1382} width={514} height={266} />
        </mask>
        <mask id="zone-21-mask" maskUnits="userSpaceOnUse" x={1590} y={1507} width={497} height={141} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-21.png" x={1590} y={1507} width={497} height={141} />
        </mask>
        <mask id="zone-22-mask" maskUnits="userSpaceOnUse" x={0} y={1079} width={182} height={569} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-22.png" x={0} y={1079} width={182} height={569} />
        </mask>
        <mask id="zone-23-mask" maskUnits="userSpaceOnUse" x={0} y={442} width={107} height={503} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-23.png" x={0} y={442} width={107} height={503} />
        </mask>
        <mask id="zone-24-mask" maskUnits="userSpaceOnUse" x={2465} y={0} width={467} height={448} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-24.png" x={2465} y={0} width={467} height={448} />
        </mask>
        </defs>
        <g className="map-layers">
          <image href="/electric-grid/layer-33.png" x={0} y={0} width={2932} height={1648} data-name="Layer 33" />
          <image href="/electric-grid/4k-base-map-dark.png" x={0} y={0} width={2932} height={1648} data-name="4K BASE MAP dark" />
          <image href="/electric-grid/water.png" x={0} y={0} width={2932} height={1648} data-name="water" opacity={0.58} />
        </g>
        <g className="categories">
          <g className="zones" opacity={0.141}>
            <rect x={2465} y={0} width={467} height={448} mask="url(#zone-24-mask)" data-name="zone 24" />
            <rect x={0} y={442} width={107} height={503} mask="url(#zone-23-mask)" data-name="zone 23" />
            <rect x={0} y={1079} width={182} height={569} mask="url(#zone-22-mask)" data-name="zone 22" />
            <rect x={1590} y={1507} width={497} height={141} mask="url(#zone-21-mask)" data-name="zone 21" />
            <rect x={1683} y={1382} width={514} height={266} mask="url(#zone-20-mask)" data-name="zone 20" />
            <rect x={1527} y={738} width={1405} height={910} mask="url(#zone-19-mask)" data-name="zone 19" />
            <rect x={1448} y={299} width={1484} height={667} mask="url(#zone-18-mask)" data-name="zone 18" />
            <rect x={1955} y={0} width={699} height={713} mask="url(#zone-17-mask)" data-name="zone 17" />
            <rect x={115} y={1131} width={608} height={517} mask="url(#zone-16-mask)" data-name="zone 16" />
            <rect x={671} y={1451} width={412} height={197} mask="url(#zone-15-mask)" data-name="zone 15" />
            <rect x={1023} y={1407} width={236} height={241} mask="url(#zone-14-mask)" data-name="zone 14" />
            <rect x={1120} y={1229} width={373} height={419} mask="url(#zone-13-mask)" data-name="zone 13" />
            <rect x={1212} y={1103} width={610} height={545} mask="url(#zone-12-mask)" data-name="zone 12" />
            <rect x={1400} y={922} width={200} height={236} mask="url(#zone-11-mask)" data-name="zone 11" />
            <rect x={1359} y={186} width={632} height={623} mask="url(#zone-10-mask)" data-name="zone 10" />
            <rect x={0} y={504} width={778} height={832} mask="url(#zone-9-mask)" data-name="zone 9" />
            <rect x={669} y={941} width={269} height={503} mask="url(#zone-8-mask)" data-name="zone 8" />
            <rect x={895} y={1128} width={283} height={309} mask="url(#zone-7-mask)" data-name="zone 7" />
            <rect x={1014} y={1084} width={163} height={148} mask="url(#zone-6-mask)" data-name="zone 6" />
            <rect x={1083} y={1019} width={124} height={130} mask="url(#zone-5-mask)" data-name="zone 5" />
            <rect x={1072} y={700} width={393} height={391} mask="url(#zone-4-mask)" data-name="zone 4" />
            <rect x={1016} y={493} width={393} height={347} mask="url(#zone-3-mask)" data-name="zone 3" />
            <rect x={753} y={537} width={281} height={430} mask="url(#zone-2-mask)" data-name="zone 2" />
            <rect x={806} y={767} width={398} height={408} mask="url(#zone-1-mask)" data-name="zone 1" />
          </g>
          <image href="/electric-grid/boundary-lines.png" x={0} y={0} width={2932} height={1648} data-name="BOUNDARY LINES" />
          <g className="water-sewer-facilities">
            <g className="water-icons">
              <g className="exit-paths" fill="none" stroke="#0CA3D2" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0 20">
                <image href="/electric-grid/layer-45.png" x={719} y={447} width={37} height={54} data-name="Layer 45" />
                <image href="/electric-grid/layer-45-copy.png" x={826} y={420} width={41} height={55} data-name="Layer 45 copy" />
                <image href="/electric-grid/layer-45-copy-2.png" x={925} y={415} width={37} height={55} data-name="Layer 45 copy 2" />
                <image href="/electric-grid/layer-45-copy-5.png" x={600} y={463} width={37} height={54} data-name="Layer 45 copy 5" />
                <image href="/electric-grid/layer-45-copy-6.png" x={366} y={447} width={37} height={54} data-name="Layer 45 copy 6" />
                <image href="/electric-grid/layer-45-copy-7.png" x={216} y={387} width={45} height={54} data-name="Layer 45 copy 7" />
                <image href="/electric-grid/layer-45-copy-8.png" x={1342} y={1116} width={45} height={54} data-name="Layer 45 copy 8" />
                <image href="/electric-grid/layer-45-copy-9.png" x={648} y={1422} width={44} height={53} data-name="Layer 45 copy 9" />
                <image href="/electric-grid/layer-45-copy-3.png" x={1076} y={410} width={36} height={55} data-name="Layer 45 copy 3" />
                <image href="/electric-grid/layer-45-copy-4.png" x={1496} y={316} width={37} height={54} data-name="Layer 45 copy 4" />
                <path d="M312.0 1012.0C359.9 952.1 400.6 896.9 360.0 774.0C323.9 664.8 388.1 660.9 385.0 496.0" data-name="Shape 2" />
                <path d="M187.0 558.0C202.3 444.0 208.0 467.1 236.0 426.0" data-name="Shape 2 copy" />
                <path d="M618.0 633.0C616.9 597.0 619.0 534.1 619.0 485.0" data-name="Shape 2 copy 2" />
                <path d="M925.0 1137.0C911.8 1127.5 896.1 1102.3 863.0 1063.0C853.1 1051.3 805.2 978.8 742.0 964.0C711.1 956.8 736.8 893.0 739.0 856.0C742.4 798.3 753.4 736.3 756.0 680.0C757.6 645.0 761.6 638.1 762.0 598.0C762.7 537.7 734.0 479.7 729.0 469.0" data-name="Shape 2 copy 3" />
                <path d="M820.0 599.0C809.9 485.8 829.8 493.6 852.0 451.0" data-name="Shape 2 copy 4" />
                <path d="M1120.0 1167.0C1115.8 1033.5 1000.7 995.0 977.0 978.0C965.8 970.0 980.2 963.0 977.0 946.0C973.8 929.1 899.8 904.3 903.0 885.0C916.7 803.3 922.4 702.8 933.0 631.0C936.1 610.3 915.0 594.9 915.0 577.0C915.0 563.8 935.5 560.8 936.0 550.0C937.2 525.1 945.4 454.0 946.0 446.0" data-name="Shape 2 copy 5" />
                <path d="M1433.0 911.0C1394.2 904.0 1143.3 862.4 1132.0 860.0C1126.5 858.8 1122.9 689.4 1117.0 640.0C1114.6 620.2 1124.0 599.7 1121.0 585.0C1112.6 544.0 1059.7 537.5 1096.0 451.0" data-name="Shape 2 copy 6" />
                <path d="M1684.0 652.0C1632.9 638.6 1591.9 625.7 1565.0 599.0C1536.8 571.1 1509.9 532.1 1510.0 496.0C1510.1 447.4 1514.1 386.7 1515.0 363.0" data-name="Shape 2 copy 7" />
                <path d="M1465.0 1425.0C1426.2 1384.1 1339.8 1293.5 1292.0 1249.0C1290.5 1247.6 1330.9 1194.9 1366.0 1145.0" data-name="Shape 2 copy 9" />
                <path d="M1178.0 1424.0C1191.8 1405.8 1282.0 1268.1 1295.0 1249.0" data-name="Shape 2 copy 10" />
                <path d="M442.0 1550.0C474.4 1546.9 596.8 1549.5 613.0 1535.0C630.3 1519.5 652.6 1480.1 668.0 1459.0" data-name="Shape 2 copy 8" />
              </g>
              <g className="icons">
                <g className="nola-group">
                  <use href="#icon-water" x={860} y={1084} data-fid="water-1" data-name="water 1 copy" />
                  <use href="#icon-water" x={784} y={561} data-fid="water-2" data-name="water 1 copy 2" />
                  <use href="#icon-water" x={972} y={965} data-fid="water-3" data-name="water 1 copy 3" />
                  <use href="#icon-water" x={1095} y={819} data-fid="water-4" data-name="water 1 copy 4" />
                  <use href="#icon-water" x={1081} y={602} data-fid="water-5" data-name="water 1 copy 12" />
                  <use href="#icon-water" x={694} y={824} data-fid="water-6" data-name="water 1 copy 13" />
                  <use href="#icon-water" x={1386} y={870} data-fid="water-7" data-name="water 1 copy 5" />
                  <use href="#icon-water" x={1475} y={457} data-fid="water-8" data-name="water 1 copy 11" />
                </g>
                <g className="west-bank-group">
                  <use href="#icon-water" x={573} y={1498} data-fid="water-9" data-name="water 1 copy 17" />
                  <use href="#icon-water" x={402} y={1511} data-fid="water-10" data-name="water 1 copy 18" />
                </g>
                <g className="east-bank-group">
                  <use href="#icon-water" x={272} y={972} data-fid="water-11" data-name="water 1" />
                  <use href="#icon-water" x={580} y={585} data-fid="water-12" data-name="water 1 copy 14" />
                  <use href="#icon-water" x={339} y={572} data-fid="water-13" data-name="water 1 copy 15" />
                  <use href="#icon-water" x={149} y={514} data-fid="water-14" data-name="water 1 copy 16" />
                </g>
                <g className="extras-group">
                  <use href="#icon-water" x={1257} y={1209} data-fid="water-15" data-name="water 1 copy 8" />
                  <use href="#icon-water" x={1146} y={1378} data-fid="water-16" data-name="water 1 copy 7" />
                  <use href="#icon-water" x={1425} y={1377} data-fid="water-17" data-name="water 1 copy 9" />
                  <use href="#icon-water" x={1067} y={1146} data-fid="water-18" data-name="water 1 copy 6" />
                  <use href="#icon-water" x={1649} y={617} data-fid="water-19" data-name="water 1 copy 10" />
                </g>
              </g>
            </g>
          </g>
          <g className="power-plants-substations">
            <g className="power-icons">
              <use href="#icon-power" x={466} y={629} data-fid="power-1" data-name="power 1" />
              <use href="#icon-power" x={758} y={653} data-fid="power-2" data-name="power 1 copy" />
              <use href="#icon-power" x={553} y={1150} data-fid="power-3" data-name="power 1 copy 2" />
              <use href="#icon-power" x={637} y={1078} data-fid="power-4" data-name="power 1 copy 3" />
              <use href="#icon-power" x={632} y={970} data-fid="power-5" data-name="power 1 copy 4" />
              <use href="#icon-power" x={757} y={970} data-fid="power-6" data-name="power 1 copy 5" />
              <use href="#icon-power" x={967} y={1089} data-fid="power-7" data-name="power 1 copy 6" />
              <use href="#icon-power" x={1096} y={1260} data-fid="power-8" data-name="power 1 copy 7" />
              <use href="#icon-power" x={1125} y={1079} data-fid="power-9" data-name="power 1 copy 8" />
              <use href="#icon-power" x={1131} y={723} data-fid="power-10" data-name="power 1 copy 9" />
              <use href="#icon-power" x={1256} y={790} data-fid="power-11" data-name="power 1 copy 10" />
              <use href="#icon-power" x={1386} y={586} data-fid="power-12" data-name="power 1 copy 11" />
              <use href="#icon-power" x={1829} y={515} data-fid="power-13" data-name="power 1 copy 12" />
              <use href="#icon-power" x={1798} y={287} data-fid="power-14" data-name="power 1 copy 13" />
              <use href="#icon-power" x={1360} y={349} data-fid="power-15" data-name="power 1 copy 14" />
              <use href="#icon-power" x={2166} y={439} data-fid="power-16" data-name="power 1 copy 15" />
              <use href="#icon-power" x={2094} y={532} data-fid="power-17" data-name="power 1 copy 16" />
              <use href="#icon-power" x={2014} y={627} data-fid="power-18" data-name="power 1 copy 17" />
              <use href="#icon-power" x={1525} y={935} data-fid="power-19" data-name="power 1 copy 18" />
              <use href="#icon-power" x={1546} y={1136} data-fid="power-20" data-name="power 1 copy 19" />
              <use href="#icon-power" x={1667} y={1343} data-fid="power-21" data-name="power 1 copy 20" />
            </g>
          </g>
          <g className="hospitals">
            <g className="hospital-icons">
              <use href="#icon-hospital" x={369} y={664} data-fid="hospital-1" data-name="hospital 1" />
              <use href="#icon-hospital" x={-212} y={739} data-fid="hospital-2" data-name="hospital 1 copy" />
              <use href="#icon-hospital" x={305} y={753} data-fid="hospital-3" data-name="hospital 1 copy 2" />
              <use href="#icon-hospital" x={544} y={967} data-fid="hospital-4" data-name="hospital 1 copy 3" />
              <use href="#icon-hospital" x={910} y={843} data-fid="hospital-5" data-name="hospital 1 copy 4" />
              <use href="#icon-hospital" x={1047} y={1034} data-fid="hospital-6" data-name="hospital 1 copy 6" />
              <use href="#icon-hospital" x={886} y={1197} data-fid="hospital-7" data-name="hospital 1 copy 7" />
              <use href="#icon-hospital" x={705} y={1334} data-fid="hospital-8" data-name="hospital 1 copy 8" />
              <use href="#icon-hospital" x={932} y={1521} data-fid="hospital-9" data-name="hospital 1 copy 10" />
              <use href="#icon-hospital" x={1401} y={1500} data-fid="hospital-10" data-name="hospital 1 copy 11" />
              <use href="#icon-hospital" x={1639} y={1106} data-fid="hospital-11" data-name="hospital 1 copy 12" />
              <use href="#icon-hospital" x={1647} y={483} data-fid="hospital-12" data-name="hospital 1 copy 13" />
              <use href="#icon-hospital" x={1898} y={374} data-fid="hospital-13" data-name="hospital 1 copy 14" />
            </g>
          </g>
          <g className="shelters">
            <g className="shelter-icons">
              <use href="#icon-shelter" x={960} y={530} data-fid="shelter-1" data-name="shelter 1" />
              <use href="#icon-shelter" x={388} y={945} data-fid="shelter-2" data-name="shelter 1 copy 18" />
              <use href="#icon-shelter" x={301} y={1132} data-fid="shelter-3" data-name="shelter 1 copy 19" />
              <use href="#icon-shelter" x={926} y={743} data-fid="shelter-4" data-name="shelter 1 copy 20" />
              <use href="#icon-shelter" x={810} y={809} data-fid="shelter-5" data-name="shelter 1 copy 21" />
              <use href="#icon-shelter" x={894} y={999} data-fid="shelter-6" data-name="shelter 1 copy 22" />
              <use href="#icon-shelter" x={799} y={1177} data-fid="shelter-7" data-name="shelter 1 copy 23" />
              <use href="#icon-shelter" x={1014} y={775} data-fid="shelter-8" data-name="shelter 1 copy 24" />
              <use href="#icon-shelter" x={1221} y={949} data-fid="shelter-9" data-name="shelter 1 copy 26" />
              <use href="#icon-shelter" x={923} y={1321} data-fid="shelter-10" data-name="shelter 1 copy 28" />
              <use href="#icon-shelter" x={1378} y={1152} data-fid="shelter-11" data-name="shelter 1 copy 29" />
              <use href="#icon-shelter" x={1699} y={1031} data-fid="shelter-12" data-name="shelter 1 copy 30" />
              <use href="#icon-shelter" x={1726} y={546} data-fid="shelter-13" data-name="shelter 1 copy 34" />
              <use href="#icon-shelter" x={1220} y={1451} data-fid="shelter-14" data-name="shelter 1 copy 31" />
              <use href="#icon-shelter" x={1063} y={1493} data-fid="shelter-15" data-name="shelter 1 copy 32" />
              <use href="#icon-shelter" x={1284} y={1531} data-fid="shelter-16" data-name="shelter 1 copy 33" />
            </g>
          </g>
          <g className="fire-stations">
            <g className="fire-icons">
              <use href="#icon-firestation" x={-224} y={431} data-fid="fire-1" data-name="firestation 1" />
              <use href="#icon-firestation" x={-572} y={1087} data-fid="fire-2" data-name="firestation 2" />
              <use href="#icon-firestation" x={-79} y={1127} data-fid="fire-3" data-name="firestation 3" />
              <use href="#icon-firestation" x={354} y={1038} data-fid="fire-4" data-name="firestation 4" />
              <use href="#icon-firestation" x={893} y={584} data-fid="fire-5" data-name="firestation 5" />
              <use href="#icon-firestation" x={849} y={701} data-fid="fire-6" data-name="firestation 6" />
              <use href="#icon-firestation" x={1898} y={261} data-fid="fire-7" data-name="firestation 7" />
              <use href="#icon-firestation" x={1744} y={443} data-fid="fire-8" data-name="firestation 8" />
              <use href="#icon-firestation" x={767} y={1065} data-fid="fire-9" data-name="firestation 9" />
              <use href="#icon-firestation" x={856} y={921} data-fid="fire-10" data-name="firestation 10" />
              <use href="#icon-firestation" x={1202} y={844} data-fid="fire-11" data-name="firestation 11" />
              <use href="#icon-firestation" x={1083} y={898} data-fid="fire-12" data-name="firestation 13" />
              <use href="#icon-firestation" x={805} y={1291} data-fid="fire-13" data-name="firestation 16" />
              <use href="#icon-firestation" x={1011} y={1294} data-fid="fire-14" data-name="firestation 17" />
              <use href="#icon-firestation" x={1214} y={1077} data-fid="fire-15" data-name="firestation 18" />
              <use href="#icon-firestation" x={1329} y={954} data-fid="fire-16" data-name="firestation 19" />
              <use href="#icon-firestation" x={1448} y={978} data-fid="fire-17" data-name="firestation 20" />
              <use href="#icon-firestation" x={1617} y={994} data-fid="fire-18" data-name="firestation 21" />
              <use href="#icon-firestation" x={1477} y={1209} data-fid="fire-19" data-name="firestation 22" />
              <use href="#icon-firestation" x={1330} y={1408} data-fid="fire-20" data-name="firestation 24" />
            </g>
          </g>
          <g className="police-stations">
            <g className="police-icons">
              <use href="#icon-police" x={219} y={1139} data-fid="police-1" data-name="police 1" />
              <use href="#icon-police" x={183} y={950} data-fid="police-2" data-name="police 2" />
              <use href="#icon-police" x={-215} y={645} data-fid="police-3" data-name="police 3" />
              <use href="#icon-police" x={574} y={694} data-fid="police-4" data-name="police 4" />
              <use href="#icon-police" x={1034} y={682} data-fid="police-5" data-name="police 5" />
              <use href="#icon-police" x={1004} y={874} data-fid="police-6" data-name="police 7" />
              <use href="#icon-police" x={1133} y={983} data-fid="police-7" data-name="police 8" />
              <use href="#icon-police" x={986} y={1196} data-fid="police-8" data-name="police 9" />
              <use href="#icon-police" x={1247} y={1343} data-fid="police-9" data-name="police 11" />
              <use href="#icon-police" x={1389} y={1247} data-fid="police-10" data-name="police 12" />
              <use href="#icon-police" x={1536} y={1383} data-fid="police-11" data-name="police 13" />
              <use href="#icon-police" x={1346} y={789} data-fid="police-12" data-name="police 15" />
              <use href="#icon-police" x={1808} y={608} data-fid="police-13" data-name="police 16" />
              <use href="#icon-police" x={707} y={1204} data-fid="police-14" data-name="police 16" />
              <use href="#icon-police" x={548} y={1400} data-fid="police-15" data-name="police 17" />
            </g>
          </g>
        </g>
        <g className="overlay" pointerEvents="none">
          <g className="static-rings" />
          <g className="pulses" />
          <g className="path">
            <path fill="none" stroke="#000" strokeOpacity={0.55} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            <path fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 18" />
          </g>
        </g>
      </svg>
      <canvas
        ref={stormCanvas}
        width={1466}
        height={824}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />
      <LevelBox ref={levelBox} />
      <LevelMessage ref={messageBox} />
      <InstructionBox ref={instructionBox} onReplay={onReplay} />
    </div>
  );
}
