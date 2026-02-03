export interface Node {
  x: number;
  y: number;
  type?: string;
  parent?: string;
}

export type SpeedMode = "beginner" | "intermediate" | "advanced";

export interface SpeedSetting {
  id: SpeedMode;
  label: "slow" | "med" | "fast";
  desc: "beginner" | "intermediate" | "advanced";
  charDelay: number;
  wordDelay: number;
}
