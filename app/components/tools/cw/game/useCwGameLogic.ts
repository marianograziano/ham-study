import { useCallback, useEffect, useRef, useState } from "react";
import { MORSE_CODE_MAP } from "~/components/tools/cw/constants";
import {
  FALL_SPEED_INITIAL,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_HEALTH,
  SPAWN_INTERVAL_INITIAL,
  WALL_Y,
  type FallingChar,
  type GameState,
  type Particle,
  getRandomChar,
} from "./constants";

// Convert MORSE_CODE_MAP to array format for game
const MORSE_CODE = Object.entries(MORSE_CODE_MAP).map(([pattern, char]) => ({
  char,
  pattern: pattern.replace(/\./g, "·").replace(/-/g, "−"),
}));

// Convert dit/dah pattern to character
const patternToChar = (pattern: string): string | null => {
  const entry = MORSE_CODE.find((m) => m.pattern === pattern);
  return entry?.char || null;
};

export function useCwGameLogic() {
  const animationRef = useRef<number>();
  const spawnTimeoutRef = useRef<NodeJS.Timeout>();

  // Game state
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    health: MAX_HEALTH,
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    combo: 0,
    maxCombo: 0,
  });

  const [fallingChars, setFallingChars] = useState<FallingChar[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [currentPattern, setCurrentPattern] = useState<string>("");

  // Difficulty scaling
  const difficulty = {
    spawnInterval: Math.max(
      800,
      SPAWN_INTERVAL_INITIAL - Math.floor(gameState.score / 100) * 100
    ),
    fallSpeed:
      FALL_SPEED_INITIAL + Math.floor(gameState.score / 100) * 0.05,
  };

  // Spawn new character
  const spawnChar = useCallback(() => {
    const char = getRandomChar();
    const x = Math.random() * (GAME_WIDTH - 10) + 5;

    setFallingChars((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        char,
        x,
        y: 0,
        speed: difficulty.fallSpeed + Math.random() * 0.2,
      },
    ]);
  }, [difficulty.fallSpeed]);

  // Create explosion particles
  const createExplosion = useCallback(
    (x: number, y: number, color: string = "#22c55e") => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        const speed = 2 + Math.random() * 3;
        newParticles.push({
          id: `${Date.now()}-${i}`,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color,
        });
      }
      setParticles((prev) => [...prev, ...newParticles]);
    },
    []
  );

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState.isPlaying || gameState.isPaused) return;

    setFallingChars((prev) => {
      const updated = prev
        .map((char) => ({
          ...char,
          y: char.y + char.speed,
        }))
        .filter((char) => !char.isHit);

      // Check for characters hitting the wall
      const hits = updated.filter((char) => char.y >= WALL_Y);
      if (hits.length > 0) {
        const remaining = updated.filter((char) => char.y < WALL_Y);

        setGameState((gs) => {
          const newHealth = gs.health - hits.length;
          if (newHealth <= 0) {
            return {
              ...gs,
              health: 0,
              isPlaying: false,
              isGameOver: true,
              combo: 0,
            };
          }
          return {
            ...gs,
            health: newHealth,
            combo: 0,
          };
        });

        return remaining;
      }

      return updated;
    });

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.isPlaying, gameState.isPaused]);

  // Particle animation
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.2,
            life: p.life - 0.05,
          }))
          .filter((p) => p.life > 0)
      );
    }, 33);

    return () => clearInterval(interval);
  }, [particles.length]);

  // Start game loop
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused) {
      animationRef.current = requestAnimationFrame(gameLoop);

      const scheduleSpawn = () => {
        spawnTimeoutRef.current = setTimeout(() => {
          if (gameState.isPlaying && !gameState.isPaused) {
            spawnChar();
            scheduleSpawn();
          }
        }, difficulty.spawnInterval + Math.random() * 500);
      };
      scheduleSpawn();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (spawnTimeoutRef.current) {
        clearTimeout(spawnTimeoutRef.current);
      }
    };
  }, [gameState.isPlaying, gameState.isPaused, gameLoop, spawnChar, difficulty.spawnInterval]);

  // Handle morse code input
  const addDit = useCallback(() => {
    setCurrentPattern((p) => p + "·");
  }, []);

  const addDah = useCallback(() => {
    setCurrentPattern((p) => p + "−");
  }, []);

  const handleBackspace = useCallback(() => {
    setCurrentPattern((p) => p.slice(0, -1));
  }, []);

  const clearPattern = useCallback(() => {
    setCurrentPattern("");
  }, []);

  // Check pattern match
  useEffect(() => {
    if (!currentPattern) return;

    const matchedChar = patternToChar(currentPattern);
    if (matchedChar) {
      setFallingChars((chars) => {
        const matchIndex = chars.findIndex(
          (c) => c.char === matchedChar && !c.isHit
        );

        if (matchIndex !== -1) {
          const newChars = [...chars];
          newChars[matchIndex] = { ...newChars[matchIndex], isHit: true };

          createExplosion(
            newChars[matchIndex].x,
            newChars[matchIndex].y
          );

          setGameState((gs) => {
            const newCombo = gs.combo + 1;
            const points = 10 + Math.floor(newCombo / 5) * 5;
            const newScore = gs.score + points;

            return {
              ...gs,
              score: newScore,
              combo: newCombo,
              maxCombo: Math.max(gs.maxCombo, newCombo),
            };
          });

          setTimeout(() => {
            setFallingChars((prev) =>
              prev.filter((c) => c.id !== chars[matchIndex].id)
            );
          }, 200);

          return newChars;
        }

        return chars;
      });

      clearPattern();
    }
  }, [currentPattern, clearPattern, createExplosion]);

  // Game controls
  const startGame = () => {
    setGameState({
      score: 0,
      health: MAX_HEALTH,
      isPlaying: true,
      isPaused: false,
      isGameOver: false,
      combo: 0,
      maxCombo: 0,
    });
    setFallingChars([]);
    setParticles([]);
    setCurrentPattern("");
  };

  const pauseGame = () => {
    setGameState((gs) => ({ ...gs, isPaused: !gs.isPaused }));
  };

  const resetGame = () => {
    setGameState({
      score: 0,
      health: MAX_HEALTH,
      isPlaying: false,
      isPaused: false,
      isGameOver: false,
      combo: 0,
      maxCombo: 0,
    });
    setFallingChars([]);
    setParticles([]);
    setCurrentPattern("");
  };

  return {
    gameState,
    fallingChars,
    particles,
    currentPattern,
    addDit,
    addDah,
    handleBackspace,
    clearPattern,
    startGame,
    pauseGame,
    resetGame,
  };
}
