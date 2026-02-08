import { ArrowClockwise, Play, Trophy } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
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
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-slate-950/95">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-red-500 flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-8 h-8" />
            游戏结束
          </div>
          <p className="text-slate-400">城墙已被攻破！</p>
        </div>

        <div className="py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400 uppercase">
                最终得分
              </div>
              <div className="text-3xl font-bold text-green-400">
                {gameState.score.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400 uppercase">
                最高连击
              </div>
              <div className="text-3xl font-bold text-orange-400">
                ×{gameState.maxCombo}
              </div>
            </div>
          </div>

          {isNewRecord && (
            <div className="text-center bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <span className="text-yellow-500 font-bold">
                🎉 新纪录！
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onReset} className="flex-1">
            <ArrowClockwise className="w-4 h-4 mr-2" />
            主菜单
          </Button>
          <Button onClick={onPlayAgain} className="flex-1 bg-green-600 hover:bg-green-700">
            <Play className="w-4 h-4 mr-2" weight="fill" />
            再玩一次
          </Button>
        </div>
      </div>
    </div>
  );
}
