import type { Level } from "@/lib/barrierIsland";

const W = 300;
const H = 64;
const STOPS = [24, 150, 276];
const edgeY = (x: number) => H - (x / W) * H;

/**
 * Three-stop slider drawn as a triangle that grows from low to high. A native
 * range input sits on top (invisible) so touch drag, tapping and keyboard
 * control all work.
 */
export default function LevelSlider({
  label,
  value,
  labels,
  disabled,
  onChange,
}: {
  label: string;
  value: Level;
  labels: readonly string[];
  disabled?: boolean;
  onChange: (level: Level) => void;
}) {
  const x = STOPS[value];
  const id = label.replace(/\W+/g, "-");

  return (
    <div className={`w-80 ${disabled ? "opacity-60" : ""}`}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H + 8}`} className="w-full" aria-hidden>
          <defs>
            <clipPath id={`fill-${id}`}>
              <rect x="0" y="0" width={x} height={H + 8} />
            </clipPath>
          </defs>
          <polygon points={`0,${H} ${W},${H} ${W},0`} fill="#1e293b" />
          <polygon
            points={`0,${H} ${W},${H} ${W},0`}
            fill="#0ea5e9"
            clipPath={`url(#fill-${id})`}
          />
          {STOPS.map((s) => (
            <line
              key={s}
              x1={s}
              x2={s}
              y1={edgeY(s)}
              y2={H}
              stroke="#020617"
              strokeWidth="2"
              strokeDasharray="3 4"
            />
          ))}
          <circle
            cx={x}
            cy={edgeY(x)}
            r="13"
            fill="#fff"
            stroke="#0369a1"
            strokeWidth="4"
          />
        </svg>
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={labels[value]}
          onChange={(e) => onChange(Number(e.target.value) as Level)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          style={{ touchAction: "pan-y" }}
        />
      </div>
      <div className="mt-1 flex justify-between text-center text-base">
        {([0, 1, 2] as const).map((l) => (
          <div
            key={l}
            className={`w-1/3 ${value === l ? "font-semibold text-sky-300" : "text-slate-400"}`}
          >
            {labels[l]}
          </div>
        ))}
      </div>
    </div>
  );
}
