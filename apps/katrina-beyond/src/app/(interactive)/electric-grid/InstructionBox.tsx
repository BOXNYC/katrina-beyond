"use client";

import { useEffect, useImperativeHandle, useRef, type KeyboardEvent, type Ref, type SVGProps } from "react";

export type InstructionName = "level-1" | "level-2" | "level-3" | "level-4" | "level-5" | "level-6";

/** Names from before the panels became per-level. */
export type LegacyInstructionName =
  | "touch-power"
  | "connect-power"
  | "circle-water"
  | "touch-hospitals"
  | "circle-shelters"
  | "touch-firehouse-police";

const LEGACY: Record<LegacyInstructionName, number> = {
  "touch-power": 1,
  "connect-power": 2,
  "circle-water": 3,
  "touch-hospitals": 4,
  "circle-shelters": 5,
  "touch-firehouse-police": 6,
};

export type InstructionBoxHandle = {
  /** Hides the panel and the replay button without transition. */
  reset: () => void;
  /** Shows the panel for the given level (name, legacy name or 1-6), replacing any instruction already showing. */
  showInstruction: (name: InstructionName | LegacyInstructionName | number, transition?: boolean) => void;
  /** Hides the panel and its instruction (not the replay button). */
  hideInstruction: (transition?: boolean) => void;
  /** Shows the replay button. */
  showReplay: (transition?: boolean) => void;
  /** Hides the replay button. */
  hideReplay: (transition?: boolean) => void;
  /**
   * Fades the current instruction out and a text message in inside the box (the container and replay button stay).
   * One message at a time: a new one replaces the old. It stays until hideMessage() (the game calls it on the next
   * input) or MESSAGE_MS passes after the text has finished typing (character by character, with a trailing caret that disappears when typing ends), then the
   * instruction that was showing comes back.
   */
  showMessage: (text: string, transition?: boolean) => void;
  /** Fades the message out and restores the instruction that was showing, if any. No-op when no message is up. */
  hideMessage: (transition?: boolean) => void;
};

const FADE_MS = 500;
/** How long a message stays, once it has finished typing, before the instruction returns on its own. */
export const MESSAGE_MS = 6000;
/** Delay between typed characters of a message. */
const TYPE_MS = 35;
/** Message text layout, in svg units: clear of the replay button (top-right), padded from the box edges. */
const MSG = { x: 2347, width: 456, top: 1135, bottom: 1545, size: 40, lineHeight: 54 } as const;

/**
 * The panel bed, every panel and the replay button are hidden by default. The replay button is only interactive while
 * shown (inline pointer-events), and gives press feedback.
 */
const CSS = `
.instruction-box > * { opacity: 0; }
.instruction-box .replay-button { pointer-events: none; cursor: pointer; outline: none; transform-box: fill-box; transform-origin: center; transition: transform 120ms ease; }
.instruction-box .replay-button:active { transform: scale(0.94); }
.instruction-box .replay-button:focus-visible .replay-ring { stroke-width: 5; }
.instruction-box .message-cursor { animation: instruction-cursor 1s steps(1) infinite; }
@keyframes instruction-cursor { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .instruction-box .message-cursor { animation: none; } }
`;

type TypedLine = { span: SVGTSpanElement; text: string; x: number; y: number };

/** Level 2's dotted line, redrawn as a vector (the PSD stroke: 8px round dots every 16px, #0088E7, thin white edge; psd-tools renders it as a solid line or adds a stray closing line, so it is drawn by hand). */
function PathLines() {
  const d = "M2638.5 1303 L2710.1 1203.6 L2571 1098.6 L2408.5 1165";
  const dots = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: "0 16" } as const;
  return (
    <g data-name="path lines copy 2">
      <path d={d} stroke="#fff" strokeWidth={10} {...dots} />
      <path d={d} stroke="#0088E7" strokeWidth={8} {...dots} />
    </g>
  );
}

