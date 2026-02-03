import { useCallback, useEffect, useRef, useState } from "react";
import { CODE_TO_CHAR, SPEED_SETTINGS } from "./constants";
import type { SpeedMode } from "./types";

export const useCwGame = () => {
  const [currentPath, setCurrentPath] = useState("");
  const [lastChar, setLastChar] = useState("");
  const [message, setMessage] = useState("");
  const [isSoundEnabled] = useState(true);
  const [activeSignal, setActiveSignal] = useState<string | null>(null);
  const [speedMode, setSpeedMode] = useState<SpeedMode>("intermediate");

  const charTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentSpeed = SPEED_SETTINGS[speedMode];

  // 自动清除大字提示
  useEffect(() => {
    if (lastChar) {
      const timer = setTimeout(() => {
        setLastChar("");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [lastChar]);

  const cycleSpeed = () => {
    setSpeedMode((prev) => {
      if (prev === "beginner") return "intermediate";
      if (prev === "intermediate") return "advanced";
      return "beginner";
    });
  };

  const playBeep = useCallback(
    (duration: number, type: OscillatorType = "sine") => {
      if (!isSoundEnabled) return;
      try {
        const audioCtx = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = type;

        const freq = type === "sawtooth" ? 150 : 800;
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

        const now = audioCtx.currentTime;
        const attack = 0.005;
        const release = 0.005;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + attack);
        gainNode.gain.setValueAtTime(0.1, now + duration - release);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(now + duration + 0.1);
      } catch (_e) {}
    },
    [isSoundEnabled],
  );

  const triggerSignal = useCallback((type: string) => {
    setActiveSignal(type);
    setTimeout(() => setActiveSignal(null), 150);
  }, []);

  const clearTimers = useCallback(() => {
    if (charTimeoutRef.current) clearTimeout(charTimeoutRef.current);
    if (wordTimeoutRef.current) clearTimeout(wordTimeoutRef.current);
  }, []);

  const addDit = useCallback(() => {
    if (currentPath.length < 8) {
      clearTimers();
      setCurrentPath((prev) => `${prev}.`);
      playBeep(0.08);
      triggerSignal("dit");
    }
  }, [currentPath, triggerSignal, clearTimers, playBeep]);

  const addDah = useCallback(() => {
    if (currentPath.length < 8) {
      clearTimers();
      setCurrentPath((prev) => `${prev}-`);
      playBeep(0.2);
      triggerSignal("dah");
    }
  }, [currentPath, triggerSignal, clearTimers, playBeep]);

  const commitChar = useCallback(() => {
    if (currentPath) {
      const char = CODE_TO_CHAR[currentPath];
      if (char) {
        setLastChar(char);
        setMessage((prev) => `${prev}${char}`);
      } else {
        setMessage((prev) => `${prev}?`);
      }
      setCurrentPath("");

      wordTimeoutRef.current = setTimeout(() => {
        setMessage((prev) => (prev.endsWith(" ") ? prev : `${prev} `));
      }, currentSpeed.wordDelay);
    }
  }, [currentPath, currentSpeed]);

  const handleBackspace = useCallback(() => {
    if (currentPath.length > 0) {
      setCurrentPath((prev) => prev.slice(0, -1));
      clearTimers();
      if (currentPath.length > 1) {
        charTimeoutRef.current = setTimeout(() => {
          commitChar();
        }, currentSpeed.charDelay);
      }
    } else {
      setMessage((prev) => prev.slice(0, -1));
    }
  }, [currentPath, commitChar, currentSpeed, clearTimers]);

  // Watch for Error Signal (8 dots)
  useEffect(() => {
    if (currentPath === "........") {
      clearTimers();
      setCurrentPath("");
      setMessage((prev) => prev.slice(0, -1));
      setLastChar("DEL");
      playBeep(0.3, "sawtooth");
      return;
    }

    if (currentPath) {
      charTimeoutRef.current = setTimeout(() => {
        commitChar();
      }, currentSpeed.charDelay);
    }
    return () => clearTimers();
  }, [currentPath, commitChar, currentSpeed, clearTimers, playBeep]);

  const reset = useCallback(() => {
    setCurrentPath("");
    setLastChar("");
    setMessage("");
    clearTimers();
    inputRef.current?.blur();
  }, [clearTimers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "." || e.key === "ArrowLeft" || e.key.toLowerCase() === "j")
        addDit();
      if (
        e.key === "-" ||
        e.key === "ArrowRight" ||
        e.key.toLowerCase() === "k"
      )
        addDah();
      if (e.key === "Enter") commitChar();
      if (e.key === " ") {
        e.preventDefault();
        commitChar();
        setTimeout(
          () => setMessage((prev) => (prev.endsWith(" ") ? prev : `${prev} `)),
          10,
        );
      }
      if (e.key === "Backspace") {
        handleBackspace();
      }
      if (e.key === "Escape") reset();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addDit, addDah, commitChar, handleBackspace, reset]);

  return {
    currentPath,
    lastChar,
    message,
    setMessage,
    activeSignal,
    speedMode,
    cycleSpeed,
    addDit,
    addDah,
    handleBackspace,
    reset,
    inputRef,
    currentSpeed,
  };
};
