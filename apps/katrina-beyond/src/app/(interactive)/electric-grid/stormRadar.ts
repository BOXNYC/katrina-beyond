/** Map units the shader's zone cells are expressed in (matches the SVG viewBox). */
const MAP_W = 2932;
const MAP_H = 1648;
const MAX_CELLS = 24;

const VERT = `attribute vec2 a; varying vec2 vUv; void main() { vUv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;

/**
 * Weather-service Doppler look: each zone is a soft-edged storm cell; evolving domain-warped noise is added to
 * its intensity and the result is quantized onto reflectivity bands (cyan, greens, yellow, orange, red, magenta, white).
 * The whole system drifts east -> west like a radar loop.
 */
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec4 uCells[${MAX_CELLS}]; // center.xy, radius.xy in map units
uniform int uCount;
uniform float uTime;
uniform float uFade;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return v;
}

vec3 band(float v, out float alpha) {
  float k = floor(clamp(v, 0.0, 0.999) * 11.0);
  alpha = 0.9;
  if (k < 1.0) { alpha = 0.0; return vec3(0.0); }
  if (k < 2.0) { alpha = 0.5; return vec3(0.50, 0.77, 0.83); }
  if (k < 3.0) { alpha = 0.8; return vec3(0.36, 0.82, 0.44); }
  if (k < 4.0) return vec3(0.18, 0.66, 0.29);
  if (k < 5.0) return vec3(0.11, 0.54, 0.24);
  if (k < 6.0) return vec3(0.95, 0.88, 0.23);
  if (k < 7.0) return vec3(0.96, 0.65, 0.14);
  if (k < 8.0) return vec3(0.93, 0.35, 0.11);
  if (k < 9.0) return vec3(0.83, 0.13, 0.13);
  if (k < 10.0) return vec3(0.88, 0.25, 0.78);
  return vec3(1.0);
}

void main() {
  vec2 p = vec2(vUv.x * ${MAP_W}.0, (1.0 - vUv.y) * ${MAP_H}.0);
  // The system tracks east -> west, a touch north (map y points down). The cells creep along it...
  vec2 wind = normalize(vec2(-1.0, -0.25));
  float t = uTime - 4.0; // centered so cells sit over their zones mid-storm
  vec2 cellShift = wind * 26.0 * t;
  float env = 0.0;
  for (int i = 0; i < ${MAX_CELLS}; i++) {
    if (i >= uCount) break;
    vec4 c = uCells[i];
    float d = length((p - cellShift - c.xy) / c.zw);
    env = max(env, 0.8 * (1.0 - smoothstep(0.0, 1.0, d)));
  }
  // ...while the rain texture streams through them faster, like echoes on live radar, and slowly evolves.
  vec2 q = (p - wind * 70.0 * uTime) * 0.0085;
  vec2 warp = vec2(fbm(q + uTime * 0.05), fbm(q + 7.3 - uTime * 0.04));
  float n = fbm(q * 2.2 + warp * 1.6);
  float v = env * mix(0.35, 1.0, uFade) + 0.6 * n - 0.3;
  float a;
  vec3 col = band(v, a);
  a *= uFade;
  gl_FragColor = vec4(col * a, a);
}`;

export type StormRadar = {
  /** Fades in (and starts animating) storm cells over the given map-unit boxes. */
  show: (boxes: { x: number; y: number; width: number; height: number }[], fadeMs?: number) => void;
  hide: (fadeMs?: number) => void;
  /** Stops immediately and clears the canvas. */
  clear: () => void;
  destroy: () => void;
};

export function createStormRadar(canvas: HTMLCanvasElement): StormRadar | null {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) {
    console.warn("Storm radar: WebGL is not available.");
    return null;
  }

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.warn("Storm radar shader compile error:", gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("Storm radar shader failed:", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uCells = gl.getUniformLocation(prog, "uCells");
  const uCount = gl.getUniformLocation(prog, "uCount");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uFade = gl.getUniformLocation(prog, "uFade");

  let raf = 0;
  let fade = 0;
  let target = 0;
  let fadeMs = 1000;
  let last = 0;
  let time = 0;

  const draw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uTime, time);
    gl.uniform1f(uFade, fade);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const tick = (now: number) => {
    const dt = last ? now - last : 0;
    last = now;
    time += dt / 1000;
    const step = dt / fadeMs;
    fade = target > fade ? Math.min(target, fade + step) : Math.max(target, fade - step);
    draw();
    if (target === 0 && fade === 0) {
      raf = 0;
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    if (raf) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };

  return {
    show(boxes, ms = 2500) {
      const cells = new Float32Array(MAX_CELLS * 4);
      boxes.slice(0, MAX_CELLS).forEach((b, i) => cells.set([b.x + b.width / 2, b.y + b.height / 2, b.width / 2, b.height / 2], i * 4));
      gl.uniform4fv(uCells, cells);
      gl.uniform1i(uCount, Math.min(boxes.length, MAX_CELLS));
      fade = 0;
      time = 0;
      target = 1;
      fadeMs = ms;
      start();
    },
    hide(ms = 1000) {
      target = 0;
      fadeMs = ms;
      start();
    },
    clear() {
      cancelAnimationFrame(raf);
      raf = 0;
      fade = 0;
      target = 0;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    destroy() {
      // Don't lose the context: React strict mode remounts and re-requests it from the same canvas.
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
