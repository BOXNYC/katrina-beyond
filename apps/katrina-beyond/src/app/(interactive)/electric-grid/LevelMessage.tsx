"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref, type SVGProps } from "react";

export type LevelMessageHandle = {
  /** Hides the message without transition. */
  reset: () => void;
  /** Shows the message ("\n" breaks a line), crossfading from the one already showing, then types it out with a cursor that goes away when done. */
  setMessage: (text: string, transition?: boolean) => void;
  /** Hides the message. */
  hideMessage: (transition?: boolean) => void;
};

const FADE_MS = 500;
/** Delay between typed characters. */
const TYPE_MS = 40;

/** Placeholder text from the PSD. */
const DEFAULT_MESSAGE = "level two... restoration of\nwater to the region";

/** PSD type layer: HelveticaNeue-Medium 51.72px scaled 1.122 (58.08px), auto leading 120%, white at 73% fill. */
const FONT_SIZE = 58.08;
const LEADING = FONT_SIZE * 1.2;
const ORIGIN = { x: 57.16, y: 279.65 };

/** The cursor blinks while typing; with reduced motion the text appears at once and it never shows. */
const CSS = `
.current-message .message-cursor { animation: level-message-cursor 1s steps(1) infinite; }
@keyframes level-message-cursor { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .current-message .message-cursor { animation: none; } }
`;

/** Live text from map-v1.psd ("current message" group). Hidden until setMessage is called. */
export default function LevelMessage({
  ref,
  style,
  className,
  ...svgProps
}: Omit<SVGProps<SVGSVGElement>, "ref"> & { ref?: Ref<LevelMessageHandle> }) {
  const text = useRef<SVGTextElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const visible = useRef(false);
  const typer = useRef<ReturnType<typeof setInterval>>(undefined);
  const [message, setText] = useState(DEFAULT_MESSAGE);
  const [typed, setTyped] = useState(DEFAULT_MESSAGE.length); // characters of `message` showing; the cursor shows while short of the end

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearInterval(typer.current);
    },
    [],
  );

  /** Swaps in `next` and types it out one character at a time (all at once with reduced motion). */
  const typeIn = (next: string) => {
    clearInterval(typer.current);
    setText(next);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setTyped(next.length);
    let n = 0;
    setTyped(0);
    typer.current = setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= next.length) clearInterval(typer.current);
    }, TYPE_MS);
  };

  /** Stops typing and shows the whole message (no cursor). */
  const finishTyping = () => {
    clearInterval(typer.current);
    setTyped(message.length);
  };

  const fade = (on: boolean, transition: boolean) => {
    const el = text.current;
    if (!el) return;
    visible.current = on;
    el.style.transition = transition ? `opacity ${FADE_MS}ms ease` : "none";
    el.style.opacity = on ? "1" : "0";
  };

  useImperativeHandle(ref, () => ({
    reset() {
      clearTimeout(timer.current);
      finishTyping();
      fade(false, false);
    },
    hideMessage(transition = true) {
      clearTimeout(timer.current);
      finishTyping();
      fade(false, transition);
    },
    setMessage(next, transition = true) {
      clearTimeout(timer.current);
      if (!transition || !visible.current) {
        typeIn(next);
        fade(true, transition);
        return;
      }
      fade(false, true);
      timer.current = setTimeout(() => {
        typeIn(next);
        fade(true, true);
      }, FADE_MS);
    },
  }));

  const lines = message.slice(0, typed).split("\n");
  const typing = typed < message.length;

  return (
    <>
      <style>{CSS}</style>
      <svg
        viewBox="57 239 662 122"
        xmlns="http://www.w3.org/2000/svg"
        className={["current-message", className].filter(Boolean).join(" ")}
        style={{ position: "absolute", left: "1.9441%", top: "14.5024%", width: "22.5784%", height: "7.4029%", pointerEvents: "none", overflow: "visible", ...style }}
        {...svgProps}
      >
        <text
          ref={text}
          x={ORIGIN.x}
          y={ORIGIN.y}
          fill="#fff"
          fillOpacity={0.73}
          fontFamily='"Helvetica Neue", Helvetica, Arial, sans-serif'
          fontWeight={500}
          fontSize={FONT_SIZE}
          aria-label={message.replace(/\n/g, " ")}
          data-name="level two... restoration of water to the region"
          style={{ opacity: 0 }}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={ORIGIN.x} dy={i === 0 ? 0 : LEADING}>
              {line}
              {typing && i === lines.length - 1 && <tspan className="message-cursor">|</tspan>}
            </tspan>
          ))}
        </text>
      </svg>
    </>
  );
}
