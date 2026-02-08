import { useRef, useState, useEffect } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { WALL_Y } from "./constants";
import type { FallingChar, Particle, GameState } from "./constants";

interface CwGameBoardProps {
  gameState: GameState;
  fallingChars: FallingChar[];
  particles: Particle[];
  onPause: () => void;
}

export function CwGameBoard({
  gameState,
  fallingChars,
  particles,
  onPause,
}: CwGameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // 监听容器尺寸变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // 将百分比坐标转换为像素
  const toPixelY = (percentY: number) =>
    (percentY / 100) * containerSize.height;
  const toPixelX = (percentX: number) => (percentX / 100) * containerSize.width;

  return (
    <div ref={containerRef} className="relative w-full flex-1 overflow-hidden">
      {/* Pause Overlay */}
      {gameState.isPaused && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-slate-950/80">
          <div className="text-center">
            <Pause
              className="w-16 h-16 text-yellow-500 mx-auto mb-4"
              weight="fill"
            />
            <h2 className="text-3xl font-bold text-yellow-400 mb-4">已暂停</h2>
            <Button onClick={onPause} variant="outline" size="lg">
              <Play className="w-5 h-5 mr-2" weight="fill" />
              继续
            </Button>
          </div>
        </div>
      )}

      {/* Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-full pointer-events-none"
          style={{
            left: 0,
            top: 0,
            backgroundColor: p.color,
            opacity: p.life,
            transform: `translate3d(${toPixelX(p.x)}px, ${toPixelY(
              p.y,
            )}px, 0) scale(${p.life})`,
            willChange: "transform",
          }}
        />
      ))}

      {/* Falling Characters */}
      {fallingChars.map((char) => (
        <div
          key={char.id}
          className={`absolute transition-opacity duration-200 ${
            char.isHit ? "opacity-0 scale-150" : "opacity-100"
          }`}
          style={{
            left: toPixelX(char.x),
            top: 0,
            transform: `translate3d(-50%, ${toPixelY(char.y)}px, 0)`,
            willChange: "transform",
          }}
        >
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold shadow-lg ${
              char.isHit
                ? "bg-green-500 text-white"
                : "bg-slate-800 border-2 border-green-500 text-green-400"
            }`}
          >
            {char.char}
          </div>
        </div>
      ))}

      {/* Wall Line */}
      <div
        className="absolute left-0 right-0 border-t-4 border-dashed border-red-500/50 z-10"
        style={{ top: toPixelY(WALL_Y) }}
      >
        <div className="absolute right-4 -top-8 text-red-500 text-sm font-bold uppercase tracking-wider">
          防御城墙
        </div>
      </div>
    </div>
  );
}
