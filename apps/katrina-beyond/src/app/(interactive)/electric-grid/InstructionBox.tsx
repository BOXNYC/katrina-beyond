"use client";

import { typeTick } from "@/lib/electricGridSound";
import { useEffect, useId, useImperativeHandle, useRef, type KeyboardEvent, type Ref, type SVGProps } from "react";

export type InstructionName = "level-1" | "level-2" | "level-3" | "level-4" | "level-5";

/** Names from before the panels became per-level. */
export type LegacyInstructionName =
  | "touch-power"
  | "connect-power"
  | "circle-water"
  | "circle-hospitals-shelters"
  | "touch-firehouse-police";

const LEGACY: Record<LegacyInstructionName, number> = {
  "touch-power": 1,
  "connect-power": 2,
  "circle-water": 3,
  "circle-hospitals-shelters": 4,
  "touch-firehouse-police": 5,
};

export type InstructionBoxHandle = {
  /** Hides the panel and the replay / quit buttons without transition. */
  reset: () => void;
  /**
   * Shows the panel for the given level (name, legacy name or 1-5), replacing any instruction already showing. The
   * panel fades in, then its caption is "typed" (revealed left to right in steps). The promise resolves once that
   * has finished: at once without a transition or with reduced motion, and also if the panel is hidden or reset meanwhile.
   */
  showInstruction: (name: InstructionName | LegacyInstructionName | number, transition?: boolean) => Promise<void>;
  /** Hides the panel and its instruction (not the buttons). */
  hideInstruction: (transition?: boolean) => void;
  /** Shows the replay and quit buttons (the row above the panel). */
  showReplay: (transition?: boolean) => void;
  /** Hides the replay and quit buttons. */
  hideReplay: (transition?: boolean) => void;
  /**
   * Fades the current instruction out and a text message in inside the box (the container and buttons stay).
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
/** How long the caption takes to type out when an instruction is shown, and in how many steps. */
const CAPTION_MS = 1400;
const CAPTION_STEPS = 24;
/** Delay between typed characters of a message. */
const TYPE_MS = 35;
/** Message text layout, in svg units, padded from the box edges. */
const MSG = { x: 2347, width: 456, top: 1135, bottom: 1545, size: 40, lineHeight: 54 } as const;

/**
 * Each shown panel acts its gesture out on a loop, starting as its caption begins typing: the icons dim and the hand
 * taps / drags / circles them in order as they light up, it ends back on the design, rests DEMO_TAIL_MS and holds as
 * designed for DEMO_HOLD_MS, then goes again.
 */
const DEMO_HOLD_MS = 2200;
const DEMO_TAIL_MS = 800;

type Pt = readonly [number, number];
/** A keyframe at a time (ms) into the demo cycle. */
type Frame = [ms: number, props: Keyframe];

/** Level 2's dotted line, from the hand's fingertip through the icons it connects. */
const CONNECT: Pt[] = [
  [2638.5, 1303],
  [2710.1, 1203.6],
  [2571, 1098.6],
  [2408.5, 1165],
];
const CONNECT_D = "M" + CONNECT.map((p) => p.join(" ")).join(" L");

/**
 * Levels 3 and 4's dashed loop ("Shape 1" art): an ellipse fit to it and the angles (degrees, y down) its stroke runs
 * from and to, padded into its gap so the reveal mask covers every dash. The stroke ends where the hand rests.
 */
const LOOPS: Record<number, { cx: number; cy: number; rx: number; ry: number; from: number; to: number }> = {
  3: { cx: 2540, cy: 1188, rx: 152, ry: 128, from: 104, to: 404 },
  4: { cx: 2545, cy: 1170, rx: 140, ry: 120, from: 32, to: -305 },
};
const LOOP_SAMPLES = 48;

const loopPoints = (level: number): Pt[] => {
  const { cx, cy, rx, ry, from, to } = LOOPS[level];
  return Array.from({ length: LOOP_SAMPLES + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / LOOP_SAMPLES) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as const;
  });
};

