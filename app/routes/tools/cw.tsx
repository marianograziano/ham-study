import {
  ActivityIcon,
  ArrowCounterClockwiseIcon,
  BackspaceIcon,
  GaugeIcon,
  TrashIcon,
  BookIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MetaFunction } from "react-router";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import resources from "~/locales";
import { getLocale } from "~/middleware/i18next";
import type { Route } from "./+types/cw";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const locale = getLocale(request);
  const t = await i18next.use(initReactI18next).init({
    lng: locale,
    ns: "common",
    resources,
  });
  return {
    title: t("tools.cw.title") + " | Ham Study",
    description: t("tools.cw.description"),
    keywords: t("tools.cw.keywords"),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "CW Trainer" }];
  const { title, description, keywords } = data;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "keywords", content: keywords },
  ];
};

interface Node {
  x: number;
  y: number;
  type?: string;
  parent?: string;
}

// === 1. 节点坐标定义 (Balanced Layout) ===
const NODES: Record<string, Node> = {
  // === ROOT ===
  START: { x: 0, y: 0, type: "root" },
  // ... (Structure is complex, I will copy it fully but ensure types)

  // ==============================
  // LEFT SIDE (DIT SIDE / E-SIDE)
  // ==============================

  // Row 0
  E: { x: -0.8, y: 0, parent: "START" },
  I: { x: -2.8, y: 0, parent: "E" },
  S: { x: -4.8, y: 0, parent: "I" },
  H: { x: -5.8, y: 0, parent: "S" },
  "5": { x: -6.6, y: 0, parent: "H" },

  // Level 1
  A: { x: -0.8, y: 0.7, parent: "E" },
  R: { x: -1.6, y: 0.7, parent: "A" },
  L: { x: -2.2, y: 0.7, parent: "R" },
  Ä: { x: -1.6, y: 1.3, parent: "R" },
  ".": { x: -1.6, y: 2.0, parent: "Ä" },

  U: { x: -2.8, y: 1.0, parent: "I" },
  V: { x: -4.8, y: 1.0, parent: "S" },
  "4": { x: -5.8, y: 1.0, parent: "H" },

  // Level 2
  W: { x: -0.8, y: 2.8, parent: "A" },
  P: { x: -1.5, y: 2.8, parent: "W" },

  // U sub-tree
  Ü: { x: -2.8, y: 1.8, parent: "U" },
  "2": { x: -2.8, y: 2.6, parent: "Ü" },

  // ?
  IM: { x: -3.2, y: 1.8, parent: "Ü", type: "hidden" },
  "?": { x: -3.8, y: 1.8, parent: "IM" },

  F: { x: -3.6, y: 1.0, parent: "U" },
  "3": { x: -4.8, y: 2.2, parent: "V" },

  // Deep Drops
  J: { x: -0.8, y: 4.0, parent: "W" },
  "1": { x: -0.8, y: 5.2, parent: "J" },

  // ==============================
  // RIGHT SIDE (DAH SIDE / T-SIDE)
  // ==============================

  // Row 0
  T: { x: 0.8, y: 0, parent: "START" },
  M: { x: 3.2, y: 0, parent: "T" },
  O: { x: 5.2, y: 0, parent: "M" },
  CH: { x: 6.2, y: 0, parent: "O" },
  "0": { x: 7.0, y: 0, parent: "CH" },

  // Level 1
  N: { x: 0.8, y: 0.7, parent: "T" },
  K: { x: 1.8, y: 0.7, parent: "N" },
  Y: { x: 2.8, y: 0.7, parent: "K" },

  G: { x: 3.2, y: 1.0, parent: "M" },
  Ö: { x: 5.2, y: 1.0, parent: "O" },
  "8": { x: 5.2, y: 2.2, parent: "Ö" },
  "9": { x: 6.2, y: 1.0, parent: "CH" },

  // N Sub-tree
  D: { x: 0.8, y: 1.9, parent: "N" },
  B: { x: 0.8, y: 3.1, parent: "D" },
  "6": { x: 0.8, y: 4.3, parent: "B" },

  "=": { x: 1.6, y: 3.1, parent: "B" },

  X: { x: 1.6, y: 1.9, parent: "D" },
  "/": { x: 1.6, y: 2.6, parent: "X" },

  C: { x: 1.8, y: 1.4, parent: "K" },

  // M Sub-tree
  Q: { x: 4.2, y: 1.0, parent: "G" },
  Z: { x: 3.2, y: 2.2, parent: "G" },
  "7": { x: 3.2, y: 3.4, parent: "Z" },

  MI: { x: 3.8, y: 2.2, parent: "Z", type: "hidden" },
  ",": { x: 4.4, y: 2.2, parent: "MI" },
};

