import { GameController, Play, SpeakerHigh } from "@phosphor-icons/react";
import i18next from "i18next";
import { useEffect, useRef } from "react";
import { initReactI18next } from "react-i18next";
import type { MetaFunction } from "react-router";
import { useCwRxGameLogic } from "~/components/tools/cw/rx-game/useCwRxGameLogic";
import { Button } from "~/components/ui/button";
import resources from "~/locales";
import { getLocale } from "~/middleware/i18next";
import type { Route } from "./+types/cw.rx-game";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const locale = getLocale(request);
  const t = await i18next.use(initReactI18next).init({
    lng: locale,
    ns: "common",
    resources,
  });
  return {
    title: `${t("tools.cw.rx_game.title", "CW Receive Trainer")} | Ham Study`,
    description: t(
      "tools.cw.rx_game.description",
      "Practice receiving Morse code.",
    ),
    keywords: t("tools.cw.rx_game.keywords", "cw, morse, rx, receive, trainer"),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "CW RX Game" }];
  const { title, description, keywords } = data;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "keywords", content: keywords },
  ];
};

export default function CwRxGame() {
  const {
    gameState,
    setGameState,
    startGame,

    handleInputChange,
    submitInput,
    replayAudio,
  } = useCwRxGameLogic();

  // Focus input on state change to waiting_input
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (gameState.status === "waiting_input") {
      inputRef.current?.focus();
    }
  }, [gameState.status]);

  return (
    <div className="h-screen w-full bg-[#050505] flex flex-col items-center font-mono relative overflow-hidden text-slate-200 transition-all duration-150 ease-in-out">
      {/* CRT Container */}
      <div
        className={`
        relative w-full max-w-5xl h-full sm:h-[95vh] sm:my-auto sm:border-16 sm:border-[#1a1a1a] sm:rounded-[2rem] 
        bg-black crt-screen shadow-2xl flex flex-col
        ${gameState.status === "failure" ? "shadow-[inset_0_0_100px_rgba(239,68,68,0.5)]" : ""}
        ${gameState.status === "success" ? "shadow-[inset_0_0_50px_rgba(34,197,94,0.3)]" : ""}
      `}
      >
        {/* CRT Overlay Effects */}
        <div className="crt-overlay pointer-events-none" />
        <div className="crt-vignette pointer-events-none" />
        {/* Background Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20 bg-grid-pattern"
          style={{ "--scan-color": "rgba(34, 197, 94, 0.4)" } as any}
        />

        {/* HUD - Always Visible (or at least score) */}
        <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-50 pointer-events-none">
          <div className="bg-black/80 border border-green-900 p-4 flex flex-col gap-2">
            <div>
              <div className="text-xs text-green-700 uppercase tracking-widest mb-1">
                Score
              </div>
              <div className="text-3xl font-black text-green-500 text-shadow-glow">
                {gameState.score.toString().padStart(6, "0")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-green-800 uppercase tracking-widest mb-0.5">
                High Score
              </div>
              <div className="text-xl font-bold text-green-700">
                {gameState.highScore.toString().padStart(6, "0")}
              </div>
            </div>
          </div>

          <div className="bg-black/80 border border-green-900 p-4 pointer-events-auto flex gap-6">
            {/* WPM Control */}
            <div>
              <label
                htmlFor="wpm-slider"
                className="text-xs text-green-700 uppercase tracking-widest block mb-2"
              >
                Speed (WPM): {gameState.wpm}
              </label>
              <input
                id="wpm-slider"
                type="range"
                min="5"
                max="40"
                step="1"
                value={gameState.wpm}
                onChange={(e) =>
                  setGameState((prev) => ({
                    ...prev,
                    wpm: Number(e.target.value),
                  }))
                }
                className="w-32 accent-green-500"
              />
            </div>
            {/* Farnsworth Control */}
            <div>
              <label
                htmlFor="farnsworth-slider"
                className="text-xs text-green-700 uppercase tracking-widest block mb-2"
              >
                Spacing: {gameState.farnsworth}
              </label>
              <input
                id="farnsworth-slider"
                type="range"
                min="5"
                max="40"
                step="1"
                value={gameState.farnsworth}
                onChange={(e) =>
                  setGameState((prev) => ({
                    ...prev,
                    farnsworth: Number(e.target.value),
                  }))
                }
                className="w-32 accent-green-500"
              />
            </div>
            {/* Noise Control */}
            <div>
              <label
                htmlFor="noise-slider"
                className="text-xs text-green-700 uppercase tracking-widest block mb-2"
              >
                Noise: {gameState.noiseLevel}%
              </label>
              <input
                id="noise-slider"
                type="range"
                min="0"
                max="80"
                step="5"
                value={gameState.noiseLevel}
                onChange={(e) =>
                  setGameState((prev) => ({
                    ...prev,
                    noiseLevel: Number(e.target.value),
                  }))
                }
                className="w-32 accent-green-500"
              />
            </div>
          </div>
        </div>

        {/* Start Screen Overlay */}
        {!gameState.isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80 backdrop-blur-sm">
            <div className="text-center p-12 border-2 border-green-900/50 bg-[#0a0a0a] shadow-[0_0_50px_rgba(34,197,94,0.1)] max-w-xl w-full mx-4">
              <GameController
                className="w-24 h-24 text-green-600 mx-auto mb-6 opacity-80"
                weight="fill"
              />
              <h2 className="text-5xl font-black text-phosphor tracking-widest mb-2 uppercase font-mono text-shadow-glow">
                RX TRAINER
              </h2>
              <p className="text-green-800 tracking-[0.5em] text-xs mb-8 uppercase">
                Morse Code Reception Sim
              </p>

              <div className="mb-8 mt-8 text-green-400/60 text-sm">
                <p>Listen to the sequence.</p>
                <p>Type what you hear.</p>
                <p>Press ENTER to submit.</p>
              </div>

              <Button
                size="lg"
                onClick={startGame}
                className="bg-green-700 hover:bg-green-600 text-black font-black tracking-widest px-12 py-6 text-xl rounded-none border border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
              >
                <Play className="w-6 h-6 mr-3" weight="fill" />
                START LISTENING
              </Button>
            </div>
          </div>
        )}

        {/* Main Game Area */}
        {gameState.isPlaying && (
          <div className="flex-1 flex flex-col items-center justify-center relative z-20">
            {/* Status Indicator */}
            <div className="mb-12 h-16 flex items-center justify-center">
              {gameState.status === "playing_audio" && (
                <div className="flex items-center gap-3 text-green-500 animate-pulse">
                  <SpeakerHigh weight="fill" className="w-8 h-8" />
                  <span className="text-xl tracking-widest">
                    TRANSMITTING...
                  </span>
                </div>
              )}
              {gameState.status === "waiting_input" && (
                <div className="text-green-500/50 tracking-widest">
                  WAITING FOR INPUT
                </div>
              )}
              {gameState.status === "success" && (
                <div className="text-green-400 text-2xl font-bold tracking-widest">
                  CORRECT!
                </div>
              )}
              {gameState.status === "failure" && (
                <div className="flex flex-col items-center">
                  <div className="text-red-500 text-2xl font-bold tracking-widest mb-2">
                    MISS!
                  </div>
                  <div className="text-green-800 text-sm">
                    WAS: {gameState.currentTarget}
                  </div>
                </div>
              )}
            </div>

            {/* Input Field */}
            <div className="w-full max-w-xl px-8 relative">
              <input
                ref={inputRef}
                type="text"
                value={gameState.userInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitInput();
                  if (e.key === " " && gameState.status === "waiting_input") {
                    e.preventDefault();
                    replayAudio();
                  }
                }}
                disabled={
                  gameState.status === "playing_audio" ||
                  gameState.status === "success" ||
                  gameState.status === "failure"
                }
                placeholder={
                  gameState.status === "playing_audio" ? "..." : "TYPE HERE"
                }
                className="w-full bg-black/50 border-b-4 border-green-700 text-green-400 text-center text-5xl p-4 font-mono uppercase focus:outline-none focus:border-green-400 focus:bg-green-900/10 transition-all placeholder:text-green-900/30"
                autoComplete="off"
                autoCorrect="off"
              />

              {/* Helper hint */}
              <div className="text-center mt-4 text-green-800 text-xs tracking-widest">
                {gameState.status === "waiting_input"
                  ? "PRESS [SPACE] TO REPEAT • [ENTER] TO SUBMIT"
                  : " "}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
