import { GameController } from "@phosphor-icons/react";
import { MAX_HEALTH } from "./constants";
import type { GameState } from "./constants";

interface CwGameHUDProps {
  gameState: GameState;
  highScore: number;
}

export function CwGameHUD({ gameState, highScore }: CwGameHUDProps) {
  const renderHealthBar = () => {
    // 10 segments for health? Or just 5 blocks.
    return (
      <div className="flex gap-1">
        {Array.from({ length: MAX_HEALTH }).map((_, i) => (
          <div
            key={i}
            className={`w-6 h-4 border border-slate-700 ${
              i < gameState.health
                ? "bg-green-500 shadow-[0_0_5px_#22c55e]"
                : "bg-slate-900/50"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <header className="w-full h-20 px-6 flex justify-between items-center z-20 bg-[#111] border-b-4 border-slate-800 shadow-xl relative overflow-hidden">
      {/* Scanline overlay for the HUD specifically? Maybe overkill. */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

      {/* Left: Title Panel */}
      <div className="flex items-center gap-4 z-10">
        <div className="w-12 h-12 bg-slate-800 rounded-full border-4 border-slate-700 flex items-center justify-center shadow-inner">
          <GameController className="w-6 h-6 text-green-500" weight="fill" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-phosphor tracking-widest uppercase font-mono">
            CW Defense
          </h1>
          <p className="text-[10px] text-green-700 tracking-[0.2em] font-mono">
            SYSTEM ONLINE
          </p>
        </div>
      </div>

      {/* Center: Digital Readouts */}
      <div className="flex items-center gap-4 z-10">
        {/* Score */}
        <div className="bg-black/80 border-x border-slate-700 px-6 py-2 relative group">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-green-800" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-green-800" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-green-800" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-green-800" />

          <div className="text-[10px] text-green-800 uppercase tracking-widest mb-1 text-center">
            Score
          </div>
          <div className="text-3xl font-mono font-bold text-phosphor tabular-nums text-shadow-glow">
            {gameState.score.toString().padStart(6, "0")}
          </div>
        </div>

        {/* High Score (Small) */}
        <div className="hidden sm:block text-right mr-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">
            High Score
          </div>
          <div className="text-lg font-mono text-yellow-600/80 tabular-nums">
            {highScore}
          </div>
        </div>

        {/* Combo */}
        <div className="bg-black/80 border-x border-slate-700 px-6 py-2 relative min-w-[100px]">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-green-800" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-green-800" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-green-800" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-green-800" />

          <div className="text-[10px] text-green-800 uppercase tracking-widest mb-1 text-center">
            Combo
          </div>
          <div
            className={`text-3xl font-mono font-bold tabular-nums text-center ${gameState.combo > 1 ? "text-orange-400 text-shadow-glow" : "text-green-900"}`}
          >
            {gameState.combo > 1 ? `x${gameState.combo}` : "--"}
          </div>
        </div>
      </div>

      {/* Right: Health/Integrity */}
      <div className="flex flex-col items-end z-10 gap-1">
        <div className="text-[10px] text-green-800 uppercase tracking-widest">
          Signal Integrity
        </div>
        {renderHealthBar()}
      </div>
    </header>
  );
}
