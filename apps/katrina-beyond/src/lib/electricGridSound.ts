let ctx: AudioContext | null = null;
let muted = false;

/** Call from a user gesture; browsers block audio until then. */
export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function setMuted(value: boolean) {
  muted = value;
}

export function tone(freq: number, ms = 250, type: OscillatorType = "sine") {
  if (!ctx || muted || ctx.state !== "running") return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + ms / 1000 + 0.05);
}

export const buzz = () => tone(110, 350, "sawtooth");
export const cheer = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 180), i * 120));
