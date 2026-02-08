import { useCallback, useEffect, useRef, useState } from "react";
import { MORSE_CODE_MAP } from "~/components/tools/cw/constants";
import {
  FALL_SPEED_INITIAL,
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

export function useCwGameLogic() {
  const animationRef = useRef<number>(0);
  const spawnTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const processedHitsRef = useRef<Set<string>>(new Set());
  const lastFrameTimeRef = useRef<number>(0);
  const fallingCharsSourceRef = useRef<FallingChar[]>([]);

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

  // 使用 ref 追踪最新 gameState，解决闭包问题
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [fallingChars, setFallingChars] = useState<FallingChar[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [currentPattern, setCurrentPattern] = useState<string>("");

  // Difficulty scaling
  const difficulty = {
    spawnInterval: Math.max(
      800,
      SPAWN_INTERVAL_INITIAL - Math.floor(gameState.score / 100) * 100,
    ),
    fallSpeed: FALL_SPEED_INITIAL + Math.floor(gameState.score / 100) * 0.05,
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

    fallingCharsSourceRef.current = [...fallingCharsSourceRef.current, newChar];
    // Sync to state for render
    setFallingChars(fallingCharsSourceRef.current);
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
    const currentChars = fallingCharsSourceRef.current;

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
    // Add a buffer (5%) so the char visually crosses the wall before disappearing
    const HIT_BUFFER = 5;
    const wallHits = movedChars.filter(
      (char) => char.y >= WALL_Y + HIT_BUFFER && !char.isHit,
    );

    // 3. Identify Survivors (keep those that haven't hit wall OR are exploding)
    const survivors = movedChars.filter(
      (char) => char.y < WALL_Y + HIT_BUFFER || char.isHit,
    );

    // Update Ref with new positions immediatey
    fallingCharsSourceRef.current = survivors;

    // 4. Update Health (Side Effect)
    // Filter out hits that have already been processed
    const newHits = wallHits.filter(
      (char) => !processedHitsRef.current.has(char.id),
    );

    if (newHits.length > 0) {
      // Mark as processed immediately
      newHits.forEach((char) => {
        processedHitsRef.current.add(char.id);
      });

      setGameState((gs) => {
        const newHealth = gs.health - newHits.length;
        if (newHealth <= 0) {
          return {
            ...gs,
            health: 0,
            isPlaying: false,
            isGameOver: true,
            combo: 0,
            maxCombo: 0,
          };
        }
        return {
          ...gs,
          health: newHealth,
          combo: 0,
        };
      });
    }

    // 5. Update Falling Chars State
    // We update state to trigger render.
    // Optimization: only update if positions changed significantly or count changed?
    // For now, always update to ensure smooth animation
    setFallingChars(survivors);

    animationRef.current = requestAnimationFrame(gameLoop);
  }, []); // 不依赖 gameState，通过 ref 访问

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
          .filter((p) => p.life > 0),
      );
    }, 33);

    return () => clearInterval(interval);
  }, [particles.length]);

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

  // Ref for falling chars to access in effect without dependency issues
  // const fallingCharsRef = useRef(fallingChars);
  // useEffect(() => {
  //   fallingCharsRef.current = fallingChars;
  // }, [fallingChars]);

  // Audio context for sound effects
  const playErrorSound = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  }, []);

  // Check pattern match
  useEffect(() => {
    if (!currentPattern) return;

    const chars = fallingCharsSourceRef.current;

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
      const chars = fallingCharsSourceRef.current;
      const idx = chars.findIndex((c) => c.id === chars[matchIndex].id);

      if (idx !== -1) {
        const newChars = [...chars];
        newChars[idx] = { ...newChars[idx], isHit: true };
        fallingCharsSourceRef.current = newChars;

        createExplosion(newChars[idx].x, newChars[idx].y);
        // Update state to render explosion
        setFallingChars(newChars);

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
          fallingCharsSourceRef.current = fallingCharsSourceRef.current.filter(
            (c) => c.id !== chars[idx].id,
          );
          setFallingChars(fallingCharsSourceRef.current);
        }, 200);
      }

      clearPattern();
    } else {
      // No exact match, check if it's a prefix of any falling char
      const chars = fallingCharsSourceRef.current;
      const isPrefix = chars.some((c) => {
        const p = MORSE_CODE.find((m) => m.char === c.char)?.pattern;
        return p?.startsWith(currentPattern) && !c.isHit;
      });

      if (!isPrefix) {
        // Not a valid prefix for any current target, clear it
        playErrorSound();
        clearPattern();
      }
    }
  }, [currentPattern, clearPattern, createExplosion, playErrorSound]);

  // Game controls
  const startGame = () => {
    console.error("ACTION: startGame called");
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
    fallingCharsSourceRef.current = [];
    setParticles([]);
    setCurrentPattern("");
    processedHitsRef.current.clear();
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
    fallingCharsSourceRef.current = [];
    setParticles([]);
    setCurrentPattern("");
    processedHitsRef.current.clear();
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
