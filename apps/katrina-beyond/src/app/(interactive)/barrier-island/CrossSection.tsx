import { effectiveLevels, type Levels } from "@/lib/barrierIsland";

/**
 * Cross-section: Gulf -> barrier island -> marsh -> levee -> seawall ->
 * community (elevated homes, and cars sitting on the ground).
 */
export default function CrossSection({ levels }: { levels: Levels }) {
  const eff = effectiveLevels(levels);
  const island = [0, 34, 58][levels.barrierIsland];
  const levee = [0, 36, 62][levels.levee];
  const wall = [0, 22, 40][levels.seawall];
  const tufts = [0, 3, 6][eff.marsh];
  const marshLost = eff.marsh < levels.marsh;
  const ground = 190;

  return (
    <svg
      viewBox="0 0 800 260"
      className="w-full rounded-xl"
      role="img"
      aria-label="Cross-section from the Gulf to a community, showing the active defenses"
    >
      <rect width="800" height="260" fill="#cfe8f7" />
      {/* Gulf, and open water in the marsh zone */}
      <rect y="180" width="800" height="80" fill="#2d6fa3" />
      {/* barrier island */}
      {island > 0 && (
        <path
          d={`M120 ${ground} Q190 ${ground - island * 1.6} 270 ${ground}Z`}
          fill="#e3c88f"
        />
      )}
      {/* marsh: green with grass when healthy, open water when lost */}
      <rect x="270" y={ground - 4} width="190" height="70" fill={tufts > 0 ? "#6b8f4e" : "#2d6fa3"} />
      {Array.from({ length: tufts }, (_, i) => {
        const x = 292 + i * (150 / Math.max(tufts - 1, 1));
        return (
          <path
            key={i}
            d={`M${x} ${ground - 4} q-6 -26 -10 -30 M${x} ${ground - 4} q0 -30 0 -36 M${x} ${ground - 4} q6 -26 10 -30`}
            stroke="#3f7d2c"
            strokeWidth="3"
            fill="none"
          />
        );
      })}
      {marshLost && (
        <text x="365" y={ground - 20} textAnchor="middle" fontSize="13" fill="#7f1d1d">
          marsh washed away
        </text>
      )}
      {/* levee: broad landform */}
      <path d={`M460 ${ground} L${490} ${ground - levee} L${560} ${ground - levee} L${600} ${ground}Z`} fill="#8b7a4f" />
      {/* seawall: concrete with riprap */}
      {wall > 0 && (
        <g>
          <rect x="600" y={ground - wall} width="14" height={wall} fill="#9aa0a8" />
          <circle cx="594" cy={ground - 4} r="7" fill="#6d7178" />
          <circle cx="584" cy={ground - 6} r="6" fill="#7d838b" />
        </g>
      )}
      {/* community ground */}
      <rect x="614" y={ground} width="186" height="70" fill="#4f7a3a" />
      {[650, 740].map((x) => (
        <g key={x}>
          <rect x={x + 4} y={ground - 20} width="4" height="20" fill="#5b4636" />
          <rect x={x + 30} y={ground - 20} width="4" height="20" fill="#5b4636" />
          <rect x={x} y={ground - 50} width="38" height="30" fill="#a85d4a" />
          <path d={`M${x - 4} ${ground - 50} L${x + 19} ${ground - 70} L${x + 42} ${ground - 50}Z`} fill="#3b4a63" />
        </g>
      ))}
      {/* car on the ground */}
      <rect x="696" y={ground - 12} width="34" height="12" rx="4" fill="#c2c7d0" />
      <circle cx="704" cy={ground} r="4" fill="#222" />
      <circle cx="722" cy={ground} r="4" fill="#222" />

      <g fontSize="13" fontWeight="600" fill="#0b2f4a">
        <text x="20" y="24">GULF</text>
        <text x="150" y="24">BARRIER ISLAND</text>
        <text x="300" y="24">MARSH</text>
        <text x="495" y="24">LEVEE</text>
        <text x="670" y="24">COMMUNITY</text>
      </g>
    </svg>
  );
}