/** Fraction of the polyline's length at each of its points. */
const along = (pts: Pt[]) => {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return d.map((x) => x / d[d.length - 1]);
};

const center = (el: SVGImageElement): Pt => [el.x.baseVal.value + el.width.baseVal.value / 2, el.y.baseVal.value + el.height.baseVal.value / 2];

/** Hand offset from where it rests in the design, pressed (scaled about its fingertip) or not. */
const hand = (x: number, y: number, pressed = false, easing = "ease-in-out"): Keyframe => ({
  transform: `translate(${x}px, ${y}px) scale(${pressed ? 0.85 : 1})`,
  easing,
});
const LIT: Keyframe = { opacity: 1, transform: "scale(1)" };
const DIM: Keyframe = { opacity: 0.35, transform: "scale(1)" };
const POP: Keyframe = { opacity: 1, transform: "scale(1.18)" };

/**
 * The panel bed, every panel and the replay / quit buttons are hidden by default. The buttons are only interactive while
 * shown (inline pointer-events), and give press feedback.
 */
const CSS = `
.instruction-box > * { opacity: 0; }
.instruction-box .panel-button { pointer-events: none; cursor: pointer; outline: none; transform-box: fill-box; transform-origin: center; transition: transform 120ms ease, filter 120ms ease; -webkit-tap-highlight-color: transparent; }
.instruction-box .panel-button:active { transform: scale(0.94); filter: brightness(0.85); }
.instruction-box .panel-button .button-hit { fill: rgba(0,0,0,0.01); stroke: none; }
.instruction-box .panel-button:focus-visible .button-hit { stroke: #fff; stroke-width: 4; }
.instruction-box .message-cursor { animation: instruction-cursor 1s steps(1) infinite; }
@keyframes instruction-cursor { 50% { opacity: 0; } }
.instruction-box [data-step] { transform-box: fill-box; transform-origin: center; }
.instruction-box [data-hand] { transform-box: fill-box; transform-origin: 8% 8%; }
@media (prefers-reduced-motion: reduce) { .instruction-box .message-cursor { animation: none; } }
`;

type TypedLine = { span: SVGTSpanElement; text: string; x: number; y: number };

/** Level 2's dotted line, redrawn as a vector (the PSD stroke: 8px round dots every 16px, #0088E7, thin white edge; psd-tools renders it as a solid line or adds a stray closing line, so it is drawn by hand). */
function PathLines({ mask }: { mask: string }) {
  const dots = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: "0 16" } as const;
  return (
    <g data-name="path lines copy 2" data-line mask={`url(#${mask})`}>
      <path d={CONNECT_D} stroke="#fff" strokeWidth={10} {...dots} />
      <path d={CONNECT_D} stroke="#0088E7" strokeWidth={8} {...dots} />
    </g>
  );
}

/**
 * Reveal mask for a demo's line or loop: shows it all until the demo animates its stroke-dashoffset (1 hidden, 0 shown).
 * Round caps let it cover the art's end dashes; the demo keeps the art hidden while the mask is (a zero-length dash still draws a cap).
 */
function RevealMask({ id, d, width }: { id: string; d: string; width: number }) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x={2297} y={983} width={556} height={604}>
      <path data-reveal={id} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={0} stroke="#fff" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </mask>
  );
}

