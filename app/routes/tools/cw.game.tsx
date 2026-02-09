import { GameController, Play } from "@phosphor-icons/react";
import i18next from "i18next";
import { useEffect, useRef, useState } from "react";
import { initReactI18next, useTranslation } from "react-i18next";
import type { MetaFunction } from "react-router";
import { Button } from "~/components/ui/button";
import {
  CwGameBoard,
  CwGameControls,
  CwGameHUD,
  CwGameOver,
  useCwGameLogic,
  type DifficultyLevel,
} from "~/components/tools/cw/game";
import resources from "~/locales";
import { getLocale } from "~/middleware/i18next";
import type { Route } from "./+types/cw.game";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const locale = getLocale(request);
  const t = await i18next.use(initReactI18next).init({
    lng: locale,
    ns: "common",
    resources,
  });
  return {
    title: `${t("tools.cw.game.title")} | Ham Study`,
    description: t("tools.cwGame.description"),
    keywords: t("tools.cwGame.keywords"),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "CW Game" }];
  const { title, description, keywords } = data;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "keywords", content: keywords },
  ];
};

export default function CwGame() {
  console.error("RENDER: CwGame Component Mounted");
  const { t } = useTranslation("common");
  const [highScore, setHighScore] = useState<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem("cwGameHighScore");
    if (stored) {
      setHighScore(Number.parseInt(stored));
    }
  }, []);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("MEDIUM");

  const {
    gameState,
    fallingCharsRef,
    particlesRef,
    currentPattern,
    addDit,
    addDah,
    handleBackspace,
    clearPattern,
    startGame,
    pauseGame,
    resetGame,
  } = useCwGameLogic();

  // Damage effect
  const [isDamaged, setIsDamaged] = useState(false);
  const prevHealthRef = useRef(gameState.health);

  useEffect(() => {
    if (gameState.health < prevHealthRef.current) {
      setIsDamaged(true);
      const timer = setTimeout(() => setIsDamaged(false), 150);
      return () => clearTimeout(timer);
    }
    prevHealthRef.current = gameState.health;
  }, [gameState.health]);

  // Update high score
  useEffect(() => {
    if (gameState.score > highScore) {
      localStorage.setItem("cwGameHighScore", String(gameState.score));
      setHighScore(gameState.score);
    }
  }, [gameState.score, highScore]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.isPlaying) return;

      switch (e.code) {
        case "KeyJ":
          e.preventDefault();
          addDit();
          break;
        case "KeyK":
          e.preventDefault();
          addDah();
          break;
        case "Backspace":
          e.preventDefault();
          handleBackspace();
          break;
        case "Escape":
          e.preventDefault();
          pauseGame();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState.isPlaying, addDit, addDah, handleBackspace, pauseGame]);

  return (
    <div
      className={`h-screen w-full bg-[#050505] flex flex-col items-center font-mono relative overflow-hidden text-slate-200 transition-all duration-150 ease-in-out`}
    >
      {/* 
        Container for the "CRT Monitor" look. 
        We add a crt-screen class that wraps the game content.
      */}
      <div
        className={`
        relative w-full max-w-5xl h-full sm:h-[95vh] sm:my-auto sm:border-[16px] sm:border-[#1a1a1a] sm:rounded-[2rem] 
        bg-black crt-screen shadow-2xl flex flex-col
        ${isDamaged ? "shadow-[inset_0_0_100px_rgba(239,68,68,0.8)]" : ""} 
      `}
      >
        {/* CRT Overlay Effects */}
        <div className="crt-overlay" />
        <div className="crt-vignette" />

        {/* Background Grid (Inside CRT) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20 bg-grid-pattern"
          style={{ "--scan-color": "rgba(34, 197, 94, 0.4)" } as any}
        />

        {/* HUD */}
        <CwGameHUD gameState={gameState} highScore={highScore} />

        {/* Game Board */}
        <CwGameBoard
          gameState={gameState}
          fallingCharsRef={fallingCharsRef}
          particlesRef={particlesRef}
          onPause={pauseGame}
        />

        {/* Start Screen Button */}
        {!gameState.isPlaying && !gameState.isGameOver && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80 backdrop-blur-sm">
            <div className="text-center p-12 border-2 border-green-900/50 bg-[#0a0a0a] shadow-[0_0_50px_rgba(34,197,94,0.1)] max-w-xl w-full mx-4">
              <GameController
                className="w-24 h-24 text-green-600 mx-auto mb-6 opacity-80"
                weight="fill"
              />
              <h2 className="text-5xl font-black text-phosphor tracking-widest mb-2 uppercase font-mono text-shadow-glow">
                CW DEFENSE
              </h2>
              <p className="text-green-800 tracking-[0.5em] text-xs mb-8 uppercase">
                Tactical Morse Training Sim
              </p>

              <div className="mb-8 space-y-2 text-sm text-green-400/80 font-mono border-l-2 border-green-900/50 pl-4 text-left inline-block">
                <p>&gt; INTERCEPT FALLING SIGNALS</p>
                <p>&gt; DECODE USING MORSE INPUT</p>
                <p>&gt; PREVENT PERIMETER BREACH</p>
              </div>

              {/* Difficulty Selector */}
              <div className="flex justify-center gap-4 mb-10">
                {(["EASY", "MEDIUM", "HARD"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`px-6 py-2 border-2 font-mono tracking-widest transition-all clip-path-slant ${
                      difficulty === level
                        ? "bg-green-700 border-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.5)] scale-105"
                        : "bg-transparent border-green-900 text-green-700 hover:border-green-700 hover:text-green-500"
                    }`}
                  >
                    {t(
                      `tools.cw.game.difficulty.${level.toLowerCase()}`,
                      level,
                    )}
                  </button>
                ))}
              </div>

              <Button
                size="lg"
                type="button"
                onClick={() => startGame(difficulty)}
                className="bg-green-700 hover:bg-green-600 text-black font-black tracking-widest px-12 py-6 text-xl rounded-none border border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
              >
                <Play className="w-6 h-6 mr-3" weight="fill" />
                INITIATE
              </Button>
            </div>
          </div>
        )}

        {/* Controls */}
        <CwGameControls
          currentPattern={currentPattern}
          isPlaying={gameState.isPlaying}
          isPaused={gameState.isPaused}
          onDit={addDit}
          onDah={addDah}
          onClear={clearPattern}
        />

        {/* Game Over */}
        <CwGameOver
          gameState={gameState}
          highScore={highScore}
          onReset={resetGame}
          onPlayAgain={() => {
            resetGame();
            startGame();
          }}
        />
        {/* Debug Info */}
        <div data-testid="debug-state" style={{ display: "none" }}>
          {JSON.stringify({
            health: gameState.health,
            // fallingCount: fallingChars.length,
            score: gameState.score,
            isPlaying: gameState.isPlaying,
          })}
        </div>
      </div>
    </div>
  );
}
