import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  CODE_TO_CHAR,
  MORSE_CODE_MAP,
  NODES,
  TEXT_POSITIONS,
} from "./constants";
import type { Node } from "./types";

interface CwBoardProps {
  currentPath: string;
}

export const CwBoard = ({ currentPath }: CwBoardProps) => {
  const { t } = useTranslation("common");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active node
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    let targetX = 0;
    if (currentPath) {
      const char = CODE_TO_CHAR[currentPath];
      if (char && NODES[char]) {
        targetX = NODES[char].x * 40;
      }
    }

    const container = scrollContainerRef.current;

    // SVG coordinate space: -400 to 400.
    // X=0 is at center (400px from left in SVG space).
    // pixelX in SVG = targetX + 400.
    // targetX is in unit coordinates (e.g. -0.8), * 40 scale already applied above?
    // Wait, original code: targetX = NODES[char].x * 40;
    // Original comment later says "pixelX = (targetX + 400) * scale;"
    // In original code NODES[char].x is small number like -0.8.
    // So targetX is e.g. -32.
    // -32 + 400 = 368.

    const svgWidth = container.scrollWidth;
    const viewPortWidth = 800; // viewBox width
    const scale = svgWidth / viewPortWidth;

    const pixelX = (targetX + 400) * scale;
    const containerWidth = container.clientWidth;

    const scrollTo = pixelX - containerWidth / 2;

    container.scrollTo({
      left: scrollTo,
      behavior: "smooth",
    });
  }, [currentPath]);

  const renderLine = (char: string, node: Node) => {
    if (node.type === "root" || !node.parent) return null;
    const parentNode = NODES[node.parent];
    if (!parentNode) return null;

    const SCALE = 40;
    const x1 = parentNode.x * SCALE;
    const y1 = parentNode.y * SCALE;
    const x2 = node.x * SCALE;
    const y2 = node.y * SCALE;

    let isActive = false;
    if (node.type === "hidden") {
      let hiddenCode = "";
      if (char === "_U2") hiddenCode = "..--";
      if (char === "IM") hiddenCode = "..--.";
      if (char === "MI") hiddenCode = "--..--";
      if (currentPath.startsWith(hiddenCode)) isActive = true;
    } else {
      const myCode = Object.keys(MORSE_CODE_MAP).find(
        (key) => MORSE_CODE_MAP[key] === char,
      );
      if (myCode && currentPath.startsWith(myCode)) isActive = true;
    }

    return (
      <path
        key={`line-${char}`}
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        className={`stroke-[1.5px] transition-all duration-150 ${
          isActive
            ? "stroke-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]"
            : "stroke-slate-800"
        }`}
      />
    );
  };

  const renderNode = (char: string, node: Node) => {
    if (node.type === "root" || node.type === "hidden" || !node.parent)
      return null;

    const parentNode = NODES[node.parent];
    if (!parentNode) return null;

    const SCALE = 40;
    const x2 = node.x * SCALE;
    const y2 = node.y * SCALE;

    const myCode = Object.keys(MORSE_CODE_MAP).find(
      (key) => MORSE_CODE_MAP[key] === char,
    );
    let isActive = false;
    let isTarget = false;
    if (myCode) {
      isActive = currentPath.startsWith(myCode);
      isTarget = myCode === currentPath;
    }

    let symbol = "dot";
    const isHorizontal = Math.abs(node.y - parentNode.y) < 0.1;
    if (node.x < 0 || (node.x === 0 && parentNode.x < 0)) {
      symbol = isHorizontal ? "dot" : "dash";
    } else {
      symbol = isHorizontal ? "dash" : "dot";
    }

    const pos = TEXT_POSITIONS[char] || "top";
    let textX = x2;
    let textY = y2;
    let anchor: "start" | "middle" | "end" = "middle";

    let gap = 3;
    const extraSpacingChars = new Set([
      "A",
      "W",
      "J",
      "1",
      "X",
      "/",
      "=",
      "N",
      "D",
      "B",
      "6",
      "G",
      "Z",
      "7",
      "C",
      "Q",
      ",",
      "Ö",
      "8",
      "9",
    ]);
    if (extraSpacingChars.has(char)) gap = 5;

    switch (pos) {
      case "top":
        textY -= (symbol === "dash" && !isHorizontal ? 6 : 3) + gap;
        break;
      case "left":
        textX -= (symbol === "dash" && isHorizontal ? 6 : 3) + gap;
        textY += 3;
        anchor = "end";
        break;
      case "right":
        textX += (symbol === "dash" && isHorizontal ? 6 : 3) + gap;
        textY += 3;
        anchor = "start";
        break;
    }

    const padColor = isActive ? "#ffcc00" : "#d4af37";
    const padStroke = isActive ? "#fff" : "#8d6e63";

    return (
      <g key={`node-${char}`}>
        <g transform={`translate(${x2}, ${y2})`}>
          {symbol === "dot" ? (
            <g>
              <circle
                r={3.5}
                fill={padColor}
                stroke={padStroke}
                strokeWidth="0.5"
              />
              <circle r={1} fill="#0d1b11" />
            </g>
          ) : isHorizontal ? (
            <g>
              <rect
                x={-6}
                y={-2.5}
                width={12}
                height={5}
                rx={1}
                fill={padColor}
                stroke={padStroke}
                strokeWidth="0.5"
              />
              <circle r={1} fill="#0d1b11" />
            </g>
          ) : (
            <g>
              <rect
                x={-2.5}
                y={-6}
                width={5}
                height={12}
                rx={1}
                fill={padColor}
                stroke={padStroke}
                strokeWidth="0.5"
              />
              <circle r={1} fill="#0d1b11" />
            </g>
          )}
        </g>
        <text
          x={textX}
          y={textY}
          textAnchor={anchor}
          className={`text-[12px] font-mono tracking-tighter select-none transition-all duration-100 ${
            isTarget
              ? "fill-white drop-shadow-[0_0_2px_white] font-bold"
              : "fill-white/80 font-medium"
          }`}
        >
          {char}
        </text>
      </g>
    );
  };

  return (
    <div className="flex-1 w-full max-w-7xl relative z-10 overflow-hidden flex flex-col justify-center my-2">
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar flex items-center"
      >
        <svg
          viewBox="-400 -30 800 280"
          className="h-full w-auto min-w-[800px] md:min-w-0 md:w-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] mx-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          <title>{t("tools.cw.circuit_board_visualization")}</title>
          {Object.entries(NODES).map(([char, node]) => renderLine(char, node))}

          <g transform="translate(0, 0)">
            <rect
              x="-8"
              y="-8"
              width="16"
              height="16"
              rx="2"
              className="fill-[#212121] stroke-[#d4af37] stroke-[0.5]"
            />
            <path
              d="M-8 -4 H-10 M-8 0 H-10 M-8 4 H-10 M8 -4 H10 M8 0 H10 M8 4 H10 M-4 -8 V-10 M0 -8 V-10 M4 -8 V-10 M-4 8 V10 M0 8 V10 M4 8 V10"
              stroke="#d4af37"
              strokeWidth="1"
            />
            <text
              x="0"
              y="2.5"
              textAnchor="middle"
              className="text-[5px] fill-[#d4af37] font-mono font-bold tracking-widest"
            >
              IC1
            </text>
          </g>

          {Object.entries(NODES).map(([char, node]) => renderNode(char, node))}
        </svg>
      </div>
    </div>
  );
};
