// Game constants
export const GAME_WIDTH = 100; // percentage
export const GAME_HEIGHT = 100; // percentage (relative to game area)
export const WALL_Y = 80; // percentage from top of game area
export const MAX_HEALTH = 5;
export const SPAWN_INTERVAL_INITIAL = 2500; // ms
export const FALL_SPEED_INITIAL = 0.3; // % per frame

export interface FallingChar {
  id: string;
  char: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100 (relative to game area)
  speed: number;
  isHit?: boolean;
}

export interface GameState {
  score: number;
  health: number;
  isPlaying: boolean;
  isPaused: boolean;
  isGameOver: boolean;
  combo: number;
  maxCombo: number;
  difficulty: DifficultyLevel;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

// Generate random character
export const getRandomChar = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return chars[Math.floor(Math.random() * chars.length)];
};

export type DifficultyLevel = "EASY" | "MEDIUM" | "HARD";

export const DIFFICULTY_SETTINGS: Record<
  DifficultyLevel,
  { spawnInterval: number; fallSpeed: number; pointMultiplier: number }
> = {
  EASY: {
    spawnInterval: 3500,
    fallSpeed: 0.2, // Slower
    pointMultiplier: 1,
  },
  MEDIUM: {
    spawnInterval: 2500, // Matches initial
    fallSpeed: 0.3, // Matches initial
    pointMultiplier: 1.5,
  },
  HARD: {
    spawnInterval: 1500,
    fallSpeed: 0.4,
    pointMultiplier: 2,
  },
};
