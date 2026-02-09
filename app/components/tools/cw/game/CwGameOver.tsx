import { ArrowClockwise, Play, Trophy } from "@phosphor-icons/react";
import type { GameState } from "./constants";

interface CwGameOverProps {
  gameState: GameState;
  highScore: number;
  onReset: () => void;
  onPlayAgain: () => void;
}

export function CwGameOver({
  gameState,
  highScore,
  onReset,
  onPlayAgain,
}: CwGameOverProps) {
  if (!gameState.isGameOver) return null;

  const isNewRecord = gameState.score > 0 && gameState.score >= highScore;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/90 backdrop-blur-md">
      <div className="bg-[#0a0a0a] border-2 border-red-900/50 p-10 max-w-md w-full mx-4 shadow-[0_0_100px_rgba(239,68,68,0.3)] relative overflow-hidden">
        {/* Animated Background Strip */}
        <div className="absolute top-0 left-0 w-full h-1 bg-red-600 animate-pulse" />

        <div className="text-center mb-8 relative z-10">
          <div className="bg-red-950/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-800">
            <Trophy className="w-8 h-8 text-red-500" weight="fill" />
          </div>
          <div className="text-4xl font-black text-red-500 uppercase tracking-widest font-mono text-shadow-glow mb-2">
            TERMINATED
          </div>
          <p className="text-red-800 uppercase tracking-[0.3em] text-xs">
            Signal Lost
          </p>
        </div>

        <div className="py-6 space-y-4 border-t border-b border-red-900/30 mb-8">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-black/50 border border-slate-800 p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                Final Score
              </div>
              <div className="text-2xl font-bold text-phosphor font-mono">
                {gameState.score.toLocaleString()}
              </div>
            </div>
            <div className="bg-black/50 border border-slate-800 p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                Max Chain
              </div>
              <div className="text-2xl font-bold text-orange-500 font-mono">
                ×{gameState.maxCombo}
              </div>
            </div>
          </div>

          {isNewRecord && (
            <div className="text-center bg-yellow-900/20 border border-yellow-700/50 p-3 animate-pulse">
              <span className="text-yellow-500 font-bold font-mono tracking-widest uppercase text-sm">
                &gt;&gt; NEW HIGH SCORE RECORDED &lt;&lt;
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full bg-green-700 hover:bg-green-600 text-black font-bold py-4 uppercase tracking-widest font-mono shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          >
            <Play className="w-5 h-5" weight="fill" />
            Re-Initialize System
          </button>

          <button
            type="button"
            onClick={onReset}
            className="w-full bg-transparent hover:bg-slate-900 text-slate-500 hover:text-slate-300 font-mono text-sm py-3 uppercase tracking-widest border border-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowClockwise className="w-4 h-4" />
            Return to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
