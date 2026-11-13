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

/** Schedules one enveloped note on the audio clock (`at` seconds from now). Silent when muted or locked. */
function note(freq: number, at: number, dur: number, type: OscillatorType = "triangle", vol = 0.16) {
  if (!ctx || muted || ctx.state !== "running") return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Plays [freq, start, dur] notes as a melody over a soft octave-below layer, so it reads as a tune rather than beeps. */
function tune(notes: [number, number, number][], vol = 0.15) {
  notes.forEach(([f, at, dur]) => {
    note(f, at, dur, "triangle", vol);
    note(f / 2, at, dur, "sine", vol * 0.35);
  });
}

/** Level payoff jingle (~3 s): a bouncing C-major phrase that answers itself and lands on a held chord. */
export function levelJingle() {
  tune([
    [523.25, 0, 0.25], [659.25, 0.25, 0.25], [783.99, 0.5, 0.25], [659.25, 0.75, 0.25], [783.99, 1.0, 0.25], [1046.5, 1.25, 0.25],
    [880, 1.5, 0.25], [783.99, 1.75, 0.25], [659.25, 2.0, 0.25],
    [1046.5, 2.25, 0.75],
  ]);
  [130.81, 196, 130.81].forEach((f, i) => note(f, [0, 1.5, 2.25][i], i === 2 ? 0.75 : 1.4, "sine", 0.14)); // bass
  [523.25, 659.25, 783.99].forEach((f) => note(f, 2.25, 0.75, "sine", 0.07)); // closing chord
}

/** Final payoff jingle (~6 s): a two-part fanfare, a rising question then a climbing answer, ending on a big held chord with sparkle. */
export function finalJingle() {
  tune([
    [523.25, 0, 0.25], [659.25, 0.25, 0.25], [783.99, 0.5, 0.25], [1046.5, 0.75, 0.25], [1318.5, 1.0, 0.5],
    [1174.7, 1.5, 0.25], [1046.5, 1.75, 0.25], [783.99, 2.0, 0.5], [880, 2.5, 0.25], [987.77, 2.75, 0.25],
    [1046.5, 3.0, 0.25], [1318.5, 3.25, 0.25], [1568, 3.5, 0.25], [1318.5, 3.75, 0.25], [1174.7, 4.0, 0.5],
    [880, 4.5, 0.25], [987.77, 4.75, 0.25],
    [1046.5, 5.0, 1.0],
  ]);
  [130.81, 174.61, 196, 130.81].forEach((f, i) => note(f, [0, 1.5, 3, 5][i], i === 3 ? 1.0 : 1.4, "sine", 0.14)); // bass
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => note(f, 5.0, 1.0, "sine", 0.08)); // closing chord
  [2093, 2637, 3136, 4186].forEach((f, i) => note(f, 5.0 + i * 0.12, 0.5, "sine", 0.05)); // sparkle
}

/** Typing volume; the whole key strike below is scaled by this. */
const TYPE_VOL = 0.12;

/** A decaying noise burst (`ms` long) through a filter, `at` seconds from now. */
function noiseBurst(at: number, ms: number, filter: BiquadFilterType, freq: number, q: number, vol: number) {
  if (!ctx) return;
  const len = Math.floor((ctx.sampleRate * ms) / 1000);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol * TYPE_VOL;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + at);
}

/**
 * Typewriter keystroke in two beats: a tiny key-press tick, then the type bar striking the platen — a mid "clack"
 * with a short metallic ring and a dull body thud. Pitch varies slightly per key.
 */
export function typeTick() {
  if (!ctx || muted || ctx.state !== "running") return;
  const t = ctx.currentTime;
  const v = 0.9 + Math.random() * 0.2;
  noiseBurst(0, 10, "highpass", 3500, 0.7, 0.5); // key press
  noiseBurst(0.022, 45, "bandpass", 1300 * v, 1.6, 1.4); // strike
  const ring = ctx.createOscillator();
  const ringGain = ctx.createGain();
  ring.type = "sine";
  ring.frequency.value = 3100 * v;
  ringGain.gain.setValueAtTime(0.0001, t + 0.022);
  ringGain.gain.exponentialRampToValueAtTime(0.25 * TYPE_VOL, t + 0.025);
  ringGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  ring.connect(ringGain).connect(ctx.destination);
  ring.start(t + 0.022);
  ring.stop(t + 0.1);
  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = "sine";
  thud.frequency.setValueAtTime(150 * v, t + 0.022);
  thud.frequency.exponentialRampToValueAtTime(60, t + 0.07);
  thudGain.gain.setValueAtTime(0.0001, t + 0.022);
  thudGain.gain.exponentialRampToValueAtTime(0.9 * TYPE_VOL, t + 0.026);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  thud.connect(thudGain).connect(ctx.destination);
  thud.start(t + 0.022);
  thud.stop(t + 0.09);
}

/** Short whoosh-tick for one zone switching off; pitch falls as `index` approaches `total`, so the run sweeps down. */
export function zoneTick(index = 0, total = 1) {
  if (!ctx || muted || ctx.state !== "running") return;
  const k = total > 1 ? index / (total - 1) : 0;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(900 - k * 400, t);
  osc.frequency.exponentialRampToValueAtTime(260 - k * 100, t + 0.18);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.14, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.25);
}

/** Soft rising pop for one icon growing on in the final reveal; pitch climbs as `index` approaches `total`, so the run swells up. */
export function popTick(index = 0, total = 1) {
  const k = total > 1 ? index / (total - 1) : 0;
  tone(420 + k * 900, 110, "sine");
}

/** Simon-style chime notes, one per color (blue, green, red, yellow): a major-triad-ish set so any order sounds pleasant yet each color is distinct. */
export const SIMON_NOTES = [329.63, 392, 523.25, 659.25];

/** Bell-like chime for one Simon color (index into SIMON_NOTES, wraps): a clear sine with a soft octave overtone and a longer ring. */
export function simonChime(index: number) {
  const f = SIMON_NOTES[index % SIMON_NOTES.length];
  note(f, 0, 0.7, "sine", 0.2);
  note(f * 2, 0, 0.35, "sine", 0.06);
}

export const buzz =() => tone(110, 350, "sawtooth");
export const cheer = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 180), i * 120));
