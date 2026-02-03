import type { Node, SpeedMode, SpeedSetting } from "./types";

// === 1. 节点坐标定义 (Balanced Layout) ===
export const NODES: Record<string, Node> = {
  // === ROOT ===
  START: { x: 0, y: 0, type: "root" },

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

export const MORSE_CODE_MAP: Record<string, string> = {
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

export const CODE_TO_CHAR = Object.fromEntries(
  Object.entries(MORSE_CODE_MAP).map(([k, v]) => [k, v]),
);

// === 文字位置配置 ===
export const TEXT_POSITIONS: Record<string, string> = {
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

export const SPEED_SETTINGS: Record<SpeedMode, SpeedSetting> = {
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
