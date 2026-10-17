import type { Level, Levels, ModifierId } from "./barrierIsland";

/**
 * Messages sent to the physical model: one JSON object per line (newline
 * delimited) over TCP. Levels are 0 (off/none), 1 (medium) or 2 (on/high);
 * only the levee uses 1.
 */
export type ModelMessage =
  | { command: "set"; option: ModifierId; level: Level }
  | { command: "simulate"; severity: string; options: Levels };

export const encode = (m: ModelMessage) => JSON.stringify(m) + "\n";

/** Same surface for the TCP (native) and console (web) implementations. */
export type ModelLink = {
  sendOption: (option: ModifierId, level: Level) => void;
  sendSimulate: (severity: string, options: Levels) => void;
};
