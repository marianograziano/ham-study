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
  qsoMode: boolean; // Text will be QSO style sentences
  chineseCallsigns: boolean; // Only generate Chinese callsigns
};

const WORDS = [
  // Q-Codes (Comprehensive List)
  "QRA",
  "QRB",
  "QRG",
  "QRI",
  "QRJ",
  "QRK",
  "QRL",
  "QRM",
  "QRN",
  "QRO",
  "QRP",
  "QRQ",
  "QRS",
  "QRT",
  "QRU",
  "QRV",
  "QRW",
  "QRX",
  "QRZ",
  "QSA",
  "QSB",
  "QSD",
  "QSL",
  "QSO",
  "QSP",
  "QSU",
  "QSV",
  "QSW",
  "QSX",
  "QSY",
  "QSZ",
  "QTB",
  "QTC",
  "QTH",
  "QTR",

  // Common Abbreviations
  "CQ",
  "DE",
  "K",
  "R",
  "TNX",
  "73",
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
  "88",
  "55",
  "73",
];

const GENERATE_CALLSIGN = (chineseOnly: boolean = false) => {
  if (chineseOnly) {
    // Chinese Callsign Rule: B[A-Z][0-9][A-Z]{2,3}
    // Prefixes: BA, BD, BG, BY, BH, BI... usually B + Letter
    const prefixes = ["BA", "BD", "BG", "BY", "BH", "BI"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const zone = Math.floor(Math.random() * 10).toString();

    // Suffix: 2 or 3 letters
    const suffixLen = 2 + Math.floor(Math.random() * 2);
    let suffix = "";
    for (let i = 0; i < suffixLen; i++) {
      suffix += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    }
    return prefix + zone + suffix;
  } else {
    // International
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
      "JA",
      "JH",
      "JR",
      "JE",
      "JF",
      "JG",
      "JI",
      "JJ",
      "JK",
      "JL",
      "JM",
      "JN",
      "JO",
      "JP",
      "JQ",
      "JS",
      "G",
      "M",
      "2E",
      "VE",
      "VA",
      "VK",
      "ZL",
    ];
    const N = Math.floor(Math.random() * 10).toString();
    const S = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
    // 1 to 3 letters
    const sLen = 1 + Math.floor(Math.random() * 3);
    let suffix = "";
    for (let i = 0; i < sLen; i++) {
      suffix += S();
    }
    return P1[Math.floor(Math.random() * P1.length)] + N + suffix;
  }
};

const GENERATE_QSO = (chineseCallsigns: boolean) => {
  // Generate a short QSO exchange
  // Patterns:
  // 1. CQ CQ DE [CALL] [CALL] K
  // 2. [CALL] DE [CALL] [RST] [RST] K
  // 3. [CALL] DE [CALL] UR RST 599 599 K
  // 4. [CALL] DE [CALL] QSL ? K
  // 5. TNX 73 TU E E

  const myCall = GENERATE_CALLSIGN(chineseCallsigns);
  const otherCall = GENERATE_CALLSIGN(chineseCallsigns);

  const patterns = [
    `CQ CQ DE ${myCall} ${myCall} K`,
    `${otherCall} DE ${myCall} K`,
    `${otherCall} DE ${myCall} = GA UR RST 599 599 = K`, // = is BT
    `R ${otherCall} DE ${myCall} = TNX FB QSO 73 TU`,
    `${otherCall} DE ${myCall} QSL ? K`,
    `CQ CQ CQ DE ${myCall} ${myCall} PSE K`,
    `${otherCall} DE ${myCall} KN`,
    `QRZ ? DE ${myCall} K`,
  ];

  return patterns[Math.floor(Math.random() * patterns.length)];
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
    qsoMode: false,
    chineseCallsigns: false,
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
      const savedQsoMode = localStorage.getItem("ham-study:cw-rx:qsoMode");
      const savedCnCall = localStorage.getItem("ham-study:cw-rx:cnCall");

      if (
        savedWpm ||
        savedNoise ||
        savedFarnsworth ||
        savedHighScore ||
        savedQsb ||
        savedQsoMode ||
        savedCnCall
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
          qsoMode: savedQsoMode === "true",
          chineseCallsigns: savedCnCall === "true",
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
      localStorage.setItem(
        "ham-study:cw-rx:qsoMode",
        gameState.qsoMode.toString(),
      );
      localStorage.setItem(
        "ham-study:cw-rx:cnCall",
        gameState.chineseCallsigns.toString(),
      );
    } catch (_e) {
      // ignore
    }
  }, [
    gameState.wpm,
    gameState.noiseLevel,
    gameState.farnsworth,
    gameState.qsb,
    gameState.qsoMode,
    gameState.chineseCallsigns,
  ]);

  const playNext = useCallback(() => {
    // Pick a word or callsign depending on mode
    let nextText = "";

    if (gameState.qsoMode) {
      nextText = GENERATE_QSO(gameState.chineseCallsigns);
    } else {
      if (Math.random() > 0.5) {
        nextText = WORDS[Math.floor(Math.random() * WORDS.length)];
      } else {
        nextText = GENERATE_CALLSIGN(gameState.chineseCallsigns);
      }
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
  }, [
    gameState.wpm,
    gameState.farnsworth,
    gameState.qsoMode,
    gameState.chineseCallsigns,
  ]);

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

      // Clean up input and target for comparison
      // Allow some flexibility? For now exact match.
      const cleanInput = prev.userInput
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");
      const cleanTarget = prev.currentTarget
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

      const isCorrect = cleanInput === cleanTarget;

      if (isCorrect) {
        // Correct!
        soundManager.playSuccess();
        setTimeout(playNext, 1000);
        // Score calc: base 10 + wpm. QSO mode gives bonus.
        let scoreAdd = 10 + Math.floor(prev.wpm / 5);
        if (prev.qsoMode) scoreAdd *= 2; // Bonus for longer text

        const newScore = prev.score + scoreAdd;
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
