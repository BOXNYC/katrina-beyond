"use client";

import { useImperativeHandle, useRef, type Ref, type SVGProps } from "react";
import InstructionBox, { type InstructionBoxHandle } from "./InstructionBox";
import { FACILITY_BY_ID } from "@/lib/electricGridFacilities";
import LevelBox, { type LevelBoxHandle } from "./LevelBox";

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
  /** Sweeps a translucent storm overlay in from the left, covering the given zones. */
  showStorm: (zones: (number | string)[], durationMs?: number) => void;
  /** Fades the storm overlay out. */
  hideStorm: (fadeMs?: number) => void;
  /** The level completion display laid over the map. */
  level: LevelBoxHandle;
  /** The instruction panel laid over the map. */
  instruction: InstructionBoxHandle;
};

const FADE_MS = 500;

/** Doppler reflectivity bands, outermost to core (light rain -> heavy rain -> hail). */
const RADAR_BANDS = [
  { color: "#4ade80", opacity: 0.4, scale: 1 },
  { color: "#16a34a", opacity: 0.55, scale: 0.8 },
  { color: "#facc15", opacity: 0.6, scale: 0.58 },
  { color: "#f97316", opacity: 0.65, scale: 0.4 },
  { color: "#dc2626", opacity: 0.7, scale: 0.24 },
  { color: "#d946ef", opacity: 0.75, scale: 0.1 },
];

/** Fills `storm` with one weather-service style radar cell per zone box, each the size of its zone with soft, feathered edges. */
function buildRadar(storm: SVGElement, boxes: DOMRect[]) {
  let seed = Math.round(boxes.reduce((n, b) => n + b.x * 31 + b.y * 17 + b.width * 7 + b.height, 0)) % 2147483647 || 1;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  storm.replaceChildren();
  const sweep = document.createElementNS(SVG_NS, "g");
  sweep.setAttribute("class", "storm-sweep");
  const body = document.createElementNS(SVG_NS, "g");
  body.setAttribute("filter", "url(#eg-radar)");
  boxes.forEach((b) => {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const rx = b.width / 2;
    const ry = b.height / 2;
    const intensity = 0.55 + rand() * 0.45; // how many bands this cell reaches
    RADAR_BANDS.forEach((band, i) => {
      if (i / RADAR_BANDS.length > intensity) return;
      const e = document.createElementNS(SVG_NS, "ellipse");
      e.setAttribute("cx", String(cx + (rand() - 0.5) * rx * 0.3 * i));
      e.setAttribute("cy", String(cy + (rand() - 0.5) * ry * 0.3 * i));
      e.setAttribute("rx", String(rx * band.scale));
      e.setAttribute("ry", String(ry * band.scale));
      e.setAttribute("fill", band.color);
      e.setAttribute("fill-opacity", String(band.opacity));
      body.appendChild(e);
    });
  });
  sweep.appendChild(body);
  storm.appendChild(sweep);
}

/**
 * Icons are hidden by default. A zone's rect is what dims the map, so a shown zone's rect is hidden.
 * Zone color comes from --zone-color (black by default), or an inline fill on a single zone.
 */
const CSS = [
  ".electric-grid-map { display: block; touch-action: none; user-select: none; -webkit-user-select: none; }",
  ".electric-grid-map use { opacity: 0; }",
  ".electric-grid-map .zones rect { fill: var(--zone-color, #010d4b); }",
  ".electric-grid-map .storm { opacity: 0; }",
  ".electric-grid-map .pulse-ring { fill: none; stroke-width: 7; transform-box: fill-box; transform-origin: center; animation: eg-pulse 0.9s ease-out 2 forwards; }",
  ".electric-grid-map .static-ring { fill: none; stroke-width: 7; }",
  ".electric-grid-map .static-ring.hint { stroke: #fbbf24; animation: eg-throb 0.8s ease-in-out infinite alternate; }",
  ".electric-grid-map .static-ring.select { stroke: #67e8f9; }",
  "@keyframes eg-pulse { from { transform: scale(0.6); opacity: 1; } to { transform: scale(2.4); opacity: 0; } }",
  "@keyframes eg-throb { from { opacity: 0.4; } to { opacity: 1; } }",
].join(" ");

