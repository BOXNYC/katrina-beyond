"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown"] as const;

export type IdlePromptOptions = {
  /** Only watch for inactivity while true (e.g. not on an attract screen). */
  active: boolean;
  /** Quiet time before "Are you still there?" appears. */
  timeoutMs?: number;
  /** How long the prompt waits before giving up and calling `onReset`. */
  countdownMs?: number;
  onReset: () => void;
};

/**
 * Shared inactivity timer for kiosk experiences. After `timeoutMs` without a pointer or key event,
 * `prompting` turns true and `secondsLeft` counts down; if `stay()` isn't called in time, `onReset` runs.
 * Pair it with <AreYouStillThere />.
 */
export function useIdlePrompt({ active, timeoutMs = 30_000, countdownMs = 30_000, onReset }: IdlePromptOptions) {
  const [prompting, setPrompting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(countdownMs / 1000));
  const lastActivity = useRef(0);
  const promptingRef = useRef(false);
  const resetRef = useRef(onReset);

  useEffect(() => {
    resetRef.current = onReset;
  });

  const stay = useCallback(() => {
    lastActivity.current = Date.now();
    promptingRef.current = false;
    setPrompting(false);
  }, []);

  useEffect(() => {
    if (!active) return;
    lastActivity.current = Date.now();
    let promptStart = 0;

    // While the prompt is up, only answering it (stay) counts, so a stray touch can't hide it.
    const mark = () => {
      if (!promptingRef.current) lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));

    const tick = window.setInterval(() => {
      const now = Date.now();
      if (!promptingRef.current) {
        if (now - lastActivity.current < timeoutMs) return;
        promptingRef.current = true;
        promptStart = now;
        setPrompting(true);
      }
      const left = countdownMs - (now - promptStart);
      if (left <= 0) {
        promptingRef.current = false;
        setPrompting(false);
        lastActivity.current = now;
        resetRef.current();
      } else setSecondsLeft(Math.ceil(left / 1000));
    }, 250);

    return () => {
      window.clearInterval(tick);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, mark));
      promptingRef.current = false;
    };
  }, [active, timeoutMs, countdownMs]);

  return { prompting: prompting && active, secondsLeft, stay };
}
