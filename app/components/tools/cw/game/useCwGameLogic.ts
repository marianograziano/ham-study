import { useCallback, useEffect, useRef, useState } from "react";
import { MORSE_CODE_MAP } from "~/components/tools/cw/constants";
import {
  GAME_WIDTH,
  MAX_HEALTH,
  WALL_Y,
  type FallingChar,
  type GameState,
  type Particle,
  getRandomChar,
  type DifficultyLevel,
  DIFFICULTY_SETTINGS,
} from "./constants";
import { soundManager } from "./SoundManager";

// Convert MORSE_CODE_MAP to array format for game
const MORSE_CODE = Object.entries(MORSE_CODE_MAP).map(([pattern, char]) => ({
  char,
  pattern: pattern.replace(/\./g, "·").replace(/-/g, "−"),
}));

export function useCwGameLogic() {
  const animationRef = useRef<number>(0);
  const spawnTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const lastFrameTimeRef = useRef<number>(0);
  const processedHitsRef = useRef<Set<string>>(new Set());

  // Game state
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    health: MAX_HEALTH,
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    combo: 0,
    maxCombo: 0,
    difficulty: "MEDIUM",
  });

  // 使用 ref 追踪最新 gameState，解决闭包问题
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Use refs for high-frequency updates (Canvas rendering)
  const fallingCharsRef = useRef<FallingChar[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const [currentPattern, setCurrentPattern] = useState<string>("");

  // Difficulty scaling
  const baseSettings = DIFFICULTY_SETTINGS[gameState.difficulty];
  const difficulty = {
    spawnInterval: Math.max(
      800,
      baseSettings.spawnInterval - Math.floor(gameState.score / 100) * 100,
    ),
    fallSpeed:
      baseSettings.fallSpeed + Math.floor(gameState.score / 100) * 0.05,
  };

  // Spawn new character
  const spawnChar = useCallback(() => {
    const char = getRandomChar();
    const x = Math.random() * (GAME_WIDTH - 10) + 5;

    console.log(`SPAWN: ${char} at x=${x}, speed=${difficulty.fallSpeed}`);

    // Update ref directly
    const newChar = {
      id: `${Date.now()}-${Math.random()}`,
      char,
      x,
      y: 0,
      speed: difficulty.fallSpeed + Math.random() * 0.2,
    };

    fallingCharsRef.current = [...fallingCharsRef.current, newChar];
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
      particlesRef.current = [...particlesRef.current, ...newParticles];
    },
    [],
  );

  // Game loop
  const gameLoop = useCallback(() => {
    // 使用 ref 获取最新状态，避免闭包捕获旧值
    const gs = gameStateRef.current;
    if (!gs.isPlaying || gs.isPaused) return;

    const now = performance.now();
    // Cap delta to avoid huge jumps on resume (e.g. max 100ms)
    // If lastFrameTimeRef is 0 (first frame), use small delta
    const delta =
      lastFrameTimeRef.current > 0
        ? Math.min(now - lastFrameTimeRef.current, 100)
        : 16.67;
    lastFrameTimeRef.current = now;

    // Use Ref as source of truth
    const currentChars = fallingCharsRef.current;

    // 1. Move characters (Time-based: speed is units per 16.67ms frame)
    // speed is vh/frame at 60fps.
    // distance = speed * (delta / 16.667)
    const timeScale = delta / 16.667;

    const movedChars = currentChars.map((char) => {
      // If already hit (exploding), don't move
      if (char.isHit) return char;
      return {
        ...char,
        y: char.y + char.speed * timeScale,
      };
    });

    // 2. Check Wall Collisions
    // Remove buffer so char disappears exactly at wall
    const HIT_BUFFER = 0;
    const wallHits = movedChars.filter(
      (char) => char.y >= WALL_Y + HIT_BUFFER && !char.isHit,
    );

    // 3. Identify Survivors (keep those that haven't hit wall OR are exploding)
    const survivors = movedChars.filter(
      (char) => char.y < WALL_Y + HIT_BUFFER || char.isHit,
    );

    // Update Ref with new positions immediatey
    fallingCharsRef.current = survivors;

    // 4. Update Health (Side Effect)
    // Filter out hits that have already been processed
    const newHits = wallHits.filter(
      (char) => !processedHitsRef.current.has(char.id),
    );

    if (newHits.length > 0) {
      // Mark as processed immediately
      newHits.forEach((char) => {
        processedHitsRef.current.add(char.id);
        // Add blood effect (red explosion)
        createExplosion(char.x, char.y, "#ef4444");
      });

      setGameState((gs) => {
        const newHealth = gs.health - newHits.length;
        // Play damage sound if health decreased
        if (newHealth < gs.health) {
          soundManager.playDamage();
        }

        if (newHealth <= 0) {
          return {
            ...gs,
            health: 0,
            isPlaying: false,
            isGameOver: true,
            combo: 0,
            maxCombo: 0,
            difficulty: gs.difficulty,
          };
        }
        return {
          ...gs,
          health: newHealth,
          combo: 0,
        };
      });
    }

    // 5. Update Particles
    if (particlesRef.current.length > 0) {
      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx * timeScale,
          y: p.y + p.vy * timeScale,
          vy: (p.vy + 0.2) * timeScale, // Gravity
          life: p.life - 0.02 * timeScale,
        }))
        .filter((p) => p.life > 0);
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [createExplosion]); // 不依赖 gameState，通过 ref 访问

  // Particle animation merged into gameLoop
  // useEffect removed

  // Start game loop
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused) {
      lastFrameTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(gameLoop);

      const scheduleSpawn = () => {
        spawnTimeoutRef.current = setTimeout(
          () => {
            // 使用 ref 获取最新状态
            const gs = gameStateRef.current;
            if (gs.isPlaying && !gs.isPaused) {
              spawnChar();
              scheduleSpawn();
            }
          },
          difficulty.spawnInterval + Math.random() * 500,
        );
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
  }, [
    gameState.isPlaying,
    gameState.isPaused,
    gameLoop,
    spawnChar,
    difficulty.spawnInterval,
  ]);

  // Handle morse code input
  const addDit = useCallback(() => {
    soundManager.playDit();
    setCurrentPattern((p) => p + "·");
  }, []);

  const addDah = useCallback(() => {
    soundManager.playDah();
    setCurrentPattern((p) => p + "−");
  }, []);

  const handleBackspace = useCallback(() => {
    setCurrentPattern((p) => p.slice(0, -1));
  }, []);

  const clearPattern = useCallback(() => {
    setCurrentPattern("");
  }, []);

  // Ref for falling chars to access in effect without dependency issues
  // const fallingCharsRef = useRef(fallingChars);
  // useEffect(() => {
  //   fallingCharsRef.current = fallingChars;
  // }, [fallingChars]);

  // Check pattern match
  useEffect(() => {
    if (!currentPattern) return;

    const chars = fallingCharsRef.current;

    // Find if pattern matches any falling char exactly
    const matchIndex = chars.findIndex((c) => {
      const p = MORSE_CODE.find((m) => m.char === c.char)?.pattern;
      // Note: isHit checks aren't strictly needed for match as isHit chars won't be matched?
      // Actually we want to ignore isHit ones.
      return p === currentPattern && !c.isHit;
    });

    if (matchIndex !== -1) {
      // Hit!
      // Update Ref first!
      const chars = fallingCharsRef.current;
      const idx = chars.findIndex((c) => c.id === chars[matchIndex].id);

      if (idx !== -1) {
        const newChars = [...chars];
        newChars[idx] = { ...newChars[idx], isHit: true };
        fallingCharsRef.current = newChars;

        createExplosion(newChars[idx].x, newChars[idx].y);
        // Note: No setFallingChars, canvas will pick this up next frame

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

        // Remove after animation
        setTimeout(() => {
          fallingCharsRef.current = fallingCharsRef.current.filter(
            (c) => c.id !== chars[idx].id,
          );
        }, 200);
      }

      clearPattern();
    } else {
      // No exact match, check if it's a prefix of any falling char
      const chars = fallingCharsRef.current;
      const isPrefix = chars.some((c) => {
        const p = MORSE_CODE.find((m) => m.char === c.char)?.pattern;
        return p?.startsWith(currentPattern) && !c.isHit;
      });

      if (!isPrefix) {
        // Not a valid prefix for any current target, clear it
        soundManager.playError();
        clearPattern();
      }
    }
  }, [currentPattern, clearPattern, createExplosion]);

  const startGame = (difficulty: DifficultyLevel = "MEDIUM") => {
    console.error("ACTION: startGame called with difficulty:", difficulty);
    setGameState({
      score: 0,
      health: MAX_HEALTH,
      isPlaying: true,
      isPaused: false,
      isGameOver: false,
      combo: 0,
      maxCombo: 0,
      difficulty,
    });
    fallingCharsRef.current = [];
    particlesRef.current = [];
    setCurrentPattern("");
    processedHitsRef.current.clear();
  };

  const pauseGame = () => {
    setGameState((gs) => ({ ...gs, isPaused: !gs.isPaused }));
  };

  const resetGame = () => {
    setGameState((prev) => ({
      score: 0,
      health: MAX_HEALTH,
      isPlaying: false,
      isPaused: false,
      isGameOver: false,
      combo: 0,
      maxCombo: 0,
      difficulty: prev.difficulty,
    }));
    fallingCharsRef.current = [];
    particlesRef.current = [];
    setCurrentPattern("");
    processedHitsRef.current.clear();
  };

  return {
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
  };
}
