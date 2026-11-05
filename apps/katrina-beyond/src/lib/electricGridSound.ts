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

const STORM_SRC = "/electric-grid/storm.wav";
let stormBuffer: AudioBuffer | null = null;
let stormLoad: Promise<void> | null = null;
let storm: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

/** Fetches and decodes the storm sound once; safe to call early (e.g. from `begin`). */
export function preloadStorm() {
  if (!ctx || stormBuffer || stormLoad) return;
  const c = ctx;
  stormLoad = fetch(STORM_SRC)
    .then((r) => r.arrayBuffer())
    .then((data) => c.decodeAudioData(data))
    .then((buf) => {
      stormBuffer = buf;
    })
    .catch(() => {
      stormLoad = null;
    });
}

/** Plays the 10 s rain-and-thunder clip (it fades itself in and out). Replaces any storm already playing. */
export function playStorm() {
  stopStorm(0);
  if (!ctx || muted || ctx.state !== "running" || !stormBuffer) return;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = stormBuffer;
  source.connect(gain).connect(ctx.destination);
  source.start();
  source.onended = () => {
    if (storm?.source === source) storm = null;
  };
  storm = { source, gain };
}

/** Fades the storm out over `fadeMs` (0 cuts it immediately). */
export function stopStorm(fadeMs = 600) {
  if (!ctx || !storm) return;
  const { source, gain } = storm;
  storm = null;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
  source.stop(t + fadeMs / 1000 + 0.02);
}

export const buzz =() => tone(110, 350, "sawtooth");
export const cheer = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 180), i * 120));