const SVG_NS = "http://www.w3.org/2000/svg";
const RING_R = 44;

/** Generated from map-10-29-26.psd (visible layers only). Group names become classNames. */
export default function ElectricGridMap({
  ref,
  className,
  ...svgProps
}: Omit<SVGProps<SVGSVGElement>, "ref"> & { ref?: Ref<ElectricGridMapHandle> }) {
  const svg = useRef<SVGSVGElement>(null);
  const timers = useRef<number[]>([]);
  const levelBox = useRef<LevelBoxHandle>(null);
  const instructionBox = useRef<InstructionBoxHandle>(null);

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

  const setStormRect = (visible: boolean, transition: string, transform: string) => {
    const storm = svg.current?.querySelector<SVGElement>(".storm");
    const sweep = storm?.querySelector<SVGElement>(".storm-sweep");
    if (!storm || !sweep) return;
    // The storm group stays put; only the radar inside it sweeps across.
    sweep.style.transition = transition;
    sweep.style.transform = transform;
    storm.style.transition = "none";
    storm.style.opacity = visible ? "1" : "0";
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
    reset() {
      hideZones();
      hideIcons();
      ringGroup("static-rings")?.replaceChildren();
      ringGroup("pulses")?.replaceChildren();
      ringGroup("path")?.querySelectorAll("path").forEach((p) => p.removeAttribute("d"));
      const storm = svg.current?.querySelector<SVGElement>(".storm");
      if (storm) {
        storm.style.transition = "none";
        storm.style.opacity = "0";
      }
    },
    hideZones,
    hideIcons,
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
      const storm = svg.current?.querySelector<SVGElement>(".storm");
      if (!storm || !boxes.length) return;
      const pad = 120; // room for the feathered edges
      const right = Math.min(2927, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
      buildRadar(storm, boxes);
      setStormRect(true, "none", `translateX(${-(right + 40)}px)`);
      void storm.getBoundingClientRect(); // commit the start position before animating
      setStormRect(true, `transform ${durationMs}ms cubic-bezier(0.25, 0.1, 0.25, 1)`, "translateX(0)");
    },
    hideStorm(fadeMs = 1000) {
      const rect = svg.current?.querySelector<SVGElement>(".storm");
      if (rect) rect.style.transition = `opacity ${fadeMs}ms ease`;
      if (rect) rect.style.opacity = "0";
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
        viewBox="0 0 2927 1646"
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
        <filter id="eg-radar" filterUnits="userSpaceOnUse" x={0} y={0} width={2927} height={1646} colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves={4} seed={7} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={110} xChannelSelector="R" yChannelSelector="G" result="ragged" />
          <feGaussianBlur in="ragged" stdDeviation={22} />
        </filter>
        <image id="icon-firestation" href="/electric-grid/icon-firestation.png" width={64} height={80} />
        <image id="icon-police" href="/electric-grid/icon-police.png" width={71} height={77} />
        <image id="icon-hospital" href="/electric-grid/icon-hospital.png" width={71} height={70} />
        <image id="icon-water" href="/electric-grid/icon-water.png" width={76} height={76} />
        <image id="icon-power" href="/electric-grid/icon-power.png" width={77} height={77} />
        <image id="icon-shelter" href="/electric-grid/icon-shelter.png" width={65} height={81} />
        <mask id="zone-24-mask" maskUnits="userSpaceOnUse" x={2326} y={0} width={601} height={484} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-24.png" x={2326} y={0} width={601} height={484} />
        </mask>
        <mask id="zone-22-mask" maskUnits="userSpaceOnUse" x={0} y={1395} width={43} height={216} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-22.png" x={0} y={1395} width={43} height={216} />
        </mask>
        <mask id="zone-21-mask" maskUnits="userSpaceOnUse" x={1473} y={1543} width={420} height={103} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-21.png" x={1473} y={1543} width={420} height={103} />
        </mask>
        <mask id="zone-20-mask" maskUnits="userSpaceOnUse" x={1544} y={1418} width={503} height={228} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-20.png" x={1544} y={1418} width={503} height={228} />
        </mask>
        <mask id="zone-19-mask" maskUnits="userSpaceOnUse" x={1388} y={774} width={1539} height={872} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-19.png" x={1388} y={774} width={1539} height={872} />
        </mask>
        <mask id="zone-18-mask" maskUnits="userSpaceOnUse" x={1309} y={249} width={1618} height={753} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-18.png" x={1309} y={249} width={1618} height={753} />
        </mask>
        <mask id="zone-17-mask" maskUnits="userSpaceOnUse" x={1816} y={0} width={699} height={749} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-17.png" x={1816} y={0} width={699} height={749} />
        </mask>
        <mask id="zone-16-mask" maskUnits="userSpaceOnUse" x={0} y={1167} width={584} height={479} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-16.png" x={0} y={1167} width={584} height={479} />
        </mask>
        <mask id="zone-15-mask" maskUnits="userSpaceOnUse" x={544} y={1487} width={388} height={159} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-15.png" x={544} y={1487} width={388} height={159} />
        </mask>
        <mask id="zone-14-mask" maskUnits="userSpaceOnUse" x={884} y={1443} width={214} height={203} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-14.png" x={884} y={1443} width={214} height={203} />
        </mask>
        <mask id="zone-13-mask" maskUnits="userSpaceOnUse" x={981} y={1265} width={373} height={381} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-13.png" x={981} y={1265} width={373} height={381} />
        </mask>
        <mask id="zone-12-mask" maskUnits="userSpaceOnUse" x={1073} y={1139} width={610} height={507} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-12.png" x={1073} y={1139} width={610} height={507} />
        </mask>
        <mask id="zone-11-mask" maskUnits="userSpaceOnUse" x={1261} y={958} width={200} height={236} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-11.png" x={1261} y={958} width={200} height={236} />
        </mask>
        <mask id="zone-10-mask" maskUnits="userSpaceOnUse" x={1220} y={222} width={632} height={623} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-10.png" x={1220} y={222} width={632} height={623} />
        </mask>
        <mask id="zone-9-mask" maskUnits="userSpaceOnUse" x={0} y={551} width={639} height={821} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-9.png" x={0} y={551} width={639} height={821} />
        </mask>
        <mask id="zone-8-mask" maskUnits="userSpaceOnUse" x={530} y={977} width={269} height={503} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-8.png" x={530} y={977} width={269} height={503} />
        </mask>
        <mask id="zone-7-mask" maskUnits="userSpaceOnUse" x={756} y={1164} width={283} height={309} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-7.png" x={756} y={1164} width={283} height={309} />
        </mask>
        <mask id="zone-6-mask" maskUnits="userSpaceOnUse" x={875} y={1120} width={163} height={148} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-6.png" x={875} y={1120} width={163} height={148} />
        </mask>
        <mask id="zone-5-mask" maskUnits="userSpaceOnUse" x={944} y={1055} width={124} height={130} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-5.png" x={944} y={1055} width={124} height={130} />
        </mask>
        <mask id="zone-4-mask" maskUnits="userSpaceOnUse" x={933} y={736} width={393} height={391} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-4.png" x={933} y={736} width={393} height={391} />
        </mask>
        <mask id="zone-3-mask" maskUnits="userSpaceOnUse" x={877} y={529} width={393} height={347} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-3.png" x={877} y={529} width={393} height={347} />
        </mask>
        <mask id="zone-2-mask" maskUnits="userSpaceOnUse" x={614} y={573} width={281} height={430} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-2.png" x={614} y={573} width={281} height={430} />
        </mask>
        <mask id="zone-1-mask" maskUnits="userSpaceOnUse" x={667} y={803} width={398} height={408} style={{ maskType: "alpha" }}>
          <image href="/electric-grid/zone-1.png" x={667} y={803} width={398} height={408} />
        </mask>
        </defs>
        <g className="map-layers">
          <image href="/electric-grid/layer-33.png" x={0} y={0} width={2927} height={1646} data-name="Layer 33" />
          <image href="/electric-grid/4k-base-map-dark.png" x={0} y={0} width={2927} height={1646} data-name="4K BASE MAP dark" />
          <image href="/electric-grid/water.png" x={0} y={0} width={2927} height={1646} data-name="water" />
        </g>
        <g className="categories">
          <g className="zones" opacity={0.839}>
            <rect x={2326} y={0} width={601} height={484} mask="url(#zone-24-mask)" data-name="zone 24" opacity={0.302} />
            <rect x={0} y={1395} width={43} height={216} mask="url(#zone-22-mask)" data-name="zone 22" opacity={0.161} />
            <rect x={1473} y={1543} width={420} height={103} mask="url(#zone-21-mask)" data-name="zone 21" opacity={0.231} />
            <rect x={1544} y={1418} width={503} height={228} mask="url(#zone-20-mask)" data-name="zone 20" opacity={0.412} />
            <rect x={1388} y={774} width={1539} height={872} mask="url(#zone-19-mask)" data-name="zone 19" opacity={0.271} />
            <rect x={1309} y={249} width={1618} height={753} mask="url(#zone-18-mask)" data-name="zone 18" opacity={0.431} />
            <rect x={1816} y={0} width={699} height={749} mask="url(#zone-17-mask)" data-name="zone 17" opacity={0.349} />
            <rect x={0} y={1167} width={584} height={479} mask="url(#zone-16-mask)" data-name="zone 16" opacity={0.239} />
            <rect x={544} y={1487} width={388} height={159} mask="url(#zone-15-mask)" data-name="zone 15" opacity={0.29} />
            <rect x={884} y={1443} width={214} height={203} mask="url(#zone-14-mask)" data-name="zone 14" opacity={0.322} />
            <rect x={981} y={1265} width={373} height={381} mask="url(#zone-13-mask)" data-name="zone 13" opacity={0.341} />
            <rect x={1073} y={1139} width={610} height={507} mask="url(#zone-12-mask)" data-name="zone 12" opacity={0.42} />
            <rect x={1261} y={958} width={200} height={236} mask="url(#zone-11-mask)" data-name="zone 11" opacity={0.42} />
            <rect x={1220} y={222} width={632} height={623} mask="url(#zone-10-mask)" data-name="zone 10" opacity={0.4} />
            <rect x={0} y={551} width={639} height={821} mask="url(#zone-9-mask)" data-name="zone 9" opacity={0.349} />
            <rect x={530} y={977} width={269} height={503} mask="url(#zone-8-mask)" data-name="zone 8" opacity={0.522} />
            <rect x={756} y={1164} width={283} height={309} mask="url(#zone-7-mask)" data-name="zone 7" opacity={0.471} />
            <rect x={875} y={1120} width={163} height={148} mask="url(#zone-6-mask)" data-name="zone 6" opacity={0.6} />
            <rect x={944} y={1055} width={124} height={130} mask="url(#zone-5-mask)" data-name="zone 5" opacity={0.49} />
            <rect x={933} y={736} width={393} height={391} mask="url(#zone-4-mask)" data-name="zone 4" opacity={0.51} />
            <rect x={877} y={529} width={393} height={347} mask="url(#zone-3-mask)" data-name="zone 3" opacity={0.471} />
            <rect x={614} y={573} width={281} height={430} mask="url(#zone-2-mask)" data-name="zone 2" opacity={0.58} />
            <rect x={667} y={803} width={398} height={408} mask="url(#zone-1-mask)" data-name="zone 1" opacity={0.678} />
          </g>
          <image href="/electric-grid/boundary-lines.png" x={0} y={0} width={2927} height={1646} data-name="BOUNDARY LINES" />
          <g className="storm" pointerEvents="none" />
          <g className="police-fire-stations">
            <g className="fire-stations">
              <g className="fire-icons">
                <use href="#icon-firestation" x={-363} y={467} data-fid="fire-1" data-name="firestation 1" />
                <use href="#icon-firestation" x={-711} y={1123} data-fid="fire-2" data-name="firestation 2" />
                <use href="#icon-firestation" x={-218} y={1163} data-fid="fire-3" data-name="firestation 3" />
                <use href="#icon-firestation" x={71} y={1094} data-fid="fire-4" data-name="firestation 4" />
                <use href="#icon-firestation" x={751} y={596} data-fid="fire-5" data-name="firestation 5" />
                <use href="#icon-firestation" x={699} y={691} data-fid="fire-6" data-name="firestation 6" />
                <use href="#icon-firestation" x={1771} y={252} data-fid="fire-7" data-name="firestation 7" />
                <use href="#icon-firestation" x={1624} y={498} data-fid="fire-8" data-name="firestation 8" />
                <use href="#icon-firestation" x={598} y={1048} data-fid="fire-9" data-name="firestation 9" />
                <use href="#icon-firestation" x={757} y={983} data-fid="fire-10" data-name="firestation 10" />
                <use href="#icon-firestation" x={1046} y={867} data-fid="fire-11" data-name="firestation 11" />
                <use href="#icon-firestation" x={898} y={1024} data-fid="fire-12" data-name="firestation 12" />
                <use href="#icon-firestation" x={958} y={977} data-fid="fire-13" data-name="firestation 13" />
                <use href="#icon-firestation" x={940} y={1103} data-fid="fire-14" data-name="firestation 14" />
                <use href="#icon-firestation" x={689} y={1190} data-fid="fire-15" data-name="firestation 15" />
                <use href="#icon-firestation" x={637} y={1292} data-fid="fire-16" data-name="firestation 16" />
                <use href="#icon-firestation" x={854} y={1290} data-fid="fire-17" data-name="firestation 17" />
                <use href="#icon-firestation" x={1075} y={1113} data-fid="fire-18" data-name="firestation 18" />
                <use href="#icon-firestation" x={1201} y={990} data-fid="fire-19" data-name="firestation 19" />
                <use href="#icon-firestation" x={1341} y={984} data-fid="fire-20" data-name="firestation 20" />
                <use href="#icon-firestation" x={1485} y={1032} data-fid="fire-21" data-name="firestation 21" />
                <use href="#icon-firestation" x={1274} y={1177} data-fid="fire-22" data-name="firestation 22" />
                <use href="#icon-firestation" x={1199} y={1252} data-fid="fire-23" data-name="firestation 23" />
                <use href="#icon-firestation" x={1244} y={1507} data-fid="fire-24" data-name="firestation 24" />
                <use href="#icon-firestation" x={1009} y={1031} data-fid="fire-25" data-name="firestation 25" />
              </g>
            </g>
            <g className="police-stations">
              <g className="police-icons">
                <use href="#icon-police" x={111} y={1193} data-fid="police-1" data-name="police 1" />
                <use href="#icon-police" x={71} y={956} data-fid="police-2" data-name="police 2" />
                <use href="#icon-police" x={-354} y={681} data-fid="police-3" data-name="police 3" />
                <use href="#icon-police" x={380} y={611} data-fid="police-4" data-name="police 4" />
                <use href="#icon-police" x={910} y={687} data-fid="police-5" data-name="police 5" />
                <use href="#icon-police" x={709} y={1039} data-fid="police-6" data-name="police 6" />
                <use href="#icon-police" x={833} y={1022} data-fid="police-7" data-name="police 7" />
                <use href="#icon-police" x={956} y={1059} data-fid="police-8" data-name="police 8" />
                <use href="#icon-police" x={856} y={1219} data-fid="police-9" data-name="police 9" />
                <use href="#icon-police" x={900} y={1323} data-fid="police-10" data-name="police 10" />
                <use href="#icon-police" x={1048} y={1378} data-fid="police-11" data-name="police 11" />
                <use href="#icon-police" x={1162} y={1267} data-fid="police-12" data-name="police 12" />
                <use href="#icon-police" x={1275} y={1252} data-fid="police-13" data-name="police 13" />
                <use href="#icon-police" x={1142} y={1164} data-fid="police-14" data-name="police 14" />
                <use href="#icon-police" x={1186} y={950} data-fid="police-15" data-name="police 15" />
                <use href="#icon-police" x={1632} y={511} data-fid="police-16" data-name="police 16" />
                <use href="#icon-police" x={607} y={1214} data-fid="police-17" data-name="police 16" />
                <use href="#icon-police" x={453} y={1474} data-fid="police-18" data-name="police 17" />
              </g>
            </g>
          </g>
          <g className="shelters">
            <g className="shelter-icons">
              <use href="#icon-shelter" x={677} y={494} data-fid="shelter-1" data-name="shelter 1" />
              <use href="#icon-shelter" x={183} y={1005} data-fid="shelter-2" data-name="shelter 1 copy" />
              <use href="#icon-shelter" x={162} y={1167} data-fid="shelter-3" data-name="shelter 1 copy 2" />
              <use href="#icon-shelter" x={810} y={793} data-fid="shelter-4" data-name="shelter 1 copy 3" />
              <use href="#icon-shelter" x={758} y={935} data-fid="shelter-5" data-name="shelter 1 copy 4" />
              <use href="#icon-shelter" x={665} y={1216} data-fid="shelter-6" data-name="shelter 1 copy 5" />
              <use href="#icon-shelter" x={936} y={1148} data-fid="shelter-7" data-name="shelter 1 copy 6" />
              <use href="#icon-shelter" x={756} y={1077} data-fid="shelter-8" data-name="shelter 1 copy 7" />
              <use href="#icon-shelter" x={818} y={1018} data-fid="shelter-9" data-name="shelter 1 copy 8" />
              <use href="#icon-shelter" x={878} y={960} data-fid="shelter-10" data-name="shelter 1 copy 9" />
              <use href="#icon-shelter" x={948} y={1037} data-fid="shelter-11" data-name="shelter 1 copy 10" />
              <use href="#icon-shelter" x={886} y={1079} data-fid="shelter-12" data-name="shelter 1 copy 15" />
              <use href="#icon-shelter" x={1147} y={1180} data-fid="shelter-13" data-name="shelter 1 copy 11" />
              <use href="#icon-shelter" x={1533} y={1067} data-fid="shelter-14" data-name="shelter 1 copy 12" />
              <use href="#icon-shelter" x={925} y={1530} data-fid="shelter-15" data-name="shelter 1 copy 13" />
              <use href="#icon-shelter" x={1585} y={576} data-fid="shelter-16" data-name="shelter 1 copy 17" />
              <use href="#icon-shelter" x={954} y={1447} data-fid="shelter-17" data-name="shelter 1 copy 14" />
            </g>
          </g>
          <g className="hospitals">
            <g className="hospital-icons">
              <use href="#icon-hospital" x={201} y={648} data-fid="hospital-1" data-name="hospital 1" />
              <use href="#icon-hospital" x={-351} y={775} data-fid="hospital-2" data-name="hospital 1 copy" />
              <use href="#icon-hospital" x={169} y={762} data-fid="hospital-3" data-name="hospital 1 copy 2" />
              <use href="#icon-hospital" x={429} y={1022} data-fid="hospital-4" data-name="hospital 1 copy 3" />
              <use href="#icon-hospital" x={768} y={918} data-fid="hospital-5" data-name="hospital 1 copy 4" />
              <use href="#icon-hospital" x={851} y={1017} data-fid="hospital-6" data-name="hospital 1 copy 5" />
              <use href="#icon-hospital" x={899} y={1093} data-fid="hospital-7" data-name="hospital 1 copy 6" />
              <use href="#icon-hospital" x={713} y={1195} data-fid="hospital-8" data-name="hospital 1 copy 7" />
              <use href="#icon-hospital" x={558} y={1357} data-fid="hospital-9" data-name="hospital 1 copy 8" />
              <use href="#icon-hospital" x={784} y={1307} data-fid="hospital-10" data-name="hospital 1 copy 9" />
              <use href="#icon-hospital" x={784} y={1567} data-fid="hospital-11" data-name="hospital 1 copy 10" />
              <use href="#icon-hospital" x={1225} y={1566} data-fid="hospital-12" data-name="hospital 1 copy 11" />
              <use href="#icon-hospital" x={1504} y={1080} data-fid="hospital-13" data-name="hospital 1 copy 12" />
              <use href="#icon-hospital" x={1577} y={502} data-fid="hospital-14" data-name="hospital 1 copy 13" />
              <use href="#icon-hospital" x={1763} y={265} data-fid="hospital-15" data-name="hospital 1 copy 14" />
            </g>
          </g>
          <g className="water-sewer-facilities">
            <g className="water-icons">
              <use href="#icon-water" x={133} y={1008} data-fid="water-1" data-name="water 1" />
              <use href="#icon-water" x={570} y={1059} data-fid="water-2" data-name="water 1 copy" />
              <use href="#icon-water" x={627} y={587} data-fid="water-3" data-name="water 1 copy 2" />
              <use href="#icon-water" x={775} y={974} data-fid="water-4" data-name="water 1 copy 3" />
              <use href="#icon-water" x={959} y={798} data-fid="water-5" data-name="water 1 copy 4" />
              <use href="#icon-water" x={1126} y={847} data-fid="water-6" data-name="water 1 copy 5" />
              <use href="#icon-water" x={945} y={1167} data-fid="water-7" data-name="water 1 copy 6" />
              <use href="#icon-water" x={1002} y={1416} data-fid="water-8" data-name="water 1 copy 7" />
              <use href="#icon-water" x={1118} y={1245} data-fid="water-9" data-name="water 1 copy 8" />
              <use href="#icon-water" x={1291} y={1427} data-fid="water-10" data-name="water 1 copy 9" />
              <use href="#icon-water" x={1590} y={600} data-fid="water-11" data-name="water 1 copy 10" />
            </g>
          </g>
          <g className="power-plants-substations">
            <g className="power-icons">
              <use href="#icon-power" x={326} y={648} data-fid="power-1" data-name="power 1" />
              <use href="#icon-power" x={620} y={669} data-fid="power-2" data-name="power 1 copy" />
              <use href="#icon-power" x={419} y={1172} data-fid="power-3" data-name="power 1 copy 2" />
              <use href="#icon-power" x={498} y={1114} data-fid="power-4" data-name="power 1 copy 3" />
              <use href="#icon-power" x={493} y={1006} data-fid="power-5" data-name="power 1 copy 4" />
              <use href="#icon-power" x={617} y={1030} data-fid="power-6" data-name="power 1 copy 5" />
              <use href="#icon-power" x={828} y={1125} data-fid="power-7" data-name="power 1 copy 6" />
              <use href="#icon-power" x={957} y={1296} data-fid="power-8" data-name="power 1 copy 7" />
              <use href="#icon-power" x={966} y={1165} data-fid="power-9" data-name="power 1 copy 8" />
              <use href="#icon-power" x={992} y={759} data-fid="power-10" data-name="power 1 copy 9" />
              <use href="#icon-power" x={1117} y={826} data-fid="power-11" data-name="power 1 copy 10" />
              <use href="#icon-power" x={1247} y={622} data-fid="power-12" data-name="power 1 copy 11" />
              <use href="#icon-power" x={1690} y={551} data-fid="power-13" data-name="power 1 copy 12" />
              <use href="#icon-power" x={1659} y={323} data-fid="power-14" data-name="power 1 copy 13" />
              <use href="#icon-power" x={1221} y={385} data-fid="power-15" data-name="power 1 copy 14" />
              <use href="#icon-power" x={2027} y={475} data-fid="power-16" data-name="power 1 copy 15" />
              <use href="#icon-power" x={1969} y={552} data-fid="power-17" data-name="power 1 copy 16" />
              <use href="#icon-power" x={1875} y={663} data-fid="power-18" data-name="power 1 copy 17" />
              <use href="#icon-power" x={1386} y={971} data-fid="power-19" data-name="power 1 copy 18" />
              <use href="#icon-power" x={1407} y={1172} data-fid="power-20" data-name="power 1 copy 19" />
              <use href="#icon-power" x={1528} y={1379} data-fid="power-21" data-name="power 1 copy 20" />
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
      <LevelBox ref={levelBox} />
      <InstructionBox ref={instructionBox} />
    </div>
  );
}
