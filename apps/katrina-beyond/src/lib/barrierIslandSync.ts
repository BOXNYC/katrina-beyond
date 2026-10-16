"use client";

import { useEffect, useRef, useState } from "react";
import { neutralLevels, type Levels } from "./barrierIsland";

export type Phase = "idle" | "storm" | "configure" | "simulating" | "result";

export type KioskState = {
  phase: Phase;
  severityId: string;
  levels: Levels;
};

export const initialKioskState = (severityId: string): KioskState => ({
  phase: "idle",
  severityId,
  levels: neutralLevels(),
});

const CHANNEL = "barrier-island";

type Message = { type: "state"; state: KioskState } | { type: "hello" };

/**
 * Keeps the touchscreen controller and the OLED display in sync using a
 * BroadcastChannel (same browser, any window/tab). The controller owns the
 * state; the display just mirrors it.
 */
export function useKioskSync(
  role: "controller" | "display",
  state: KioskState | null,
): KioskState | null {
  const [remote, setRemote] = useState<KioskState | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const latest = useRef(state);

  useEffect(() => {
    latest.current = state;
    if (role === "controller" && state) {
      channel.current?.postMessage({ type: "state", state } satisfies Message);
    }
  }, [role, state]);

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<Message>) => {
      if (role === "display" && e.data.type === "state") setRemote(e.data.state);
      if (role === "controller" && e.data.type === "hello" && latest.current) {
        ch.postMessage({ type: "state", state: latest.current } satisfies Message);
      }
    };
    if (role === "display") ch.postMessage({ type: "hello" } satisfies Message);
    return () => {
      ch.close();
      channel.current = null;
    };
  }, [role]);

  return role === "display" ? remote : state;
}
