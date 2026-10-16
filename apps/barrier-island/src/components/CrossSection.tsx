import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { effectiveLevels, type Levels } from "../lib/barrierIsland";

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
    <Svg
      viewBox="0 0 800 260"
      width="100%"
      style={{ aspectRatio: 800 / 260, borderRadius: 12 }}
      accessibilityRole="image"
      accessibilityLabel="Cross-section from the Gulf to a community, showing the active defenses"
    >
      <Rect width={800} height={260} fill="#cfe8f7" />
      {/* Gulf, and open water in the marsh zone */}
      <Rect y={180} width={800} height={80} fill="#2d6fa3" />
      {/* barrier island */}
      {island > 0 && (
        <Path
          d={`M120 ${ground} Q190 ${ground - island * 1.6} 270 ${ground}Z`}
          fill="#e3c88f"
        />
      )}
      {/* marsh: green with grass when healthy, open water when lost */}
      <Rect x={270} y={ground - 4} width={190} height={70} fill={tufts > 0 ? "#6b8f4e" : "#2d6fa3"} />
      {Array.from({ length: tufts }, (_, i) => {
        const x = 292 + i * (150 / Math.max(tufts - 1, 1));
        return (
          <Path
            key={i}
            d={`M${x} ${ground - 4} q-6 -26 -10 -30 M${x} ${ground - 4} q0 -30 0 -36 M${x} ${ground - 4} q6 -26 10 -30`}
            stroke="#3f7d2c"
            strokeWidth={3}
            fill="none"
          />
        );
      })}
      {marshLost && (
        <SvgText x={365} y={ground - 20} textAnchor="middle" fontSize={13} fill="#7f1d1d">
          marsh washed away
        </SvgText>
      )}
      {/* levee: broad landform */}
      <Path d={`M460 ${ground} L490 ${ground - levee} L560 ${ground - levee} L600 ${ground}Z`} fill="#8b7a4f" />
      {/* seawall: concrete with riprap */}
      {wall > 0 && (
        <G>
          <Rect x={600} y={ground - wall} width={14} height={wall} fill="#9aa0a8" />
          <Circle cx={594} cy={ground - 4} r={7} fill="#6d7178" />
          <Circle cx={584} cy={ground - 6} r={6} fill="#7d838b" />
        </G>
      )}
      {/* community ground */}
      <Rect x={614} y={ground} width={186} height={70} fill="#4f7a3a" />
      {[650, 740].map((x) => (
        <G key={x}>
          <Rect x={x + 4} y={ground - 20} width={4} height={20} fill="#5b4636" />
          <Rect x={x + 30} y={ground - 20} width={4} height={20} fill="#5b4636" />
          <Rect x={x} y={ground - 50} width={38} height={30} fill="#a85d4a" />
          <Path d={`M${x - 4} ${ground - 50} L${x + 19} ${ground - 70} L${x + 42} ${ground - 50}Z`} fill="#3b4a63" />
        </G>
      ))}
      {/* car on the ground */}
      <Rect x={696} y={ground - 12} width={34} height={12} rx={4} fill="#c2c7d0" />
      <Circle cx={704} cy={ground} r={4} fill="#222" />
      <Circle cx={722} cy={ground} r={4} fill="#222" />

      <G fontSize={13} fontWeight="600" fill="#0b2f4a">
        <SvgText x={20} y={24}>GULF</SvgText>
        <SvgText x={150} y={24}>BARRIER ISLAND</SvgText>
        <SvgText x={300} y={24}>MARSH</SvgText>
        <SvgText x={495} y={24}>LEVEE</SvgText>
        <SvgText x={670} y={24}>COMMUNITY</SvgText>
      </G>
    </Svg>
  );
}