const MORSE_CODE_MAP: Record<string, string> = {
  ".-": "A",
  "-...": "B",
  "-.-.": "C",
  "-..": "D",
  ".": "E",
  "..-.": "F",
  "--.": "G",
  "....": "H",
  "..": "I",
  ".---": "J",
  "-.-": "K",
  ".-..": "L",
  "--": "M",
  "-.": "N",
  "---": "O",
  ".--.": "P",
  "--.-": "Q",
  ".-.": "R",
  "...": "S",
  "-": "T",
  "..-": "U",
  "...-": "V",
  ".--": "W",
  "-..-": "X",
  "-.--": "Y",
  "--..": "Z",
  ".----": "1",
  "..---": "2",
  "...--": "3",
  "....-": "4",
  ".....": "5",
  "-....": "6",
  "--...": "7",
  "---..": "8",
  "----.": "9",
  "-----": "0",
  "----": "CH",
  "---.": "Ö",
  ".-.-": "Ä",
  "..--": "Ü",
  "..--.": "Ð",
  "-..-.": "/",
  "..--..": "?",
  ".-.-.-": ".",
  "-...-": "=",
  "--..--": ",",
};

const CODE_TO_CHAR = Object.fromEntries(
  Object.entries(MORSE_CODE_MAP).map(([k, v]) => [k, v]),
);

// === 文字位置配置 ===
const TEXT_POSITIONS: Record<string, string> = {
  E: "top",
  I: "top",
  S: "top",
  H: "top",
  "5": "top",
  R: "top",
  L: "top",
  T: "top",
  M: "top",
  O: "top",
  CH: "top",
  "0": "top",
  K: "top",
  Y: "top",

  A: "right",
  W: "right",
  J: "right",
  "1": "right",
  U: "right",
  "2": "right",
  Ü: "right",
  Q: "right",
  "8": "right",
  "9": "right",
  C: "right",
  X: "right",
  Ö: "right",
  Ä: "right",
  "=": "right",
  ",": "right",
  "/": "right",
  ".": "right",

  N: "left",
  D: "left",
  B: "left",
  "6": "left",
  G: "left",
  Z: "left",
  "7": "left",
  "4": "left",
  V: "left",
  "3": "left",
  F: "left",
  P: "left",
  "?": "left",
  Ð: "top",
};

// === 速度预设配置 ===
type SpeedMode = "beginner" | "intermediate" | "advanced";

interface SpeedSetting {
  id: SpeedMode;
  label: "slow" | "med" | "fast";
  desc: "beginner" | "intermediate" | "advanced";
  charDelay: number;
  wordDelay: number;
}

const SPEED_SETTINGS: Record<SpeedMode, SpeedSetting> = {
  beginner: {
    id: "beginner",
    label: "slow",
    desc: "beginner",
    charDelay: 2000,
    wordDelay: 4000,
  },
  intermediate: {
    id: "intermediate",
    label: "med",
    desc: "intermediate",
    charDelay: 1000,
    wordDelay: 2200,
  },
  advanced: {
    id: "advanced",
    label: "fast",
    desc: "advanced",
    charDelay: 600,
    wordDelay: 1200,
  },
};

