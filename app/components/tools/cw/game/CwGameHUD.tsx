import { GameController } from "@phosphor-icons/react";
import { Heart } from "@phosphor-icons/react";
import { MAX_HEALTH } from "./constants";
import type { GameState } from "./constants";

interface CwGameHUDProps {
  gameState: GameState;
  highScore: number;
}

export function CwGameHUD({ gameState, highScore }: CwGameHUDProps) {
  const renderHearts = () => {
    return Array.from({ length: MAX_HEALTH }).map((_, i) => (
      <Heart
        key={i}
        weight={i < gameState.health ? "fill" : "regular"}
        className={`w-8 h-8 transition-all duration-300 ${
          i < gameState.health ? "text-red-500" : "text-gray-600"
        }`}
      />
    ));
  };

  return (
    <header className="w-full p-4 flex justify-between items-center z-20 bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="flex items-center gap-4">
        <GameController className="w-8 h-8 text-green-500" weight="fill" />
        <div>
          <h1 className="text-xl font-bold text-green-400">CW 防御战</h1>
          <p className="text-xs text-slate-400">用摩尔斯电码保卫城墙</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Score */}
        <div className="text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider">
            分数
          </div>
          <div className="text-2xl font-bold text-green-400 tabular-nums">
            {gameState.score.toLocaleString()}
          </div>
        </div>

        {/* High Score */}
        <div className="text-center hidden sm:block">
          <div className="text-xs text-slate-400 uppercase tracking-wider">
            最高分
          </div>
          <div className="text-xl font-bold text-yellow-500 tabular-nums">
            {highScore.toLocaleString()}
          </div>
        </div>

        {/* Combo */}
        {gameState.combo > 0 && (
          <div className="text-center animate-pulse">
            <div className="text-xs text-orange-400 uppercase tracking-wider">
              连击
            </div>
            <div className="text-2xl font-bold text-orange-500">
              ×{gameState.combo}
            </div>
          </div>
        )}

        {/* Health */}
        <div className="flex gap-1">{renderHearts()}</div>
      </div>
    </header>
  );
}
