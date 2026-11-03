import type { Levels } from "./barrierIsland";

/**
 * Text protocol with the physical show controller over TCP. Every message ends
 * with a carriage return (`\r`, hex 0D).
 *
 *   iPad -> controller, when the guest presses Simulate:
 *     `Sim,[island],[landbridge],[ridge],[levee]\r`   e.g. `Sim,0,1,0,2\r`
 *     island, landbridge, ridge: 0 or 1; levee: 0 thru 3.
 *
 *   controller -> iPad, when the simulation has finished:
 *     `Reset\r`
 */
export const TERMINATOR = "\r";
export const RESET_COMMAND = "Reset";

const onOff = (level: number) => (level > 0 ? 1 : 0);

export const encodeSimulate = (levels: Levels) =>
  `Sim,${onOff(levels.barrierIsland)},${onOff(levels.marsh)},${onOff(levels.ridge)},${levels.levee}${TERMINATOR}`;

/** Same surface for the TCP (native) and console (web) implementations. */
export type ModelLink = {
  sendSimulate: (levels: Levels) => void;
  /** Called when the controller reports the simulation is done. Returns an unsubscribe. */
  onReset: (listener: () => void) => () => void;
};