/** Generated from map-v1.psd (visible layers only, "AI box" group). Group names become classNames. */
export default function InstructionBox({
  ref,
  style,
  className,
  onReplay,
  onQuit,
  ...svgProps
}: Omit<SVGProps<SVGSVGElement>, "ref"> & { ref?: Ref<InstructionBoxHandle>; onReplay?: () => void; onQuit?: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const shown = useRef<number | null>(null); // level panel currently meant to be showing
  const messageUp = useRef(false);
  const messageTimer = useRef<number | undefined>(undefined);
  const typeTimer = useRef<number | undefined>(undefined);
  const captionTimer = useRef<number | undefined>(undefined);
  const captionAnim = useRef<Animation | null>(null);
  const captionDone = useRef<(() => void) | null>(null);
  const captionEl = useRef<SVGElement | null>(null);
  const captionTick = useRef<number | undefined>(undefined);
  const demo = useRef<Animation[]>([]);
  const maskId = `instruction-${useId().replace(/[^\w-]/g, "")}`;
  const mask = (level: number) => `${maskId}-${level}`;

  /** Stops any caption typing in progress (leaving the caption fully shown) and resolves its promise. */
  const endCaption = () => {
    window.clearTimeout(captionTimer.current);
    window.clearInterval(captionTick.current);
    captionAnim.current?.cancel();
    captionAnim.current = null;
    captionEl.current?.style.removeProperty("clip-path");
    captionEl.current = null;
    const done = captionDone.current;
    captionDone.current = null;
    done?.();
  };

  const stopDemo = () => {
    demo.current.forEach((a) => a.cancel());
    demo.current = [];
  };

  /** Starts the panel's looping gesture demo (see DEMO_HOLD_MS), replacing any other. Its first gesture begins `lead` ms from now. */
  const startDemo = (panel: Element, lead = 0) => {
    stopDemo();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const level = Number(panel.getAttribute("data-panel"));
    const handEl = panel.querySelector("[data-hand]");
    const icons = [...panel.querySelectorAll<SVGImageElement>("[data-step]")].sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step));
    const reveal = svg.current?.querySelector(`[data-reveal="${mask(level)}"]`);
    if (!handEl || !icons.length) return;
    const H = DEMO_HOLD_MS;
    const tracks: [Element, Frame[]][] = [];
    let end: number;

    if (level === 2) {
      // Connect: press on the start, drag through the icons drawing the line, release and return.
      const line = panel.querySelector("[data-line]");
      const [x0, y0] = CONNECT[0];
      const frac = along(CONNECT);
      const DRAG = 1800;
      const s = H + 500;
      const [lx, ly] = CONNECT[CONNECT.length - 1];
      tracks.push([
        handEl,
        [
          [H, hand(0, 0)],
          [H + 250, hand(0, 0, true)],
          ...CONNECT.map(([x, y], i): Frame => [s + frac[i] * DRAG, hand(x - x0, y - y0, true, "linear")]),
          [s + DRAG + 400, hand(lx - x0, ly - y0, true)],
          [s + DRAG + 600, hand(lx - x0, ly - y0)],
          [s + DRAG + 1300, hand(0, 0)],
        ],
      ]);
      icons.forEach((icon, i) => {
        const at = s + frac[i + 1] * DRAG;
        tracks.push([icon, [[H, LIT], [H + 250, DIM], [at - 100, DIM], [at, POP], [at + 300, LIT]]]);
      });
      if (line) tracks.push([line, [[H, { opacity: 1 }], [H + 250, { opacity: 0 }], [s - 10, { opacity: 0 }], [s, { opacity: 1 }]]]);
      if (reveal) tracks.push([reveal, [[H + 250, { strokeDashoffset: 0 }], [H + 260, { strokeDashoffset: 1 }], [s, { strokeDashoffset: 1, easing: "linear" }], [s + DRAG, { strokeDashoffset: 0 }]]]);
      end = s + DRAG + 1300 + DEMO_TAIL_MS;
    } else if (LOOPS[level]) {
      // Group: move to the loop's start, press, circle the icons drawing the loop (ending at rest), then they light together.
      const shape = panel.querySelector("[data-loop]");
      const pts = loopPoints(level);
      const [ex, ey] = pts[pts.length - 1];
      const frac = along(pts);
      const TRACE = 1800;
      const s = H + 650;
      tracks.push([
        handEl,
        [
          [H, hand(0, 0)],
          [H + 500, hand(pts[0][0] - ex, pts[0][1] - ey)],
          ...pts.map(([x, y], i): Frame => [s + frac[i] * TRACE, hand(x - ex, y - ey, true, "linear")]),
          [s + TRACE + 200, hand(0, 0)],
        ],
      ]);
      const done = s + TRACE + 200;
      icons.forEach((icon) => tracks.push([icon, [[H, LIT], [H + 250, DIM], [done - 50, DIM], [done + 150, POP], [done + 450, LIT]]]));
      if (shape) tracks.push([shape, [[H, { opacity: 1 }], [H + 250, { opacity: 0 }], [s - 10, { opacity: 0 }], [s, { opacity: 1 }]]]);
      if (reveal) tracks.push([reveal, [[H + 250, { strokeDashoffset: 0 }], [H + 260, { strokeDashoffset: 1 }], [s, { strokeDashoffset: 1, easing: "linear" }], [s + TRACE, { strokeDashoffset: 0 }]]]);
      end = done + 450 + DEMO_TAIL_MS;
    } else {
      // Taps: the hand taps each icon in order, lighting it, and finishes on the last one (where it rests in the design).
      const [rx, ry] = center(icons[icons.length - 1]);
      const MOVE = 450;
      const STEP = 800;
      const handFrames: Frame[] = [[H, hand(0, 0)]];
      icons.forEach((icon, i) => {
        const [x, y] = center(icon);
        const at = H + MOVE + i * STEP;
        handFrames.push([at, hand(x - rx, y - ry)], [at + 120, hand(x - rx, y - ry, true)], [at + 260, hand(x - rx, y - ry)]);
        tracks.push([icon, [[H, LIT], [H + 300, DIM], [at + 120, DIM], [at + 220, POP], [at + 480, LIT]]]);
      });
      tracks.push([handEl, handFrames]);
      end = H + MOVE + (icons.length - 1) * STEP + 480 + DEMO_TAIL_MS;
    }

    demo.current = tracks.map(([el, frames]) => {
      const all: Frame[] = [[0, frames[0][1]], ...frames, [end, frames[frames.length - 1][1]]];
      const anim = el.animate(
        all.map(([ms, props]) => ({ ...props, offset: ms / end })),
        { duration: end, iterations: Infinity },
      );
      anim.currentTime = Math.max(0, H - lead); // skip the first round's hold
      return anim;
    });
  };

  useEffect(
    () => () => {
      window.clearTimeout(messageTimer.current);
      window.clearTimeout(typeTimer.current);
      endCaption();
      stopDemo();
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
  const buttons = () => [...(svg.current?.querySelectorAll<SVGGElement>(":scope > .panel-button") ?? [])];

  const setReplay = (on: boolean, transition: boolean) => {
    buttons().forEach((el) => {
      fade(el, on, transition);
      el.style.pointerEvents = on ? "auto" : "none";
      el.setAttribute("tabindex", on ? "0" : "-1");
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
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
      if (line.text[ci - 1]?.trim()) typeTick();
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
    if (panel) {
      fade(panel, true, transition);
      startDemo(panel, transition ? FADE_MS : 0);
    }
  };

  const hide = (transition: boolean) => {
    endCaption();
    stopDemo();
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
      if (!panel) return Promise.resolve();
      endCaption();
      dropMessage(transition);
      shown.current = level;
      panels().forEach((el) => el !== panel && fade(el, false, transition));
      const b = bed();
      if (b) fade(b, true, transition);
      fade(panel, true, transition);
      startDemo(panel, transition ? FADE_MS : 0); // the caption starts typing once the panel has faded in
      const caption = panel.querySelector<SVGElement>("[data-caption]");
      if (!transition || !caption || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
      return new Promise<void>((resolve) => {
        captionDone.current = resolve;
        captionEl.current = caption;
        // Hidden until the panel has faded in, then wiped in left to right in steps.
        caption.style.clipPath = "inset(0 100% 0 0)";
        captionTimer.current = window.setTimeout(() => {
          const anim = caption.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
            duration: CAPTION_MS,
            easing: `steps(${CAPTION_STEPS}, end)`,
            fill: "forwards",
          });
          captionAnim.current = anim;
          captionTick.current = window.setInterval(typeTick, CAPTION_MS / CAPTION_STEPS); // one click per wipe step
          anim.onfinish = () => {
            endCaption();
          };
        }, FADE_MS);
      });
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
      stopDemo();
      panels().forEach((p) => fade(p, false, transition));
      const b = bed();
      if (b) fade(b, true, transition);
      fade(el, true, transition);
      messageUp.current = true;
      if (layout) typeMessage(layout, () => (messageTimer.current = window.setTimeout(() => hideMessageNow(true), MESSAGE_MS)));
    },
    hideMessage: (transition = true) => hideMessageNow(transition),
  }));

  const onKeyDown = (action?: () => void) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    action?.();
  };

  return (
    <>
      <style>{CSS}</style>
      <svg
        ref={svg}
        viewBox="2297 867 556 720"
        xmlns="http://www.w3.org/2000/svg"
        className={["instruction-box", className].filter(Boolean).join(" ")}
        style={{ position: "absolute", left: "78.3424%", top: "52.6092%", width: "18.9632%", height: "43.6893%", pointerEvents: "none", ...style }}
        {...svgProps}
      >
        <defs>
          <RevealMask id={mask(2)} d={CONNECT_D} width={24} />
          {[3, 4].map((level) => (
            <RevealMask key={level} id={mask(level)} d={"M" + loopPoints(level).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} width={70} />
          ))}
        </defs>
        <rect className="ai-box-container" x={2299} y={985} width={552} height={600} rx={30} fill="#000" fillOpacity={0.741} data-name="Container" />
        <g className="level-5" data-panel={5}>
          <image data-caption href="/electric-grid/ui/touch-the-icons-in-proper-order.png" x={2401} y={1446} width={359} height={92} data-name="touch the icons in proper order" />
          <image data-step={3} href="/electric-grid/ui/firehouse-original-art-copy.png" x={2545} y={1056} width={64} height={80} data-name="firehouse original art copy" />
          <image data-step={1} href="/electric-grid/ui/firehouse-original-art-copy-2.png" x={2377} y={1161} width={64} height={80} data-name="firehouse original art copy 2" />
          <image data-step={5} href="/electric-grid/ui/firehouse-original-art-copy-3.png" x={2563} y={1236} width={64} height={80} data-name="firehouse original art copy 3" />
          <image data-step={2} href="/electric-grid/ui/police-original-art-copy.png" x={2436} y={1075} width={71} height={77} data-name="police original art copy" />
          <image data-step={4} href="/electric-grid/ui/police-original-art-copy-2.png" x={2456} y={1246} width={71} height={77} data-name="police original art copy 2" />
          <image data-hand href="/electric-grid/ui/hand.png" x={2599} y={1261} width={171} height={150} data-name="hand" />
        </g>
        <g className="level-4" data-panel={4}>
          <image data-caption href="/electric-grid/ui/circle-the-icon-groups-in-proper-order.png" x={2356} y={1449} width={440} height={92} data-name="circle the icon groups in proper order" />
          <image data-loop mask={`url(#${mask(4)})`} href="/electric-grid/ui/shape-1.png" x={2370} y={1015} width={349} height={308} data-name="Shape 1" />
          <image data-step={1} href="/electric-grid/ui/shelter-1-copy.png" x={2470} y={1093} width={65} height={81} data-name="shelter 1 copy" />
          <image data-step={1} href="/electric-grid/ui/hospital-original-art-copy.png" x={2468} y={1203} width={71} height={70} data-name="hospital original art copy" />
          <image data-step={1} href="/electric-grid/ui/shelter-1-copy.png" x={2573} y={1132} width={65} height={81} data-name="shelter 1 copy 3" />
          <image data-hand href="/electric-grid/ui/hand-2.png" x={2602} y={1273} width={155} height={136} data-name="hand" />
        </g>
        <g className="level-3" data-panel={3}>
          <image data-caption href="/electric-grid/ui/circle-icon-groups-to-restore-water-supply.png" x={2343} y={1431} width={471} height={92} data-name="circle icon groups to restore water supply" />
          <image data-loop mask={`url(#${mask(3)})`} href="/electric-grid/ui/shape-1-2.png" x={2355} y={1028} width={369} height={318} data-name="Shape 1" />
          <image data-step={1} href="/electric-grid/ui/water-original-art-copy.png" x={2483} y={1217} width={76} height={76} data-name="water original art copy" />
          <image data-step={2} href="/electric-grid/ui/water-original-art-copy-2.png" x={2568} y={1148} width={76} height={76} data-name="water original art copy 2" />
          <image data-step={3} href="/electric-grid/ui/water-original-art-copy-3.png" x={2453} y={1112} width={76} height={76} data-name="water original art copy 3" />
          <image data-hand href="/electric-grid/ui/hand-4.png" x={2624} y={1244} width={171} height={150} data-name="hand" />
        </g>
        <g className="level-2" data-panel={2}>
          <PathLines mask={mask(2)} />
          <image data-step={3} href="/electric-grid/ui/power-original-art-copy.png" x={2374} y={1126} width={77} height={77} data-name="power original art copy" />
          <image data-step={2} href="/electric-grid/ui/power-original-art-copy-2.png" x={2535} y={1066} width={77} height={77} data-name="power original art copy 2" />
          <image data-step={1} href="/electric-grid/ui/power-original-art-copy-3.png" x={2662} y={1166} width={77} height={77} data-name="power original art copy 3" />
          {/* Above the icons it drags across (in the PSD it is below them). */}
          <image data-hand href="/electric-grid/ui/hand-copy.png" x={2623} y={1288} width={157} height={138} data-name="hand copy" />
          <image data-caption href="/electric-grid/ui/connect-the-icons.png" x={2393} y={1472} width={361} height={31} data-name="connect the icons" />
        </g>
        <g className="level-1" data-panel={1}>
          <image data-caption href="/electric-grid/ui/touch-the-icons-in-proper-order-2.png" x={2401} y={1432} width={360} height={92} data-name="touch the icons in proper order" />
          <image data-step={3} href="/electric-grid/ui/power-original-art-copy-4.png" x={2575} y={1220} width={77} height={77} data-name="power original art copy 4" />
          <image data-step={1} href="/electric-grid/ui/power-original-art-copy-5.png" x={2386} y={1065} width={77} height={77} data-name="power original art copy 5" />
          <image data-step={2} href="/electric-grid/ui/power-original-art-copy-6.png" x={2496} y={1132} width={77} height={77} data-name="power original art copy 6" />
          <image data-hand href="/electric-grid/ui/hand-5.png" x={2601} y={1256} width={157} height={138} data-name="hand" />
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
        {/* Row above the panel (replaces the old round replay icon): teal replay pill and dark-red quit pill. */}
        <g className="panel-button replay-button" role="button" aria-label="Replay" aria-hidden="true" tabIndex={-1} onClick={() => onReplay?.()} onKeyDown={onKeyDown(onReplay)}>
          <rect className="button-hit" x={2289} y={859} width={282} height={115} rx={57} />
          <image href="/electric-grid/ui/button-left.png" x={2297} y={867} width={266} height={99} data-name="button left" />
          <image href="/electric-grid/ui/replay-exit-replay-text.png" x={2360} y={896} width={145} height={44} data-name="replay text" />
        </g>
        <g className="panel-button quit-button" role="button" aria-label="Quit" aria-hidden="true" tabIndex={-1} onClick={() => onQuit?.()} onKeyDown={onKeyDown(onQuit)}>
          <rect className="button-hit" x={2578} y={859} width={278} height={115} rx={57} />
          <image href="/electric-grid/ui/button-right.png" x={2586} y={867} width={262} height={99} data-name="button right" />
          <image href="/electric-grid/ui/replay-exit-quit-text.png" x={2673} y={896} width={89} height={43} data-name="quit text" />
        </g>
      </svg>
    </>
  );
}
