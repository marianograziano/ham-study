import { useCallback, useEffect, useRef, useState } from "react";
import { CODE_TO_CHAR, PRACTICE_TEXTS, SPEED_SETTINGS } from "./constants";
import type { SpeedMode } from "./types";

export const useCwGame = () => {
  const [currentPath, setCurrentPath] = useState("");
  const [lastChar, setLastChar] = useState("");
  const [message, setMessage] = useState("");
  const [isSoundEnabled] = useState(true);
  const [activeSignal, setActiveSignal] = useState<string | null>(null);
  const [speedMode, setSpeedMode] = useState<SpeedMode>("intermediate");

  // === 练习模式状态 ===
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceText, setPracticeText] = useState(PRACTICE_TEXTS[0].text);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceStats, setPracticeStats] = useState({
    wpm: 0,
    startTime: null as number | null,
    correct: 0,
  });
  const [lastInputCorrect, setLastInputCorrect] = useState<boolean | null>(
    null,
  );

  // === 编辑模式状态 ===
  const [isEditing, setIsEditing] = useState(false);
  const [customTextBuffer, setCustomTextBuffer] = useState("");

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

  const changePracticeText = () => {
    const currentIndex = PRACTICE_TEXTS.findIndex(
      (t) => t.text === practiceText,
    );
    const nextIndex = (currentIndex + 1) % PRACTICE_TEXTS.length;
    setPracticeText(PRACTICE_TEXTS[nextIndex].text);
    setPracticeIndex(0);
    setPracticeStats({ wpm: 0, startTime: null, correct: 0 });
    setLastInputCorrect(null);
    setCurrentPath("");
    clearTimers();
  };

  // 打开自定义编辑框
  const openCustomTextModal = () => {
    setCustomTextBuffer(practiceText);
    setIsEditing(true);
  };

  // 保存自定义文本
  const saveCustomText = () => {
    // 过滤非法字符
    const cleanText = customTextBuffer
      .toUpperCase()
      .replace(/[^A-Z0-9 .,?=/]/g, "")
      .trim();
    if (cleanText) {
      setPracticeText(cleanText);
      setPracticeIndex(0);
      setPracticeStats({ wpm: 0, startTime: null, correct: 0 });
      setLastInputCorrect(null);
      setCurrentPath("");
      clearTimers();
    }
    setIsEditing(false);
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

  const startSpaceTimer = useCallback(() => {
    if (isPracticeMode && practiceText[practiceIndex] === " ") {
      wordTimeoutRef.current = setTimeout(() => {
        setPracticeIndex((prev) => prev + 1);
        setLastInputCorrect(true);
      }, currentSpeed.wordDelay);
    }
  }, [isPracticeMode, practiceText, practiceIndex, currentSpeed]);

  const addDit = useCallback(() => {
    if (currentPath.length < 8) {
      clearTimers();

      if (isPracticeMode && practiceText[practiceIndex] === " ") {
        setLastChar("WAIT!");
        setLastInputCorrect(false);
        playBeep(0.3, "sawtooth");
        setCurrentPath("");
        startSpaceTimer();
        return;
      }

      setCurrentPath((prev) => `${prev}.`);
      playBeep(0.08);
      triggerSignal("dit");
    }
  }, [
    currentPath,
    triggerSignal,
    clearTimers,
    playBeep,
    isPracticeMode,
    practiceText,
    practiceIndex,
    startSpaceTimer,
  ]);

  const addDah = useCallback(() => {
    if (currentPath.length < 8) {
      clearTimers();

      if (isPracticeMode && practiceText[practiceIndex] === " ") {
        setLastChar("WAIT!");
        setLastInputCorrect(false);
        playBeep(0.3, "sawtooth");
        setCurrentPath("");
        startSpaceTimer();
        return;
      }

      setCurrentPath((prev) => `${prev}-`);
      playBeep(0.2);
      triggerSignal("dah");
    }
  }, [
    currentPath,
    triggerSignal,
    clearTimers,
    playBeep,
    isPracticeMode,
    practiceText,
    practiceIndex,
    startSpaceTimer,
  ]);

  const commitChar = useCallback(() => {
    if (currentPath) {
      const char = CODE_TO_CHAR[currentPath];

      if (isPracticeMode) {
        const targetChar = practiceText[practiceIndex];

        if (char === targetChar) {
          setLastInputCorrect(true);
          setLastChar(char);

          if (practiceStats.startTime === null) {
            setPracticeStats((prev) => ({ ...prev, startTime: Date.now() }));
          }

          const nextIndex = practiceIndex + 1;

          if (practiceStats.startTime) {
            const elapsedMin = (Date.now() - practiceStats.startTime) / 60000;
            const wpm = Math.round(nextIndex / 5 / elapsedMin) || 0;
            setPracticeStats((prev) => ({ ...prev, wpm }));
          }

          setPracticeIndex(nextIndex);
          if (nextIndex >= practiceText.length) {
            setLastChar("WIN");
            setTimeout(() => {
              setPracticeIndex(0);
              setPracticeStats({ wpm: 0, startTime: null, correct: 0 });
            }, 2000);
          }
        } else {
          setLastInputCorrect(false);
          setLastChar("ERR");
          playBeep(0.3, "sawtooth");
        }
      } else {
        if (char) {
          setLastChar(char);
          setMessage((prev) => `${prev}${char}`);
        } else {
          setMessage((prev) => `${prev}?`);
        }
        wordTimeoutRef.current = setTimeout(() => {
          setMessage((prev) => (prev.endsWith(" ") ? prev : `${prev} `));
        }, currentSpeed.wordDelay);
      }
      setCurrentPath("");
    }
  }, [
    currentPath,
    currentSpeed,
    isPracticeMode,
    practiceText,
    practiceIndex,
    practiceStats,
    playBeep,
  ]);

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
      if (!isPracticeMode) setMessage((prev) => prev.slice(0, -1));
    }
  }, [currentPath, commitChar, currentSpeed, clearTimers, isPracticeMode]);

  // Handle Space Timer for Practice Mode
  useEffect(() => {
    if (isPracticeMode && practiceText[practiceIndex] === " ") {
      startSpaceTimer();
    }
    return () => clearTimers();
  }, [
    practiceIndex,
    isPracticeMode,
    practiceText,
    startSpaceTimer,
    clearTimers,
  ]);

  // Watch for Error Signal (8 dots)
  useEffect(() => {
    if (currentPath === "........") {
      clearTimers();
      setCurrentPath("");
      if (!isPracticeMode) setMessage((prev) => prev.slice(0, -1));
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
  }, [
    currentPath,
    commitChar,
    currentSpeed,
    clearTimers,
    playBeep,
    isPracticeMode,
  ]);

  const reset = useCallback(() => {
    setCurrentPath("");
    setLastChar("");
    setMessage("");
    if (isPracticeMode) {
      setPracticeIndex(0);
      setPracticeStats({ wpm: 0, startTime: null, correct: 0 });
    }
    clearTimers();
    inputRef.current?.blur();
  }, [clearTimers, isPracticeMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return; // 编辑模式下不拦截

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
        if (isPracticeMode) return;
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
  }, [
    addDit,
    addDah,
    commitChar,
    handleBackspace,
    reset,
    isEditing,
    isPracticeMode,
  ]);

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
    // Practice Mode Exports
    isPracticeMode,
    setIsPracticeMode,
    practiceText,
    practiceIndex,
    practiceStats,
    changePracticeText,
    openCustomTextModal,
    saveCustomText,
    lastInputCorrect,
    isEditing,
    setIsEditing,
    customTextBuffer,
    setCustomTextBuffer,
  };
};
