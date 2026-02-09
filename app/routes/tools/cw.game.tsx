import { ArrowClockwise, GameController, Play } from "@phosphor-icons/react";
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
    description: t("tools.cw.game.description"),
    keywords: t("tools.cw.game.keywords"),
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
  const [highScore, setHighScore] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number.parseInt(localStorage.getItem("cwGameHighScore") || "0");
    }
    return 0;
  });

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
      className={`h-screen w-full bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center font-mono relative overflow-hidden text-slate-200 transition-all duration-150 ease-in-out ${
        isDamaged ? "shadow-[inset_0_0_100px_rgba(239,68,68,0.6)]" : ""
      }`}
    >
      {/* Background Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
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
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-slate-950/90">
          <div className="text-center">
            <GameController
              className="w-24 h-24 text-green-500 mx-auto mb-6"
              weight="fill"
            />
            <h2 className="text-4xl font-bold text-green-400 mb-4">
              {t("tools.cw.game.ready", "Ready to Play?")}
            </h2>
            <p className="text-slate-400 mb-8 max-w-md">
              {t(
                "tools.cw.game.instructions",
                "Use 'J' for · (dit) and 'K' for − (dah). Type the morse code to eliminate falling characters before they reach the wall!",
              )}
            </p>
            <Button
              size="lg"
              onClick={startGame}
              className="bg-green-600 hover:bg-green-700 text-white px-8"
            >
              <Play className="w-5 h-5 mr-2" weight="fill" />
              {t("tools.cw.game.start", "Start Game")}
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
  );
}
