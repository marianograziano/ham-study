import { useCallback, useEffect, useRef, useState } from "react";
import { soundManager } from "../game/SoundManager";

export type RXGameState = {
  isPlaying: boolean;
  score: number;
  highScore: number;
  wpm: number;
  noiseLevel: number; // 0-100
  qsb: number; // 0-100 (Signal Fading)
  farnsworth: number; // Extra spacing
  currentTarget: string;
  userInput: string;
  status: "idle" | "playing_audio" | "waiting_input" | "success" | "failure";
};

const WORDS = [
  "CQ",
  "DE",
  "K",
  "R",
  "TNX",
  "73",
  "QSO",
  "QTH",
  "RST",
  "NAME",
  "WX",
  "RIG",
  "ANT",
  "PWR",
  "HW",
  "BK",
  "TEST",
  "UR",
  "ES",
  "FB",
  "DX",
  "GA",
  "GM",
  "GE",
  "GN",
  "TU",
  "FER",
  "VY",
  "PSE",
  "AGN",
  "ABT",
  "ADR",
  "AGE",
  "BD",
  "B4",
  "BF",
  "BN",
  "BT",
  "BTR",
  "CALL",
  "CFM",
  "CK",
  "CL",
  "CLD",
  "CLR",
  "CUD",
  "CUL",
  "CW",
  "DM",
  "DR",
  "EE",
  "EL",
  "FB",
  "FINE",
  "FREQ",
  "GB",
  "GUD",
  "HI",
  "HPE",
  "HR",
  "HV",
  "II",
  "INFO",
  "LID",
  "LNG",
  "LTR",
  "LV",
  "MA",
  "MILL",
  "MNI",
  "MSG",
  "N",
  "NIL",
  "NR",
  "NW",
  "OB",
  "OC",
  "OM",
  "OP",
  "OT",
  "PBL",
  "PKG",
  "PSE",
  "PT",
  "PWR",
  "PX",
  "R",
  "RCVR",
  "REF",
  "RFI",
  "RIG",
  "RPT",
  "RQ",
  "RST",
  "RX",
  "SA",
  "SED",
  "SIG",
  "SINE",
  "SK",
  "SL",
  "SN",
  "SORRY",
  "SRI",
  "SS",
  "SSB",
  "STN",
  "SUM",
  "SURE",
  "SWL",
  "T",
  "TMW",
  "TNX",
  "TR",
  "TKS",
  "TU",
  "TX",
  "TXT",
  "U",
  "UR",
  "VFO",
  "VY",
  "WA",
  "WID",
  "WK",
  "WKD",
  "WKG",
  "WL",
  "WUD",
  "WX",
  "XCVR",
  "XMTR",
  "XYL",
  "Y",
  "YL",
  "YR",
  "73",
  "88",
];

const GENERATE_CALLSIGN = () => {
  const P1 = [
    "K",
    "W",
    "N",
    "A",
    "AA",
    "AB",
    "AC",
    "AD",
    "AE",
    "AF",
    "AG",
    "AI",
    "AJ",
    "AK",
    "AL",
  ];
  const N = Math.floor(Math.random() * 10).toString();
  const S = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const S3 = S() + S() + S();
  return (
    P1[Math.floor(Math.random() * P1.length)] +
    N +
    S3.substring(0, 1 + Math.floor(Math.random() * 3))
  );
};

