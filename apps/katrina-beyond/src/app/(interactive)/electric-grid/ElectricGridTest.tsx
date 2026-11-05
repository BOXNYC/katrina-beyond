"use client";

import { useEffect, useRef, useState } from "react";
import ElectricGridMap, { type ElectricGridMapHandle } from "./ElectricGridMap";

type Action = [label: string, run: (m: ElectricGridMapHandle) => void];

const groups: [title: string, actions: Action[]][] = [
  [
    "Map",
    [
      ["reset", (m) => m.reset()],
    ],
  ],
  [
    "Zones",
    [
      ["showZones fade, 400ms stagger", (m) => m.showZones([1, 3, 19, 24], true, 400)],
      ["showZones instant", (m) => m.showZones([2, 4, 5])],
      ["hideZones", (m) => m.hideZones()],
      ["color: all", (m) => m.setZoneColor("#1e3a8a")],
      ["color: 3 & 19", (m) => m.setZoneColor("orange", [3, 19])],
    ],
  ],
  [
    "Icons",
    [
      ["firestation + police", (m) => m.showIcons(["firestation", "police"])],
      ["power", (m) => m.showIcons("power")],
      ["shelter", (m) => m.showIcons("shelter")],
      ["hideIcons", (m) => m.hideIcons()],
    ],
  ],
  [
    "Exit paths",
    [
      ["showExitPaths (fade)", (m) => m.showExitPaths(true)],
      ["showExitPaths instant", (m) => m.showExitPaths()],
      ["hideExitPaths (fade)", (m) => m.hideExitPaths(true)],
      ["hideExitPaths instant", (m) => m.hideExitPaths()],
    ],
  ],
  [
    "Level",
    [
      ["complete power, water", (m) => m.level.completeLevels(["power", "water"])],
      ["complete #4", (m) => m.level.completeLevels(4)],
      ["incomplete water", (m) => m.level.incompleteLevels("water")],
      ["setProgress 0", (m) => m.level.setProgress(0, true)],
      ["setProgress 2/7", (m) => m.level.setProgress(2 / 7, true)],
      ["setProgress 1", (m) => m.level.setProgress(1, true)],
      ["pulse water", (m) => m.level.pulse("water")],
      ["pulse slots 1 & 2", (m) => m.level.pulse([1, 2])],
      ["reset", (m) => m.level.reset()],
    ],
  ],
  [
    "Message",
    [
      ["setMessage (two lines)", (m) => m.message.setMessage("level two... restoration of\nwater to the region")],
      ["hideMessage", (m) => m.message.hideMessage()],
      ["reset", (m) => m.message.reset()],
    ],
  ],
  [
    "Instruction",
    [
      ...([1, 2, 3, 4, 5, 6] as const).map((n): Action => [`showInstruction level-${n}`, (m) => m.instruction.showInstruction(`level-${n}`)]),
      ["showInstruction 1 (number)", (m) => m.instruction.showInstruction(1)],
      ["showReplay", (m) => m.instruction.showReplay()],
      ["hideReplay", (m) => m.instruction.hideReplay()],
      ["hide", (m) => m.instruction.hideInstruction()],
      ["reset", (m) => m.instruction.reset()],
    ],
  ],
];

const MENU_WIDTH = 260;

/** Right-click anywhere on the map to call each ElectricGridMap function. */
export default function ElectricGridTest() {
  const map = useRef<ElectricGridMapHandle>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: Math.min(e.clientX, window.innerWidth - MENU_WIDTH), y: e.clientY });
      }}
    >
      <ElectricGridMap ref={map} onReplay={() => console.log("replay clicked")} />
      {menu && (
        <div
          style={{
            position: "fixed",
            left: menu.x,
            top: menu.y,
            width: MENU_WIDTH,
            maxHeight: `calc(100vh - ${menu.y}px - 8px)`,
            overflowY: "auto",
            padding: 4,
            background: "#fff",
            color: "#111",
            font: "13px system-ui, sans-serif",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,.4)",
            zIndex: 10,
          }}
        >
          {groups.map(([title, actions]) => (
            <div key={title}>
              <div style={{ padding: "6px 8px 2px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", opacity: 0.55 }}>
                {title}
              </div>
              {actions.map(([label, run]) => (
                <button
                  key={label}
                  onClick={() => run(map.current!)}
                  style={{ display: "block", width: "100%", padding: "5px 8px", textAlign: "left", background: "none", border: 0, borderRadius: 4, cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e7eb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
