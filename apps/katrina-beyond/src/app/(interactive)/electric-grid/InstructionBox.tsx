"use client";

import { useImperativeHandle, useRef, type Ref, type SVGProps } from "react";

export type InstructionName =
  | "touch-firehouse-police"
  | "circle-shelters"
  | "touch-hospitals"
  | "circle-water"
  | "connect-power"
  | "touch-power";

export type InstructionBoxHandle = {
  /** Hides the panel without transition. */
  reset: () => void;
  /** Shows the panel with the given instruction, replacing any instruction already showing. */
  showInstruction: (name: InstructionName, transition?: boolean) => void;
  /** Hides the panel and its instruction. */
  hideInstruction: (transition?: boolean) => void;
};

const FADE_MS = 500;

/** The panel bed and every instruction are hidden by default. */
const CSS = ".instruction-box > * { opacity: 0; }";

/** Generated from ui-10-29-26.psd (visible layers only). Group names become classNames. */
export default function InstructionBox({
  ref,
  style,
  className,
  ...svgProps
}: Omit<SVGProps<SVGSVGElement>, "ref"> & { ref?: Ref<InstructionBoxHandle> }) {
  const svg = useRef<SVGSVGElement>(null);

  const fade = (el: Element, on: boolean, transition: boolean) => {
    const { style } = el as SVGElement;
    style.transition = transition ? `opacity ${FADE_MS}ms ease` : "none";
    if (on) style.opacity = "1";
    else style.removeProperty("opacity");
  };

  const hide = (transition: boolean) =>
    svg.current?.querySelectorAll(":scope > *").forEach((el) => fade(el, false, transition));

  useImperativeHandle(ref, () => ({
    reset: () => hide(false),
    hideInstruction: (transition = true) => hide(transition),
    showInstruction(name, transition = true) {
      const panel = svg.current?.querySelector(`:scope > .${name}`);
      if (!panel) return;
      svg.current?.querySelectorAll(":scope > g").forEach((el) => el !== panel && fade(el, false, transition));
      svg.current?.querySelectorAll(":scope > image").forEach((el) => fade(el, true, transition));
      fade(panel, true, transition);
    },
  }));

  return (
    <>
      <style>{CSS}</style>
      <svg
        ref={svg}
        viewBox="1997 985 611 619"
        xmlns="http://www.w3.org/2000/svg"
        className={["instruction-box", className].filter(Boolean).join(" ")}
        style={{ position: "absolute", left: "68.0873%", top: "59.6970%", width: "20.8319%", height: "37.5152%", pointerEvents: "none", ...style }}
        {...svgProps}
      >
        <image href="/electric-grid/ui/ai-box-bed.png" x={1997} y={985} width={611} height={619} data-name="AI box bed" />
        <g className="touch-firehouse-police">
          <image href="/electric-grid/ui/touch-the-dots.png" x={2159} y={1493} width={305} height={36} data-name="touch the dots" />
          <image href="/electric-grid/ui/firehouse-original-art-copy.png" x={2282} y={1049} width={64} height={80} data-name="firehouse original art copy" />
          <image href="/electric-grid/ui/firehouse-original-art-copy.png" x={2096} y={1143} width={64} height={80} data-name="firehouse original art copy 2" />
          <image href="/electric-grid/ui/firehouse-original-art-copy-3.png" x={2297} y={1248} width={64} height={80} data-name="firehouse original art copy 3" />
          <image href="/electric-grid/ui/police-original-art-copy.png" x={2158} y={1047} width={71} height={77} data-name="police original art copy" />
          <image href="/electric-grid/ui/police-original-art-copy.png" x={2175} y={1239} width={71} height={77} data-name="police original art copy 2" />
          <image href="/electric-grid/ui/hand.png" x={2324} y={1282} width={171} height={150} data-name="hand" />
        </g>
        <g className="circle-shelters">
          <image href="/electric-grid/ui/circle-the-dots.png" x={2164} y={1493} width={295} height={36} data-name="circle the dots" />
          <image href="/electric-grid/ui/shape-1.png" x={2092} y={1042} width={338} height={296} data-name="Shape 1" />
          <image href="/electric-grid/ui/shelter-original-art-copy.png" x={2174} y={1118} width={65} height={81} data-name="shelter original art copy" />
          <image href="/electric-grid/ui/shelter-original-art-copy.png" x={2306} y={1153} width={65} height={81} data-name="shelter original art copy 2" />
          <image href="/electric-grid/ui/shelter-original-art-copy.png" x={2209} y={1250} width={65} height={81} data-name="shelter original art copy 3" />
          <image href="/electric-grid/ui/hand-2.png" x={2341} y={1297} width={171} height={150} data-name="hand" />
        </g>
        <g className="touch-hospitals">
          <image href="/electric-grid/ui/touch-the-dots.png" x={2159} y={1493} width={305} height={36} data-name="touch the dots" />
          <image href="/electric-grid/ui/hospital-original-art-copy.png" x={2101} y={1048} width={71} height={70} data-name="hospital original art copy" />
          <image href="/electric-grid/ui/hospital-original-art-copy.png" x={2200} y={1138} width={71} height={70} data-name="hospital original art copy 2" />
          <image href="/electric-grid/ui/hospital-original-art-copy-3.png" x={2289} y={1235} width={71} height={70} data-name="hospital original art copy 3" />
          <image href="/electric-grid/ui/hand.png" x={2323} y={1272} width={171} height={150} data-name="hand" />
        </g>
        <g className="circle-water">
          <image href="/electric-grid/ui/circle-the-dots.png" x={2164} y={1493} width={295} height={36} data-name="circle the dots" />
          <image href="/electric-grid/ui/shape-1.png" x={2092} y={1042} width={338} height={296} data-name="Shape 1" />
          <image href="/electric-grid/ui/water-original-art-copy.png" x={2205} y={1253} width={76} height={76} data-name="water original art copy" />
          <image href="/electric-grid/ui/water-original-art-copy-2.png" x={2300} y={1151} width={76} height={76} data-name="water original art copy 2" />
          <image href="/electric-grid/ui/water-original-art-copy-3.png" x={2167} y={1113} width={76} height={76} data-name="water original art copy 3" />
          <image href="/electric-grid/ui/hand-2.png" x={2341} y={1297} width={171} height={150} data-name="hand" />
        </g>
        <g className="connect-power">
          <image href="/electric-grid/ui/path-lines-copy-2.png" x={2119} y={1057} width={311} height={236} data-name="path lines copy 2" />
          <image href="/electric-grid/ui/power-original-art-copy.png" x={2089} y={1089} width={77} height={77} data-name="power original art copy" />
          <image href="/electric-grid/ui/power-original-art-copy-2.png" x={2250} y={1029} width={77} height={77} data-name="power original art copy 2" />
          <image href="/electric-grid/ui/power-original-art-copy-3.png" x={2377} y={1129} width={77} height={77} data-name="power original art copy 3" />
          <image href="/electric-grid/ui/connect-the-dots.png" x={2129} y={1493} width={367} height={36} data-name="connect the dots!" />
          <image href="/electric-grid/ui/hand.png" x={2319} y={1288} width={171} height={150} data-name="hand" />
        </g>
        <g className="touch-power">
          <image href="/electric-grid/ui/touch-the-dots.png" x={2159} y={1493} width={305} height={36} data-name="touch the dots" />
          <image href="/electric-grid/ui/power-original-art-copy-4.png" x={2285} y={1230} width={77} height={77} data-name="power original art copy 4" />
          <image href="/electric-grid/ui/power-original-art-copy-5.png" x={2097} y={1043} width={77} height={77} data-name="power original art copy 5" />
          <image href="/electric-grid/ui/power-original-art-copy-5.png" x={2196} y={1137} width={77} height={77} data-name="power original art copy 6" />
          <image href="/electric-grid/ui/hand.png" x={2319} y={1267} width={171} height={150} data-name="hand" />
        </g>
      </svg>
    </>
  );
}
