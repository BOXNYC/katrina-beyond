"use client";

import { useEffect, useRef } from "react";
import barrierIsland, { effectiveSurgeFt, protectionShare } from "@/lib/barrierIsland";
import { useKioskSync, type KioskState } from "@/lib/barrierIslandSync";

/**
 * Water layer for the OLED in front of the physical model. Pure black is
 * unlit on an OLED, so only the water is visible and the model shows through.
 */
export default function BarrierIslandDisplay() {
  const state = useKioskSync("display", null);
  const stateRef = useRef<KioskState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const videoSrc = state
    ? barrierIsland.waterLayerSrc({
        severityId: state.severityId,
        levels: state.levels,
      })
    : undefined;
  const playVideo = !!videoSrc && state?.phase === "simulating";

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let level = barrierIsland.calmWaterFt; // current water height (ft)
    let last = performance.now();

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const s = stateRef.current;
      const phase = s?.phase ?? "idle";

      const surging = phase === "simulating" || phase === "result";
      const target = surging
        ? effectiveSurgeFt(s!.severityId, s!.levels)
        : barrierIsland.calmWaterFt;
      // The surge rises and then slows as it nears its final height, instead
      // of arriving as one breaking wave. More protection means a slower rise.
      const protection = surging ? protectionShare(s!.severityId, s!.levels) : 0;
      const tau = (barrierIsland.simulationMs / 1000 / 4) * (1 + protection * 1.5);
      const k = target > level ? 1 - Math.exp(-dt / tau) : 1 - Math.exp(-dt / (tau * 2));
      level += (target - level) * k;

      const choppy = phase === "idle" ? 0.4 : phase === "storm" || phase === "configure" ? 1 : 1.8;
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      const base = h - (level / barrierIsland.displayMaxSurgeFt) * h * 0.85;
      const t = now / 1000;
      for (let layer = 0; layer < 3; layer++) {
        const amp = (6 + layer * 4) * choppy;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) {
          const y =
            base +
            layer * 10 +
            Math.sin(x / (90 - layer * 20) + t * (1 + layer * 0.5)) * amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = `rgba(${30 + layer * 20}, ${110 + layer * 30}, ${190 + layer * 20}, ${0.45 + layer * 0.12})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playVideo) {
      v.currentTime = 0;
      void v.play();
    } else {
      v.pause();
    }
  }, [playVideo, videoSrc]);

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          className={`absolute inset-0 h-full w-full object-cover ${playVideo ? "" : "hidden"}`}
        />
      )}
    </div>
  );
}
