"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref, type SVGProps } from "react";

export type LevelMessageHandle = {
  /** Hides the message without transition. */
  reset: () => void;
  /** Shows the message ("\n" breaks a line), crossfading from the one already showing. */
  setMessage: (text: string, transition?: boolean) => void;
  /** Hides the message. */
  hideMessage: (transition?: boolean) => void;
};

const FADE_MS = 500;

/** Placeholder text from the PSD. */
const DEFAULT_MESSAGE = "level two... restoration of\nwater to the region";

/** PSD type layer: HelveticaNeue-Medium 51.72px scaled 1.122 (58.08px), auto leading 120%, white at 73% fill. */
const FONT_SIZE = 58.08;
const LEADING = FONT_SIZE * 1.2;
const ORIGIN = { x: 57.16, y: 279.65 };

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
  const [message, setText] = useState(DEFAULT_MESSAGE);

  useEffect(() => () => clearTimeout(timer.current), []);

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
      fade(false, false);
    },
    hideMessage(transition = true) {
      clearTimeout(timer.current);
      fade(false, transition);
    },
    setMessage(next, transition = true) {
      clearTimeout(timer.current);
      if (!transition || !visible.current) {
        setText(next);
        fade(true, transition);
        return;
      }
      fade(false, true);
      timer.current = setTimeout(() => {
        setText(next);
        fade(true, true);
      }, FADE_MS);
    },
  }));

  return (
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
        data-name="level two... restoration of water to the region"
        style={{ opacity: 0 }}
      >
        {message.split("\n").map((line, i) => (
          <tspan key={i} x={ORIGIN.x} dy={i === 0 ? 0 : LEADING}>
            {line}
          </tspan>
        ))}
      </text>
    </svg>
  );
}