/** Generated from map-v1.psd (visible layers only, "AI box" group). Group names become classNames. */
export default function InstructionBox({
  ref,
  style,
  className,
  onReplay,
  ...svgProps
}: Omit<SVGProps<SVGSVGElement>, "ref"> & { ref?: Ref<InstructionBoxHandle>; onReplay?: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const shown = useRef<number | null>(null); // level panel currently meant to be showing
  const messageUp = useRef(false);
  const messageTimer = useRef<number | undefined>(undefined);
  const typeTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(messageTimer.current);
      window.clearTimeout(typeTimer.current);
    },
    [],
  );

  const fade = (el: Element, on: boolean, transition: boolean) => {
    const { style } = el as SVGElement;
    style.transition = transition ? `opacity ${FADE_MS}ms ease` : "none";
    if (on) style.opacity = "1";
    else style.removeProperty("opacity");
  };

  const panels = () => [...(svg.current?.querySelectorAll(":scope > g[data-panel]") ?? [])];
  const bed = () => svg.current?.querySelector(":scope > .ai-box-container");
  const replay = () => svg.current?.querySelector<SVGGElement>(":scope > .replay-button");

  const setReplay = (on: boolean, transition: boolean) => {
    const el = replay();
    if (!el) return;
    fade(el, on, transition);
    el.style.pointerEvents = on ? "auto" : "none";
    el.setAttribute("tabindex", on ? "0" : "-1");
    el.setAttribute("aria-hidden", on ? "false" : "true");
  };

  const messageEl = () => svg.current?.querySelector<SVGGElement>(":scope > .instruction-message");
  const cursorEl = () => messageEl()?.querySelector<SVGRectElement>(".message-cursor");

  /** Drops the message state without touching the panels (callers decide what shows next). */
  const dropMessage = (transition: boolean) => {
    window.clearTimeout(messageTimer.current);
    window.clearTimeout(typeTimer.current);
    messageUp.current = false;
    const el = messageEl();
    if (el) fade(el, false, transition);
  };

  /**
   * Greedy word-wrap of `text` into the message element's tspans, measured with the rendered font. Each line is
   * positioned by its full width (start-anchored) so typing it out doesn't shift it; the tspans start empty.
   */
  const layoutMessage = (text: string): { lines: TypedLine[]; size: number } | null => {
    const t = messageEl()?.querySelector<SVGTextElement>("text");
    if (!t) return null;
    t.replaceChildren();
    t.style.fontSize = "";
    const build = (size: number) => {
      t.setAttribute("font-size", String(size));
      t.replaceChildren();
      const lines: string[] = [];
      let line = "";
      const probe = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      t.appendChild(probe);
      for (const word of text.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        probe.textContent = next;
        if (line && probe.getComputedTextLength() > MSG.width) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      t.replaceChildren();
      return lines;
    };
    let size: number = MSG.size;
    let lines = build(size) ?? [];
    // Shrink for very long text so it never overflows the box.
    while (lines.length * (MSG.lineHeight * size) / MSG.size > MSG.bottom - MSG.top && size > 24) {
      size -= 2;
      lines = build(size) ?? [];
    }
    const lh = (MSG.lineHeight * size) / MSG.size;
    const y0 = (MSG.top + MSG.bottom) / 2 - ((lines.length - 1) * lh) / 2;
    const typed = lines.map((l, i): TypedLine => {
      const span = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      t.appendChild(span);
      span.textContent = l;
      const x = MSG.x + (MSG.width - span.getComputedTextLength()) / 2;
      const y = y0 + i * lh;
      span.setAttribute("x", String(x));
      span.setAttribute("y", String(y));
      span.textContent = "";
      return { span, text: l, x, y };
    });
    return { lines: typed, size };
  };

  /** Types the lines out one character at a time with the caret trailing, then calls `done`. The caret is hidden once typing finishes. */
  const typeMessage = ({ lines, size }: { lines: TypedLine[]; size: number }, finished: () => void) => {
    const cursor = cursorEl();
    if (cursor) cursor.style.visibility = "visible";
    const done = () => {
      if (cursor) cursor.style.visibility = "hidden";
      finished();
    };
    const place = (line: TypedLine) => {
      if (!cursor) return;
      const w = Math.max(3, size * 0.08);
      cursor.setAttribute("width", String(w));
      cursor.setAttribute("height", String(size * 0.95));
      cursor.setAttribute("x", String(line.x + line.span.getComputedTextLength() + size * 0.08));
      cursor.setAttribute("y", String(line.y - size * 0.78));
    };
    if (!lines.length) return done();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lines.forEach((l) => (l.span.textContent = l.text));
      place(lines[lines.length - 1]);
      return done();
    }
    let li = 0;
    let ci = 0;
    place(lines[0]);
    const step = () => {
      const line = lines[li];
      ci += 1;
      line.span.textContent = line.text.slice(0, ci);
      place(line);
      if (ci >= line.text.length) {
        li += 1;
        ci = 0;
        if (li >= lines.length) return done();
      }
      typeTimer.current = window.setTimeout(step, TYPE_MS);
    };
    typeTimer.current = window.setTimeout(step, TYPE_MS);
  };

  const hideMessageNow = (transition: boolean) => {
    if (!messageUp.current) return;
    dropMessage(transition);
    const panel = shown.current === null ? null : svg.current?.querySelector(`:scope > g[data-panel="${shown.current}"]`);
    if (panel) fade(panel, true, transition);
  };

  const hide = (transition: boolean) => {
    dropMessage(transition);
    shown.current = null;
    panels().forEach((el) => fade(el, false, transition));
    const b = bed();
    if (b) fade(b, false, transition);
  };

  useImperativeHandle(ref, () => ({
    reset() {
      hide(false);
      const m = messageEl();
      if (m) fade(m, false, false);
      setReplay(false, false);
    },
    hideInstruction: (transition = true) => hide(transition),
    showInstruction(name, transition = true) {
      const level = typeof name === "number" ? name : name in LEGACY ? LEGACY[name as LegacyInstructionName] : Number(name.slice(-1));
      const panel = svg.current?.querySelector(`:scope > g[data-panel="${level}"]`);
      if (!panel) return;
      dropMessage(transition);
      shown.current = level;
      panels().forEach((el) => el !== panel && fade(el, false, transition));
      const b = bed();
      if (b) fade(b, true, transition);
      fade(panel, true, transition);
    },
    showReplay: (transition = true) => setReplay(true, transition),
    hideReplay: (transition = true) => setReplay(false, transition),
    showMessage(text, transition = true) {
      const el = messageEl();
      if (!el || !text) return;
      window.clearTimeout(messageTimer.current);
      window.clearTimeout(typeTimer.current);
      const layout = layoutMessage(text);
      el.setAttribute("aria-label", text);
      panels().forEach((p) => fade(p, false, transition));
      const b = bed();
      if (b) fade(b, true, transition);
      fade(el, true, transition);
      messageUp.current = true;
      if (layout) typeMessage(layout, () => (messageTimer.current = window.setTimeout(() => hideMessageNow(true), MESSAGE_MS)));
    },
    hideMessage: (transition = true) => hideMessageNow(transition),
  }));

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onReplay?.();
  };

  return (
    <>
      <style>{CSS}</style>
      <svg
        ref={svg}
        viewBox="2297 983 556 604"
        xmlns="http://www.w3.org/2000/svg"
        className={["instruction-box", className].filter(Boolean).join(" ")}
        style={{ position: "absolute", left: "78.3424%", top: "59.6481%", width: "18.9632%", height: "36.6505%", pointerEvents: "none", ...style }}
        {...svgProps}
      >
        <rect className="ai-box-container" x={2299} y={985} width={552} height={600} rx={30} fill="#000" fillOpacity={0.741} data-name="Container" />
        <g className="level-6" data-panel={6}>
          <image href="/electric-grid/ui/touch-the-icons-in-proper-order.png" x={2401} y={1446} width={359} height={92} data-name="touch the icons in proper order" />
          <image href="/electric-grid/ui/firehouse-original-art-copy.png" x={2545} y={1056} width={64} height={80} data-name="firehouse original art copy" />
          <image href="/electric-grid/ui/firehouse-original-art-copy-2.png" x={2377} y={1161} width={64} height={80} data-name="firehouse original art copy 2" />
          <image href="/electric-grid/ui/firehouse-original-art-copy-3.png" x={2563} y={1236} width={64} height={80} data-name="firehouse original art copy 3" />
          <image href="/electric-grid/ui/police-original-art-copy.png" x={2436} y={1075} width={71} height={77} data-name="police original art copy" />
          <image href="/electric-grid/ui/police-original-art-copy-2.png" x={2456} y={1246} width={71} height={77} data-name="police original art copy 2" />
          <image href="/electric-grid/ui/hand.png" x={2599} y={1261} width={171} height={150} data-name="hand" />
        </g>
        <g className="level-5" data-panel={5}>
          <image href="/electric-grid/ui/circle-the-icon-groups-in-proper-order.png" x={2356} y={1449} width={440} height={92} data-name="circle the icon groups in proper order" />
          <image href="/electric-grid/ui/shape-1.png" x={2370} y={1015} width={349} height={308} data-name="Shape 1" />
          <image href="/electric-grid/ui/shelter-1-copy.png" x={2470} y={1093} width={65} height={81} data-name="shelter 1 copy" />
          <image href="/electric-grid/ui/shelter-1-copy.png" x={2503} y={1198} width={65} height={81} data-name="shelter 1 copy 2" />
          <image href="/electric-grid/ui/shelter-1-copy.png" x={2573} y={1132} width={65} height={81} data-name="shelter 1 copy 3" />
          <image href="/electric-grid/ui/hand-2.png" x={2602} y={1273} width={155} height={136} data-name="hand" />
        </g>
        <g className="level-4" data-panel={4}>
          <image href="/electric-grid/ui/touch-the-icons-in-proper-order.png" x={2397} y={1432} width={359} height={92} data-name="touch the icons in proper order" />
          <image href="/electric-grid/ui/hospital-original-art-copy.png" x={2389} y={1055} width={71} height={70} data-name="hospital original art copy" />
          <image href="/electric-grid/ui/hospital-original-art-copy-2.png" x={2481} y={1137} width={71} height={70} data-name="hospital original art copy 2" />
          <image href="/electric-grid/ui/hospital-original-art-copy-3.png" x={2571} y={1223} width={71} height={70} data-name="hospital original art copy 3" />
          <image href="/electric-grid/ui/hand-3.png" x={2599} y={1257} width={155} height={136} data-name="hand" />
        </g>
        <g className="level-3" data-panel={3}>
          <image href="/electric-grid/ui/circle-icon-groups-to-restore-water-supply.png" x={2343} y={1431} width={471} height={92} data-name="circle icon groups to restore water supply" />
          <image href="/electric-grid/ui/shape-1-2.png" x={2355} y={1028} width={369} height={318} data-name="Shape 1" />
          <image href="/electric-grid/ui/water-original-art-copy.png" x={2483} y={1217} width={76} height={76} data-name="water original art copy" />
          <image href="/electric-grid/ui/water-original-art-copy-2.png" x={2568} y={1148} width={76} height={76} data-name="water original art copy 2" />
          <image href="/electric-grid/ui/water-original-art-copy-3.png" x={2453} y={1112} width={76} height={76} data-name="water original art copy 3" />
          <image href="/electric-grid/ui/hand-4.png" x={2624} y={1244} width={171} height={150} data-name="hand" />
        </g>
        <g className="level-2" data-panel={2}>
          <PathLines />
          <image href="/electric-grid/ui/hand-copy.png" x={2623} y={1288} width={157} height={138} data-name="hand copy" />
          <image href="/electric-grid/ui/power-original-art-copy.png" x={2374} y={1126} width={77} height={77} data-name="power original art copy" />
          <image href="/electric-grid/ui/power-original-art-copy-2.png" x={2535} y={1066} width={77} height={77} data-name="power original art copy 2" />
          <image href="/electric-grid/ui/power-original-art-copy-3.png" x={2662} y={1166} width={77} height={77} data-name="power original art copy 3" />
          <image href="/electric-grid/ui/connect-the-icons.png" x={2393} y={1472} width={361} height={31} data-name="connect the icons" />
        </g>
        <g className="level-1" data-panel={1}>
          <image href="/electric-grid/ui/touch-the-icons-in-proper-order-2.png" x={2401} y={1432} width={360} height={92} data-name="touch the icons in proper order" />
          <image href="/electric-grid/ui/power-original-art-copy-4.png" x={2575} y={1220} width={77} height={77} data-name="power original art copy 4" />
          <image href="/electric-grid/ui/power-original-art-copy-5.png" x={2386} y={1065} width={77} height={77} data-name="power original art copy 5" />
          <image href="/electric-grid/ui/power-original-art-copy-6.png" x={2496} y={1132} width={77} height={77} data-name="power original art copy 6" />
          <image href="/electric-grid/ui/hand-5.png" x={2601} y={1256} width={157} height={138} data-name="hand" />
        </g>
        <g className="instruction-message" role="status" aria-live="polite">
          <text
            aria-hidden="true"
            fill="#fff"
            fillOpacity={0.73}
            fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
            fontWeight={500}
            fontStyle="italic"
            fontSize={MSG.size}
            style={{ whiteSpace: "pre" }}
          />
          <rect className="message-cursor" fill="#fff" fillOpacity={0.73} width={3} height={MSG.size} />
        </g>
        <g
          className="replay-button"
          role="button"
          aria-label="Replay"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => onReplay?.()}
          onKeyDown={onKeyDown}
        >
          <circle className="replay-ring" cx={2772} cy={1065} r={54} fill="rgba(0,0,0,0.01)" stroke="#fff" strokeWidth={2} data-name="Ellipse 1" />
          <image href="/electric-grid/ui/layer-47.png" x={2752} y={1034} width={58} height={60} data-name="Layer 47" />
        </g>
      </svg>
    </>
  );
}