const ReferenceList = ({
  title,
  filter,
  twoCols = false,
}: {
  title: string;
  filter: (char: string) => boolean;
  twoCols?: boolean;
}) => {
  return (
    <div className="bg-[#1a2e22]/90 border border-[#2c3e30] rounded-lg p-3 shadow-lg backdrop-blur-sm w-full">
      <div className="text-[10px] text-[#4caf50] font-bold tracking-widest border-b border-[#2c5c3e] pb-1 mb-2 text-center">
        {title}
      </div>
      <div
        className={`grid ${twoCols ? "grid-cols-2" : "grid-cols-1"} gap-x-4 gap-y-1 text-xs font-mono`}
      >
        {Object.entries(MORSE_CODE_MAP)
          .filter(([_, char]) => filter(char))
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([code, char]) => (
            <div
              key={char}
              className="flex justify-between items-center text-[#a5d6a7]/80 hover:text-white transition-colors"
            >
              <span className="font-bold w-4 md:w-6">{char}</span>
              <span className="tracking-widest text-[#4caf50]">{code}</span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default function CwTrainer() {
  const { t } = useTranslation("common");
  const [currentPath, setCurrentPath] = useState("");
  const [lastChar, setLastChar] = useState("");
  const [message, setMessage] = useState("");
  const [isSoundEnabled] = useState(true);
  const [activeSignal, setActiveSignal] = useState<string | null>(null);
  const [speedMode, setSpeedMode] = useState<SpeedMode>("intermediate");
  const [showRef, setShowRef] = useState(false);

  const charTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentSpeed = SPEED_SETTINGS[speedMode];

  // Auto-scroll to active node
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    let targetX = 0;
    if (currentPath) {
      const char = CODE_TO_CHAR[currentPath];
      if (char && NODES[char]) {
        targetX = NODES[char].x * 40;
      } else {
        // If current path doesn't match a clear node yet (incomplete),
        // try to follow the path visually or just keep center?
        // Actually, let's try to find the last valid node or just stay centered if unknown.
        // For partial matches that don't map to a char (like just "."), CODE_TO_CHAR["."] is "E", so it works.
        // But what if it's ".-.-" (Ä) -> it works.
        // If it's something invalid?
      }
    }

    // SVG coordinate space: -400 to 400.
    // X=0 is at center (400px from left in SVG space).
    // pixelX in SVG = targetX + 400.

    // We want this pixelX to be in the center of the container.
    const container = scrollContainerRef.current;

    // However, the SVG is scaled to fit height or width.
    // On mobile (overflowing), the SVG has min-width 800px.
    // If exact 800px width, then 1 SVG unit = 1 px.
    // If wider, we need to account for scale.
    // But since we set h-full and w-auto, and the container handles overflow.
    // And min-width is 800px.
    // Let's assume standard 1:1 mapping for simplicity first, or calculate scale.

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

  // 自动清除大字提示 (Fix: Clear lastChar after 800ms)
  useEffect(() => {
    if (lastChar) {
      const timer = setTimeout(() => {
        setLastChar("");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [lastChar]);

  const cycleSpeed = () => {
    setSpeedMode((prev) => {
      if (prev === "beginner") return "intermediate";
      if (prev === "intermediate") return "advanced";
      return "beginner";
    });
  };

  const playBeep = useCallback(
    (duration: number, type: OscillatorType = "sine") => {
      if (!isSoundEnabled) return;
      try {
        const audioCtx = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = type;

        const freq = type === "sawtooth" ? 150 : 800;
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

        const now = audioCtx.currentTime;
        const attack = 0.005;
        const release = 0.005;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + attack);
        gainNode.gain.setValueAtTime(0.1, now + duration - release);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(now + duration + 0.1);
      } catch (_e) {}
    },
    [isSoundEnabled],
  );

  const triggerSignal = useCallback((type: string) => {
    setActiveSignal(type);
    setTimeout(() => setActiveSignal(null), 150);
  }, []);

  const clearTimers = useCallback(() => {
    if (charTimeoutRef.current) clearTimeout(charTimeoutRef.current);
    if (wordTimeoutRef.current) clearTimeout(wordTimeoutRef.current);
  }, []);

  const addDit = useCallback(() => {
    if (currentPath.length < 8) {
      clearTimers();
      setCurrentPath((prev) => `${prev}.`);
      playBeep(0.08);
      triggerSignal("dit");
    }
  }, [currentPath, triggerSignal, clearTimers, playBeep]);

  const addDah = useCallback(() => {
    if (currentPath.length < 8) {
      clearTimers();
      setCurrentPath((prev) => `${prev}-`);
      playBeep(0.2);
      triggerSignal("dah");
    }
  }, [currentPath, triggerSignal, clearTimers, playBeep]);

  const commitChar = useCallback(() => {
    if (currentPath) {
      const char = CODE_TO_CHAR[currentPath];
      if (char) {
        setLastChar(char);
        setMessage((prev) => `${prev}${char}`);
      } else {
        setMessage((prev) => `${prev}?`);
      }
      setCurrentPath("");

      wordTimeoutRef.current = setTimeout(() => {
        setMessage((prev) => (prev.endsWith(" ") ? prev : `${prev} `));
      }, currentSpeed.wordDelay);
    }
  }, [currentPath, currentSpeed]);

  const handleBackspace = useCallback(() => {
    if (currentPath.length > 0) {
      setCurrentPath((prev) => prev.slice(0, -1));
      clearTimers();
      if (currentPath.length > 1) {
        charTimeoutRef.current = setTimeout(() => {
          commitChar();
        }, currentSpeed.charDelay);
      }
    } else {
      setMessage((prev) => prev.slice(0, -1));
    }
  }, [currentPath, commitChar, currentSpeed, clearTimers]);

  // Watch for Error Signal (8 dots)
  useEffect(() => {
    if (currentPath === "........") {
      clearTimers();
      setCurrentPath("");
      setMessage((prev) => prev.slice(0, -1));
      setLastChar("DEL");
      playBeep(0.3, "sawtooth");
      return;
    }

    if (currentPath) {
      charTimeoutRef.current = setTimeout(() => {
        commitChar();
      }, currentSpeed.charDelay);
    }
    return () => clearTimers();
  }, [currentPath, commitChar, currentSpeed, clearTimers, playBeep]);

  const reset = useCallback(() => {
    setCurrentPath("");
    setLastChar("");
    setMessage("");
    clearTimers();
    inputRef.current?.blur();
  }, [clearTimers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "." || e.key === "ArrowLeft" || e.key.toLowerCase() === "j")
        addDit();
      if (
        e.key === "-" ||
        e.key === "ArrowRight" ||
        e.key.toLowerCase() === "k"
      )
        addDah();
      if (e.key === "Enter") commitChar();
      if (e.key === " ") {
        e.preventDefault();
        commitChar();
        setTimeout(
          () => setMessage((prev) => (prev.endsWith(" ") ? prev : `${prev} `)),
          10,
        );
      }
      if (e.key === "Backspace") {
        handleBackspace();
      }
      if (e.key === "Escape") reset();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addDit, addDah, commitChar, handleBackspace, reset]);

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
    <div className="min-h-screen w-full bg-[#0d1b11] flex flex-col items-center font-mono relative select-none text-[#a5d6a7]">
      {/* Background Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 h-full"
        style={{
          backgroundImage: `
               radial-gradient(#1b5e20 1px, transparent 1px),
               radial-gradient(#1b5e20 1px, transparent 1px)
             `,
          backgroundSize: "10px 10px",
          backgroundPosition: "0 0, 5px 5px",
        }}
      ></div>

      <div className="relative h-[80dvh] w-full flex flex-col items-center justify-between overflow-hidden p-4 z-10">
        {/* 左侧参考面板：字母 (Desktop) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-4 z-20 max-h-[80%] overflow-y-auto custom-scrollbar pointer-events-auto w-60">
          <ReferenceList
            title={t("tools.cw.panel.letters")}
            filter={(c) => /^[A-Z]$/.test(c)}
            twoCols
          />
        </div>

        {/* 右侧参考面板：数字与符号 (Desktop) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-4 z-20 max-h-[80%] overflow-y-auto custom-scrollbar pointer-events-auto w-36">
          <ReferenceList
            title={t("tools.cw.panel.numbers")}
            filter={(c) => /^[0-9]$/.test(c)}
          />
          <ReferenceList
            title={t("tools.cw.panel.symbols")}
            filter={(c) =>
              !/^[A-Z0-9]$/.test(c) && !["CH", "Ä", "Ö", "Ü", "Ð"].includes(c)
            }
          />
        </div>

        {/* Mobile Reference Overlay */}
        {showRef && (
          <div className="absolute inset-0 z-50 bg-[#0d1b11]/95 backdrop-blur-md p-4 overflow-y-auto flex flex-col gap-4 md:hidden">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-[#4caf50] font-bold">
                {t("tools.cw.panel.morse_code_reference")}
              </h3>
              <button
                type="button"
                onClick={() => setShowRef(false)}
                className="p-2 text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 pb-10">
              <ReferenceList
                title={t("tools.cw.panel.letters")}
                filter={(c) => /^[A-Z]$/.test(c)}
                twoCols
              />
              <div className="grid grid-cols-2 gap-4">
                <ReferenceList
                  title={t("tools.cw.panel.numbers")}
                  filter={(c) => /^[0-9]$/.test(c)}
                />
                <ReferenceList
                  title={t("tools.cw.panel.symbols")}
                  filter={(c) =>
                    !/^[A-Z0-9]$/.test(c) &&
                    !["CH", "Ä", "Ö", "Ü", "Ð"].includes(c)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* 顶部显示区：RX LOG + 速度控制 */}
        <div className="w-full max-w-4xl bg-[#1a2e22] border-4 border-[#2c3e30] rounded-lg p-2 shadow-lg relative mt-2 z-20 flex flex-col h-28 md:h-36">
          <div className="flex justify-between items-center mb-1 border-b border-[#2c5c3e] pb-1">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-[#4caf50] font-bold tracking-widest flex items-center gap-2">
                <ActivityIcon size={12} /> {t("tools.cw.panel.rx_log")}
              </span>

              {/* Mobile Reference Toggle */}
              <button
                type="button"
                onClick={() => setShowRef((p) => !p)}
                className="md:hidden text-[9px] bg-[#0d1b11] px-2 py-0.5 rounded border border-[#2c5c3e] text-[#a5d6a7] hover:text-white transition-colors"
              >
                <BookIcon size={10} className="inline" />{" "}
                {t("tools.cw.panel.ref")}
              </button>

              <button
                type="button"
                onClick={cycleSpeed}
                className="flex items-center gap-1 text-[9px] bg-[#0d1b11] px-2 py-0.5 rounded border border-[#2c5c3e] text-[#a5d6a7] hover:text-white transition-colors"
              >
                <GaugeIcon size={10} />
                <span>
                  {t("tools.cw.panel.speed")}:{" "}
                  {t(`tools.cw.speed.${currentSpeed.label}`)} (
                  {t(`tools.cw.speed.${currentSpeed.desc}`)})
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMessage("")}
              className="text-[10px] text-[#4caf50] hover:text-white flex items-center gap-1"
            >
              <TrashIcon size={10} /> {t("tools.cw.panel.clear")}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-sm p-1 leading-relaxed custom-scrollbar whitespace-pre-wrap break-all text-[#81c784] shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] bg-[#0f1f15]">
            {message}
            <span className="animate-pulse inline-block w-2 h-4 bg-[#4caf50] align-middle ml-1"></span>
          </div>
        </div>

        {/* 主电路板区域 */}
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
              {Object.entries(NODES).map(([char, node]) =>
                renderLine(char, node),
              )}

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

              {Object.entries(NODES).map(([char, node]) =>
                renderNode(char, node),
              )}
            </svg>
          </div>
        </div>

        {/* 底部控制器 */}
        <div className="w-full max-w-4xl flex items-end justify-between px-4 pb-4 z-20">
          <button
            type="button"
            onClick={addDit}
            className="group flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div
              className={`w-16 h-16 rounded-full border-4 border-[#1b3323] flex items-center justify-center bg-[#2e5c3e] shadow-[inset_0_2px_5px_rgba(255,255,255,0.2),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] transition-all ${activeSignal === "dit" ? "bg-[#3e7c53] translate-y-1" : ""}`}
            >
              <div className="w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_5px_white]"></div>
            </div>
            <span className="text-[10px] text-white/50 font-bold tracking-widest bg-[#00000033] px-2 py-0.5 rounded">
              {t("tools.cw.control.dit")}
            </span>
          </button>

          <div className="flex flex-col items-center justify-end pb-2 gap-3 mx-4">
            <div className="relative h-10 flex items-center justify-center min-w-[100px] bg-[#4a5e4d] border-2 border-[#2c3e30] rounded shadow-[inset_0_0_5px_rgba(0,0,0,0.8)] cursor-text">
              <input
                ref={inputRef}
                type="text"
                className="absolute inset-0 w-full h-full opacity-0 cursor-text p-0 m-0 border-0 bg-transparent text-transparent caret-transparent z-10"
                tabIndex={-1}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck="false"
                aria-label={t("tools.cw.input_aria_label")}
              />
              <span
                className="text-xl font-mono text-[#111] tracking-widest font-bold opacity-80"
                style={{ fontFamily: "monospace" }}
              >
                {currentPath || t("tools.cw.status.ready")}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBackspace}
                className="text-[9px] text-amber-400/80 hover:text-amber-400 uppercase tracking-widest flex items-center gap-1 transition-colors border border-amber-900/50 px-2 py-1 rounded hover:bg-amber-900/20"
              >
                <BackspaceIcon size={12} /> {t("tools.cw.control.backspace")}
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-[9px] text-red-400/80 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors border border-red-900/50 px-2 py-1 rounded hover:bg-red-900/20"
              >
                <ArrowCounterClockwiseIcon size={12} />{" "}
                {t("tools.cw.control.reset")}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={addDah}
            className="group flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div
              className={`w-16 h-16 rounded-full border-4 border-[#1b3323] flex items-center justify-center bg-[#2e5c3e] shadow-[inset_0_2px_5px_rgba(255,255,255,0.2),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] transition-all ${activeSignal === "dah" ? "bg-[#3e7c53] translate-y-1" : ""}`}
            >
              <div className="w-8 h-3 bg-white rounded-sm shadow-[0_0_5px_white]"></div>
            </div>
            <span className="text-[10px] text-white/50 font-bold tracking-widest bg-[#00000033] px-2 py-0.5 rounded">
              {t("tools.cw.control.dah")}
            </span>
          </button>
        </div>

        {lastChar && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
            <span
              key={Date.now()}
              className={`text-[20vw] font-black animate-ping select-none font-mono ${lastChar === "ERR" ? "text-red-500/20" : "text-[#ffffff15]"}`}
            >
              {lastChar}
            </span>
          </div>
        )}
      </div>

      {/* Instructions Section */}
      <div className="w-full max-w-4xl mt-8 px-4 border-t border-[#2c3e30] pt-6 pb-12 z-10">
        <h2 className="text-xl font-bold text-[#4caf50] mb-4">
          {t("tools.cw.instructions.title")}
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold text-[#81c784] mb-2">
              {t("tools.cw.instructions.operation.title")}
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-[#a5d6a7]">
                  {t("tools.cw.instructions.operation.keyboard")}
                </h4>
                <p className="text-xs md:text-sm text-[#a5d6a7]/80 leading-relaxed">
                  {t("tools.cw.instructions.operation.keyboard_desc")}
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#a5d6a7]">
                  {t("tools.cw.instructions.operation.buttons")}
                </h4>
                <p className="text-xs md:text-sm text-[#a5d6a7]/80 leading-relaxed">
                  {t("tools.cw.instructions.operation.buttons_desc")}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#81c784] mb-2">
              {t("tools.cw.instructions.speed_guide.title")}
            </h3>
            <ul className="space-y-3 text-xs md:text-sm text-[#a5d6a7]/80 list-disc pl-4 leading-relaxed">
              <li>{t("tools.cw.instructions.speed_guide.beginner")}</li>
              <li>{t("tools.cw.instructions.speed_guide.intermediate")}</li>
              <li>{t("tools.cw.instructions.speed_guide.advanced")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
