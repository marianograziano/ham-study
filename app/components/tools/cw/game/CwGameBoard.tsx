import { useRef, useEffect, useState, useLayoutEffect } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { WALL_Y } from "./constants";
import type { FallingChar, Particle, GameState } from "./constants";
import { MORSE_CODE_MAP } from "~/components/tools/cw/constants";

interface CwGameBoardProps {
  gameState: GameState;
  fallingCharsRef: React.MutableRefObject<FallingChar[]>;
  particlesRef: React.MutableRefObject<Particle[]>;
  onPause: () => void;
}

export function CwGameBoard({
  gameState,
  fallingCharsRef,
  particlesRef,
  onPause,
}: CwGameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const difficultyRef = useRef(gameState.difficulty);
  difficultyRef.current = gameState.difficulty;

  // Handle Resize
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

  // Render Loop
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerSize.width === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerSize.width * dpr;
    canvas.height = containerSize.height * dpr;
    canvas.style.width = `${containerSize.width}px`;
    canvas.style.height = `${containerSize.height}px`;
    ctx.scale(dpr, dpr);

    const render = () => {
      if (!ctx) return;

      // Clear layout
      ctx.clearRect(0, 0, containerSize.width, containerSize.height);

      // 1. Draw Wall
      const wallY = (WALL_Y / 100) * containerSize.height;

      // Glow effect for wall
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ef4444";

      // Draw dashed line
      ctx.beginPath();
      ctx.setLineDash([20, 10]);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.8)"; // red-500
      ctx.lineWidth = 2;
      ctx.moveTo(0, wallY);
      ctx.lineTo(containerSize.width, wallY);
      ctx.stroke();

      ctx.shadowBlur = 0; // Reset shadow

      // Text "CRITICAL THRESHOLD"
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#ef4444"; // red-500
      ctx.textAlign = "right";
      ctx.letterSpacing = "2px";
      ctx.fillText("CRITICAL THRESHOLD", containerSize.width - 16, wallY - 10);

      // 2. Draw Falling Characters
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      fallingCharsRef.current.forEach((char) => {
        const x = (char.x / 100) * containerSize.width;
        const y = (char.y / 100) * containerSize.height;

        // Draw Box
        const boxSize = 48;
        const boxX = x - boxSize / 2;
        const boxY = y;

        ctx.save();

        if (char.isHit) {
          // Hit effect: Solid green fill, expanding
          ctx.fillStyle = "rgba(34, 197, 94, 0.8)"; // green-500
          ctx.shadowColor = "#22c55e";
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.rect(boxX, boxY, boxSize, boxSize);
          ctx.fill();
        } else {
          // Normal: Hollow box, corner accents
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#4ade80"; // green-400
          ctx.shadowColor = "#4ade80";
          ctx.shadowBlur = 5;

          // Main box
          ctx.strokeRect(boxX, boxY, boxSize, boxSize);

          // Corner accents (brackets look)
          ctx.lineWidth = 3;
          const cornerLen = 8;

          ctx.beginPath();
          // Top-left
          ctx.moveTo(boxX, boxY + cornerLen);
          ctx.lineTo(boxX, boxY);
          ctx.lineTo(boxX + cornerLen, boxY);
          // Top-right
          ctx.moveTo(boxX + boxSize - cornerLen, boxY);
          ctx.lineTo(boxX + boxSize, boxY);
          ctx.lineTo(boxX + boxSize, boxY + cornerLen);
          // Bottom-right
          ctx.moveTo(boxX + boxSize, boxY + boxSize - cornerLen);
          ctx.lineTo(boxX + boxSize, boxY + boxSize);
          ctx.lineTo(boxX + boxSize - cornerLen, boxY + boxSize);
          // Bottom-left
          ctx.moveTo(boxX + cornerLen, boxY + boxSize);
          ctx.lineTo(boxX, boxY + boxSize);
          ctx.lineTo(boxX, boxY + boxSize - cornerLen);

          ctx.stroke();
        }

        // Draw Text
        ctx.font = "bold 24px monospace";
        ctx.fillStyle = char.isHit ? "#000" : "#4ade80"; // Black text on hit, green otherwise
        if (!char.isHit) ctx.shadowBlur = 5;
        ctx.fillText(char.char, x, y + boxSize / 2);

        // Draw Morse Hint (Easy Mode)
        if (difficultyRef.current === "EASY" && !char.isHit) {
          const pattern = Object.entries(MORSE_CODE_MAP).find(
            ([_, c]) => c === char.char,
          )?.[0];
          if (pattern) {
            const displayPattern = pattern
              .replace(/\./g, "·")
              .replace(/-/g, "−");
            ctx.font = "bold 12px monospace";
            ctx.fillStyle = "#94a3b8"; // slate-400
            ctx.shadowBlur = 0;
            ctx.fillText(displayPattern, x, y + boxSize + 16);
          }
        }

        ctx.restore();
      });

      // 3. Draw Particles
      particlesRef.current.forEach((p) => {
        const px = (p.x / 100) * containerSize.width;
        const py = (p.y / 100) * containerSize.height;

        ctx.save();
        ctx.beginPath();
        // Square pixels for retro feel
        ctx.rect(px - 2, py - 2, 4, 4);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.shadowBlur = 5;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [containerSize, fallingCharsRef, particlesRef]);

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 overflow-hidden pointer-events-none"
    >
      {/* Background Grid - moved here so it's behind canvas if needed, or controlled by parent */}
      {/* Actually parent handles bg. */}

      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Pause Overlay - Keep as DOM overlay */}
      {gameState.isPaused && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80 backdrop-blur-sm pointer-events-auto">
          <div className="text-center border-2 border-yellow-500/50 p-8 bg-black/90 shadow-[0_0_50px_rgba(234,179,8,0.2)]">
            <Pause
              className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse"
              weight="fill"
            />
            <h2 className="text-3xl font-bold text-yellow-500 mb-6 tracking-widest uppercase font-mono">
              System Halted
            </h2>
            <Button
              onClick={onPause}
              className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold font-mono tracking-widest px-8"
            >
              <Play className="w-5 h-5 mr-2" weight="fill" />
              RESUME
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