export function useCwRxGameLogic() {
  const [gameState, setGameState] = useState<RXGameState>({
    isPlaying: false,
    score: 0,
    highScore: 0,
    wpm: 20,
    noiseLevel: 0,
    qsb: 0,
    farnsworth: 20,
    currentTarget: "",
    userInput: "",
    status: "idle",
  });

  const activeOscillatorRef = useRef<OscillatorNode | null | undefined>(null);

  // Stop sound on unmount
  useEffect(() => {
    return () => {
      if (activeOscillatorRef.current) {
        try {
          activeOscillatorRef.current.stop();
        } catch (_e) {}
      }
      soundManager.stopNoise();
    };
  }, []);

  // Noise Control
  useEffect(() => {
    if (gameState.isPlaying && gameState.noiseLevel > 0) {
      soundManager.startNoise(gameState.noiseLevel / 100);
    } else {
      soundManager.stopNoise();
    }
  }, [gameState.isPlaying, gameState.noiseLevel]);

  // QSB Control
  useEffect(() => {
    if (gameState.isPlaying && gameState.qsb >= 0) {
      soundManager.setQsb(gameState.qsb);
    } else {
      soundManager.stopQsb();
    }
  }, [gameState.isPlaying, gameState.qsb]);

  // Load Persistence
  useEffect(() => {
    try {
      const savedWpm = localStorage.getItem("ham-study:cw-rx:wpm");
      const savedNoise = localStorage.getItem("ham-study:cw-rx:noise");
      const savedQsb = localStorage.getItem("ham-study:cw-rx:qsb");
      const savedFarnsworth = localStorage.getItem(
        "ham-study:cw-rx:farnsworth",
      );
      const savedHighScore = localStorage.getItem("ham-study:cw-rx:highScore");

      if (
        savedWpm ||
        savedNoise ||
        savedFarnsworth ||
        savedHighScore ||
        savedQsb
      ) {
        setGameState((prev) => ({
          ...prev,
          wpm: savedWpm ? Number.parseInt(savedWpm, 10) : prev.wpm,
          noiseLevel: savedNoise
            ? Number.parseInt(savedNoise, 10)
            : prev.noiseLevel,
          qsb: savedQsb ? Number.parseInt(savedQsb, 10) : prev.qsb,
          farnsworth: savedFarnsworth
            ? Number.parseInt(savedFarnsworth, 10)
            : prev.farnsworth,
          highScore: savedHighScore
            ? Number.parseInt(savedHighScore, 10)
            : prev.highScore,
        }));
      }
    } catch (_e) {
      // ignore
    }
  }, []);

  // Save Persistence
  useEffect(() => {
    try {
      localStorage.setItem("ham-study:cw-rx:wpm", gameState.wpm.toString());
      localStorage.setItem(
        "ham-study:cw-rx:noise",
        gameState.noiseLevel.toString(),
      );
      localStorage.setItem("ham-study:cw-rx:qsb", gameState.qsb.toString());
      localStorage.setItem(
        "ham-study:cw-rx:farnsworth",
        gameState.farnsworth.toString(),
      );
    } catch (_e) {
      // ignore
    }
  }, [
    gameState.wpm,
    gameState.noiseLevel,
    gameState.farnsworth,
    gameState.qsb,
  ]);

  const playNext = useCallback(() => {
    // Pick a word or callsign
    let nextText = "";
    if (Math.random() > 0.5) {
      nextText = WORDS[Math.floor(Math.random() * WORDS.length)];
    } else {
      nextText = GENERATE_CALLSIGN();
    }

    setGameState((prev: RXGameState) => ({
      ...prev,
      currentTarget: nextText,
      userInput: "",
      status: "playing_audio",
    }));

    activeOscillatorRef.current = soundManager.playSequence(
      nextText,
      gameState.wpm,
      600,
      () => {
        setGameState((prev: RXGameState) => ({
          ...prev,
          status: "waiting_input",
        }));
        activeOscillatorRef.current = null;
      },
      gameState.farnsworth,
    );
  }, [gameState.wpm, gameState.farnsworth]);

  const startGame = useCallback(() => {
    setGameState((prev: RXGameState) => ({
      ...prev,
      isPlaying: true,
      score: 0,
      status: "idle",
    }));
    // Small delay
    setTimeout(playNext, 500);
  }, [playNext]);

  const stopGame = useCallback(() => {
    setGameState((prev: RXGameState) => ({
      ...prev,
      isPlaying: false,
      status: "idle",
      currentTarget: "",
    }));
    if (activeOscillatorRef.current) {
      try {
        activeOscillatorRef.current.stop();
      } catch (_e) {}
      activeOscillatorRef.current = null;
    }
  }, []);

  const submitInput = useCallback(() => {
    setGameState((prev: RXGameState) => {
      if (prev.status !== "waiting_input") return prev;

      const isCorrect =
        prev.userInput.trim().toUpperCase() === prev.currentTarget;

      if (isCorrect) {
        // Correct!
        soundManager.playSuccess();
        setTimeout(playNext, 1000);
        const newScore = prev.score + 10 + Math.floor(prev.wpm / 5);
        // Update High Score if needed
        let newHighScore = prev.highScore;
        if (newScore > prev.highScore) {
          newHighScore = newScore;
          localStorage.setItem(
            "ham-study:cw-rx:highScore",
            newHighScore.toString(),
          );
        }

        return {
          ...prev,
          score: newScore,
          highScore: newHighScore,
          status: "success",
        };
      } else {
        // Wrong
        soundManager.playError();
        setTimeout(playNext, 2000);
        return {
          ...prev,
          score: Math.max(0, prev.score - 5),
          status: "failure",
        };
      }
    });
  }, [playNext]);

  // Handle Input
  const handleInputChange = useCallback((val: string) => {
    setGameState((prev: RXGameState) => {
      // Auto submit if length matches (optional, maybe distinct Enter key needed?)
      // For now, let's keep it manual or auto-submit on exact match length?
      // "Enter" key is better UX.
      return {
        ...prev,
        userInput: val.toUpperCase(),
      };
    });
  }, []);

  const replayAudio = useCallback(() => {
    if (gameState.status === "waiting_input" && gameState.currentTarget) {
      setGameState((prev: RXGameState) => ({
        ...prev,
        status: "playing_audio",
      }));
      activeOscillatorRef.current = soundManager.playSequence(
        gameState.currentTarget,
        gameState.wpm,
        600,
        () => {
          setGameState((prev: RXGameState) => ({
            ...prev,
            status: "waiting_input",
          }));
          activeOscillatorRef.current = null;
        },
        gameState.farnsworth,
      );
    }
  }, [
    gameState.currentTarget,
    gameState.wpm,
    gameState.status,
    gameState.farnsworth,
  ]);

  return {
    gameState,
    setGameState,
    startGame,
    stopGame,
    handleInputChange,
    submitInput,
    replayAudio,
  };
}
