// Game constants
export const GAME_WIDTH = 100; // percentage
export const GAME_HEIGHT = 65; // vh
export const WALL_Y = 60; // percentage from top
export const MAX_HEALTH = 5;
export const SPAWN_INTERVAL_INITIAL = 2500; // ms
export const FALL_SPEED_INITIAL = 0.3; // vh per frame

export interface FallingChar {
  id: string;
  char: string;
  x: number; // percentage 0-100
  y: number; // vh 0-100
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
