import { useRef, useEffect, useState, useLayoutEffect } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { WALL_Y } from "./constants";
import type { FallingChar, Particle, GameState } from "./constants";

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

      // Draw dashed line
      ctx.beginPath();
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)"; // red-500/50
      ctx.lineWidth = 4;
      ctx.moveTo(0, wallY);
      ctx.lineTo(containerSize.width, wallY);
      ctx.stroke();

      // Text "防御城墙" (DEFENSE WALL)
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#ef4444"; // red-500
      ctx.textAlign = "right";
      ctx.fillText("防御城墙", containerSize.width - 16, wallY - 10);

      // 2. Draw Falling Characters
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      fallingCharsRef.current.forEach((char) => {
        const x = (char.x / 100) * containerSize.width;
        // Vertically center the char. char.y is the top position in %.
        // Adding half height of the box (approx 24px) for visual center?
        // Original CSS used translate3d(-50%, toPixelY(char.y)px, 0).
        // Let's stick to the top Y for now and add some offset for text drawing.
        const y = (char.y / 100) * containerSize.height;

        // Draw Box
        const boxSize = 48; // w-12 h-12 = 48px
        const boxX = x - boxSize / 2;
        const boxY = y;

        ctx.save();

        // Animation for hit chars (scale up and fade out)
        if (char.isHit) {
          // We can simulate the CSS transition "opacity-0 scale-150"
          // but since logic removes it after 200ms, strictly following CSS transitions in canvas is hard without state tracking
          // For now, let's just make it look "hit" (green filled)
          // If we want smooth fade out we need a "hitTime" in the char object.
          // CURRENTLY char.isHit is boolean.
          // Simple approach: Draw it green and slightly larger.
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = "#22c55e"; // green-500

          // Scale effect loop-holed: we don't have time delta here easily without tracking per-char anim state.
          // Just draw it static "hit" state for now.
        } else {
          ctx.fillStyle = "#1e293b"; // slate-800
          ctx.strokeStyle = "#22c55e"; // border-green-500
          ctx.lineWidth = 2;
        }

        // Draw Rounded Rect (Box)
        const radius = 8;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxSize, boxSize, radius);
        ctx.fill();
        if (!char.isHit) ctx.stroke();

        // Draw Text
        ctx.fillStyle = char.isHit ? "#ffffff" : "#4ade80"; // white or green-400
        ctx.fillText(char.char, x, y + boxSize / 2);

        ctx.restore();
      });

      // 3. Draw Particles
      particlesRef.current.forEach((p) => {
        // const x = p.x; // Unused
        // Wait, logic says: createExplosion(newChars[idx].x, newChars[idx].y);
        // newChars[idx].x keeps the PERCENTAGE unit?
        // Let's check logic:
        // spawnChar: x = Math.random() * (GAME_WIDTH - 10) + 5; (Percentage)
        // createExplosion passed x, y directly.
        // So particles actually store PERCENTAGE x, y?
        // logic: x: p.x + p.vx, y: p.y + p.vy.
        // speed was 2 + Math.random() * 3.
        // If x is percentage, adding 2 (percent) is HUGE.
        // If logic assumes pixels, then `spawnChar` x is percentage, `createExplosion` gets percentage.
        // So `p.x` is percentage.
        // BUT speed `vx` is `Math.cos(angle) * speed`. Speed is 2-5.
        // moving 2% per frame is very fast.
        // Let's check original CwGameBoard rendering for particles:
        // left: 0, top: 0, transform: `translate3d(${toPixelX(p.x)}px, ...)`
        // Wait, if p.x is percentage, toPixelX(p.x) makes sense.
        // But the particle update logic: `x: p.x + p.vx`.
        // If p.x is percentage, p.vx is treated as percentage.
        // 5% of screen width per frame? That's crossing screen in 20 frames (0.3s). Explosion?
        // Actually original Logic used CSS transform translate3d(toPixelX(p.x)).
        // And update `x: p.x + p.vx`.
        // So yes, particles move in percentage units.

        // However, Canvas expects pixels.
        // So we must convert p.x (percentage) to pixels to draw.
        // but `vx` is also percentage?
        // Let's assume yes.

        // Wait, if vx is ~3 (percent), and screen is 1000px wide. 3% is 30px.
        // 30px per frame is FAST.
        // Maybe the original logic was intended for pixels but applied to percentage?
        // Or maybe 3% is fine for explosion speed?

        // Let's render assuming they are percentages.
        const px = (p.x / 100) * containerSize.width;
        const py = (p.y / 100) * containerSize.height;

        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2); // Radius 4 (w-2 h-2 is 8px width? no w-2 is 0.5rem = 8px. Radius 4.)
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [containerSize, fallingCharsRef, particlesRef]);

  return (
    <div ref={containerRef} className="relative w-full flex-1 overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Pause Overlay - Keep as DOM overlay */}
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
    </div>
  );
}
