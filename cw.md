```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, Zap, Activity, ArrowLeft, ArrowRight, Trash2, Delete, Gauge, BookOpen, Trophy, Edit3, X, Check } from 'lucide-react';

// === 1. 节点坐标定义 (Balanced Layout) ===
const NODES = {
  // === ROOT ===
  'START': { x: 0, y: 0, type: 'root' },

  // ==============================
  // LEFT SIDE (DIT SIDE / E-SIDE)
  // ==============================

  // Row 0
  'E': { x: -0.8, y: 0, parent: 'START' },
  'I': { x: -2.8, y: 0, parent: 'E' },
  'S': { x: -4.8, y: 0, parent: 'I' }, 
  'H': { x: -5.8, y: 0, parent: 'S' },
  '5': { x: -6.6, y: 0, parent: 'H' },

  // Level 1
  'A': { x: -0.8, y: 0.7, parent: 'E' }, 
  'R': { x: -1.6, y: 0.7, parent: 'A' }, 
  'L': { x: -2.2, y: 0.7, parent: 'R' }, 
  'Ä': { x: -1.6, y: 1.3, parent: 'R' }, 
  '.': { x: -1.6, y: 2.0, parent: 'Ä' },

  'U': { x: -2.8, y: 1.0, parent: 'I' },
  'V': { x: -4.8, y: 1.0, parent: 'S' },
  '4': { x: -5.8, y: 1.0, parent: 'H' },

  // Level 2
  'W': { x: -0.8, y: 2.8, parent: 'A' }, 
  'P': { x: -1.5, y: 2.8, parent: 'W' }, 
  
  // U sub-tree
  'Ü': { x: -2.8, y: 1.8, parent: 'U' }, 
  '2': { x: -2.8, y: 2.6, parent: 'Ü' }, 
  
  // ?
  'IM': { x: -3.2, y: 1.8, parent: 'Ü', type: 'hidden' }, 
  '?': { x: -3.8, y: 1.8, parent: 'IM' },

  'F': { x: -3.6, y: 1.0, parent: 'U' }, 
  '3': { x: -4.8, y: 2.2, parent: 'V' }, 

  // Deep Drops
  'J': { x: -0.8, y: 4.0, parent: 'W' },
  '1': { x: -0.8, y: 5.2, parent: 'J' },

  // ==============================
  // RIGHT SIDE (DAH SIDE / T-SIDE)
  // ==============================

  // Row 0
  'T': { x: 0.8, y: 0, parent: 'START' },
  'M': { x: 3.2, y: 0, parent: 'T' },    
  'O': { x: 5.2, y: 0, parent: 'M' },    
  'CH': { x: 6.2, y: 0, parent: 'O' },   
  '0': { x: 7.0, y: 0, parent: 'CH' },   

  // Level 1
  'N': { x: 0.8, y: 0.7, parent: 'T' }, 
  'K': { x: 1.8, y: 0.7, parent: 'N' }, 
  'Y': { x: 2.8, y: 0.7, parent: 'K' }, 

  'G': { x: 3.2, y: 1.0, parent: 'M' },
  'Ö': { x: 5.2, y: 1.0, parent: 'O' },
  '8': { x: 5.2, y: 2.2, parent: 'Ö' },
  '9': { x: 6.2, y: 1.0, parent: 'CH' },

  // N Sub-tree
  'D': { x: 0.8, y: 1.9, parent: 'N' },
  'B': { x: 0.8, y: 3.1, parent: 'D' },
  '6': { x: 0.8, y: 4.3, parent: 'B' },
  
  '=': { x: 1.6, y: 3.1, parent: 'B' },

  'X': { x: 1.6, y: 1.9, parent: 'D' }, 
  '/': { x: 1.6, y: 2.6, parent: 'X' },

  'C': { x: 1.8, y: 1.4, parent: 'K' }, 

  // M Sub-tree
  'Q': { x: 4.2, y: 1.0, parent: 'G' },
  'Z': { x: 3.2, y: 2.2, parent: 'G' },
  '7': { x: 3.2, y: 3.4, parent: 'Z' },
  
  'MI': { x: 3.8, y: 2.2, parent: 'Z', type: 'hidden' },
  ',': { x: 4.4, y: 2.2, parent: 'MI' },
};

const MORSE_CODE_MAP = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
  '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
  '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
  '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
  '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
  '--..': 'Z',
  '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5',
  '-....': '6', '--...': '7', '---..': '8', '----.': '9', '-----': '0',
  '----': 'CH', '---.': 'Ö', '.-.-': 'Ä', '..--': 'Ü', '..--.': 'Ð',
  '-..-.': '/', '..--..': '?', '.-.-.-': '.', '-...-': '=', '--..--': ','
};

const CODE_TO_CHAR = Object.fromEntries(
  Object.entries(MORSE_CODE_MAP).map(([k, v]) => [k, v])
);

const TEXT_POSITIONS = {
  'E': 'top', 'I': 'top', 'S': 'top', 'H': 'top', '5': 'top',
  'R': 'top', 'L': 'top', 
  'T': 'top', 'M': 'top', 'O': 'top', 'CH': 'top', '0': 'top',
  'K': 'top', 'Y': 'top',
  
  'A': 'right', 'W': 'right', 'J': 'right', '1': 'right', 
  'U': 'right', '2': 'right', 'Ü': 'right', 
  'Q': 'right', '8': 'right', '9': 'right', 
  'C': 'right', 'X': 'right', 'Ö': 'right', 'Ä': 'right',
  '=': 'right', ',': 'right', '/': 'right',
  '.': 'right', 
  
  'N': 'left', 'D': 'left', 'B': 'left', '6': 'left',
  'G': 'left', 'Z': 'left', '7': 'left',
  '4': 'left', 'V': 'left', '3': 'left',
  'F': 'left', 'P': 'left',
  '?': 'left', 'Ð': 'top' 
};

// === 速度预设配置 ===
const SPEED_SETTINGS = {
  beginner: { id: 'beginner', label: 'SLOW', desc: '初级', charDelay: 2000, wordDelay: 4000 },
  intermediate: { id: 'intermediate', label: 'MED', desc: '中级', charDelay: 1000, wordDelay: 2200 },
  advanced: { id: 'advanced', label: 'FAST', desc: '高级', charDelay: 600, wordDelay: 1200 }
};

// === 练习范本 ===
const PRACTICE_TEXTS = [
  { id: 1, title: "基础字母", text: "CQ CQ DE BG8A BG8A K" },
  { id: 2, title: "常用缩写", text: "GM OM UR RST 599 73 TU" },
  { id: 3, title: "SOS信号", text: "SOS SOS SOS DE TITANIC" },
  { id: 4, title: "全字母句", text: "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG" },
  { id: 5, title: "数字练习", text: "12345 67890 555 7388" }
];

export default function App() {
  const [currentPath, setCurrentPath] = useState("");
  const [lastChar, setLastChar] = useState("");
  const [message, setMessage] = useState(""); 
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [activeSignal, setActiveSignal] = useState(null); 
  const [speedMode, setSpeedMode] = useState('intermediate'); 
  
  // === 练习模式状态 ===
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceText, setPracticeText] = useState(PRACTICE_TEXTS[0].text);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceStats, setPracticeStats] = useState({ wpm: 0, startTime: null, correct: 0 });
  const [lastInputCorrect, setLastInputCorrect] = useState(null); 
  
  // === 编辑模式状态 ===
  const [isEditing, setIsEditing] = useState(false);
  const [customTextBuffer, setCustomTextBuffer] = useState("");

  const charTimeoutRef = useRef(null);
  const wordTimeoutRef = useRef(null);
  const messageEndRef = useRef(null);

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
    setSpeedMode(prev => {
      if (prev === 'beginner') return 'intermediate';
      if (prev === 'intermediate') return 'advanced';
      return 'beginner';
    });
  };

  const changePracticeText = () => {
    const currentIndex = PRACTICE_TEXTS.findIndex(t => t.text === practiceText);
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
    const cleanText = customTextBuffer.toUpperCase().replace(/[^A-Z0-9 .,?=\/]/g, '').trim();
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

  const playBeep = (duration, type = 'square') => {
    if (!isSoundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = type; 
      
      const freq = type === 'sawtooth' ? 150 : 600;
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  };

  const triggerSignal = useCallback((type) => {
    setActiveSignal(type);
    setTimeout(() => setActiveSignal(null), 150); 
  }, []);

  const clearTimers = () => {
    if (charTimeoutRef.current) clearTimeout(charTimeoutRef.current);
    if (wordTimeoutRef.current) clearTimeout(wordTimeoutRef.current);
  };

  const startSpaceTimer = useCallback(() => {
      if (isPracticeMode && practiceText[practiceIndex] === ' ') {
          wordTimeoutRef.current = setTimeout(() => {
              setPracticeIndex(prev => prev + 1);
              setLastInputCorrect(true); 
          }, currentSpeed.wordDelay);
      }
  }, [isPracticeMode, practiceText, practiceIndex, currentSpeed]);

  const addDit = useCallback(() => { 
    if (currentPath.length < 8) { 
        clearTimers(); 
        
        if (isPracticeMode && practiceText[practiceIndex] === ' ') {
            setLastChar("WAIT!");
            setLastInputCorrect(false);
            playBeep(0.3, 'sawtooth');
            setCurrentPath(""); 
            startSpaceTimer();
            return;
        }

        setCurrentPath(prev => prev + "."); 
        playBeep(0.08); 
        triggerSignal('dit');
    }
  }, [currentPath, triggerSignal, isPracticeMode, practiceText, practiceIndex, startSpaceTimer]);

  const addDah = useCallback(() => { 
    if (currentPath.length < 8) { 
        clearTimers();

        if (isPracticeMode && practiceText[practiceIndex] === ' ') {
            setLastChar("WAIT!");
            setLastInputCorrect(false);
            playBeep(0.3, 'sawtooth');
            setCurrentPath("");
            startSpaceTimer();
            return;
        }

        setCurrentPath(prev => prev + "-"); 
        playBeep(0.2); 
        triggerSignal('dah');
    }
  }, [currentPath, triggerSignal, isPracticeMode, practiceText, practiceIndex, startSpaceTimer]);
  
  const commitChar = useCallback(() => {
    if (currentPath) {
        const char = CODE_TO_CHAR[currentPath];
        
        if (isPracticeMode) {
            const targetChar = practiceText[practiceIndex];
            
            if (char === targetChar) {
                setLastInputCorrect(true);
                setLastChar(char); 
                
                if (practiceStats.startTime === null) {
                    setPracticeStats(prev => ({ ...prev, startTime: Date.now() }));
                }
                
                let nextIndex = practiceIndex + 1;
                
                if (practiceStats.startTime) {
                    const elapsedMin = (Date.now() - practiceStats.startTime) / 60000;
                    const wpm = Math.round(((nextIndex / 5) / elapsedMin)) || 0;
                    setPracticeStats(prev => ({ ...prev, wpm }));
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
                playBeep(0.3, 'sawtooth');
            }
        } else {
            if (char) {
              setLastChar(char);
              setMessage(prev => prev + char);
            } else {
              setMessage(prev => prev + "?"); 
            }
            wordTimeoutRef.current = setTimeout(() => {
                setMessage(prev => prev.endsWith(" ") ? prev : prev + " ");
            }, currentSpeed.wordDelay); 
        }
        
        setCurrentPath(""); 
    }
  }, [currentPath, currentSpeed, isPracticeMode, practiceIndex, practiceText, practiceStats]);

  useEffect(() => {
      if (isPracticeMode && practiceText[practiceIndex] === ' ') {
          startSpaceTimer();
      }
      return () => clearTimers();
  }, [practiceIndex, isPracticeMode, practiceText, startSpaceTimer]);

  const handleBackspace = useCallback(() => {
      if (currentPath.length > 0) {
          setCurrentPath(prev => prev.slice(0, -1));
          clearTimers(); 
          if (currentPath.length > 1) {
             charTimeoutRef.current = setTimeout(() => {
                commitChar(); 
             }, currentSpeed.charDelay);
          }
      } else {
          if (!isPracticeMode) setMessage(prev => prev.slice(0, -1));
      }
  }, [currentPath, commitChar, currentSpeed, isPracticeMode]); 

  useEffect(() => {
    if (currentPath === '........') {
        clearTimers();
        setCurrentPath(""); 
        if (!isPracticeMode) setMessage(prev => prev.slice(0, -1)); 
        setLastChar("ERR"); 
        playBeep(0.3, 'sawtooth'); 
        return;
    }

    if (currentPath) {
        charTimeoutRef.current = setTimeout(() => {
            commitChar();
        }, currentSpeed.charDelay);
    }
    return () => clearTimers();
  }, [currentPath, commitChar, currentSpeed, isPracticeMode]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [message]);

  const reset = () => { 
      setCurrentPath(""); 
      setLastChar(""); 
      setMessage("");
      if (isPracticeMode) {
          setPracticeIndex(0);
          setPracticeStats({ wpm: 0, startTime: null, correct: 0 });
      }
      clearTimers();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 禁用默认的输入行为（防止空格键滚动页面等）
      if (isEditing) return; // 编辑模式下不拦截

      if (e.key === '.' || e.key === 'ArrowLeft' || e.key.toLowerCase() === 'j') addDit();
      if (e.key === '-' || e.key === 'ArrowRight' || e.key.toLowerCase() === 'k') addDah();
      if (e.key === 'Enter') commitChar(); 
      if (e.key === ' ') { 
          e.preventDefault();
          if (isPracticeMode) return; 
          commitChar(); 
          setTimeout(() => setMessage(prev => prev.endsWith(" ") ? prev : prev + " "), 10);
      }
      if (e.key === 'Backspace') {
          handleBackspace();
      }
      if (e.key === 'Escape') reset();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addDit, addDah, commitChar, currentPath, handleBackspace, isPracticeMode, isEditing]);

  const renderLine = (char, node) => {
    if (node.type === 'root') return null;
    const parentNode = NODES[node.parent];
    if (!parentNode) return null;

    const SCALE = 40;
    const x1 = parentNode.x * SCALE;
    const y1 = parentNode.y * SCALE;
    const x2 = node.x * SCALE;
    const y2 = node.y * SCALE;

    let isActive = false;
    if (node.type === 'hidden') {
        let hiddenCode = '';
        if (char === '_U2') hiddenCode = '..--';
        if (char === 'IM') hiddenCode = '..--.';
        if (char === 'MI') hiddenCode = '--..--';
        if (currentPath.startsWith(hiddenCode)) isActive = true;
    } else {
        const myCode = Object.keys(MORSE_CODE_MAP).find(key => MORSE_CODE_MAP[key] === char);
        if (myCode && currentPath.startsWith(myCode)) isActive = true;
    }

    return (
      <path 
        key={`line-${char}`}
        d={`M ${x1} ${y1} L ${x2} ${y2}`} 
        className={`stroke-[1.5px] transition-all duration-150 ${
            isActive 
            ? 'stroke-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' 
            : 'stroke-slate-800'
        }`}
      />
    );
  };

  const renderNode = (char, node) => {
    if (node.type === 'root' || node.type === 'hidden') return null;

    const parentNode = NODES[node.parent];
    if (!parentNode) return null; 

    const SCALE = 40;
    const x2 = node.x * SCALE;
    const y2 = node.y * SCALE;

    const myCode = Object.keys(MORSE_CODE_MAP).find(key => MORSE_CODE_MAP[key] === char);
    let isActive = false;
    let isTarget = false;
    if (myCode) {
        isActive = currentPath.startsWith(myCode);
        isTarget = myCode === currentPath;
    }

    let symbol = 'dot';
    const isHorizontal = Math.abs(node.y - parentNode.y) < 0.1;
    if (node.x < 0 || (node.x === 0 && parentNode.x < 0)) {
       symbol = isHorizontal ? 'dot' : 'dash'; 
    } else {
       symbol = isHorizontal ? 'dash' : 'dot';
    }

    const pos = TEXT_POSITIONS[char] || 'top';
    let textX = x2;
    let textY = y2;
    let anchor = 'middle';
    
    let gap = 3;
    const extraSpacingChars = new Set([
        'A', 'W', 'J', '1', 'X', '/', '=', 
        'N', 'D', 'B', '6', 'G', 'Z', '7',
        'C', 'Q', ',', 'Ö', '8', '9'
    ]);
    if (extraSpacingChars.has(char)) gap = 5; 

    switch(pos) {
        case 'top': textY -= (symbol === 'dash' && !isHorizontal ? 6 : 3) + gap; break;
        case 'left': textX -= (symbol === 'dash' && isHorizontal ? 6 : 3) + gap; textY += 3; anchor = 'end'; break;
        case 'right': textX += (symbol === 'dash' && isHorizontal ? 6 : 3) + gap; textY += 3; anchor = 'start'; break;
    }

    const padColor = isActive ? '#ffcc00' : '#d4af37'; 
    const padStroke = isActive ? '#fff' : '#8d6e63'; 

    return (
      <g key={`node-${char}`}>
        <g transform={`translate(${x2}, ${y2})`}>
            {symbol === 'dot' ? (
                <g>
                    <circle r={3.5} fill={padColor} stroke={padStroke} strokeWidth="0.5" />
                    <circle r={1} fill="#0d1b11" /> 
                </g>
            ) : (
                isHorizontal 
                ? <g>
                    <rect x={-6} y={-2.5} width={12} height={5} rx={1} fill={padColor} stroke={padStroke} strokeWidth="0.5" />
                    <circle r={1} fill="#0d1b11" />
                  </g>
                : <g>
                    <rect x={-2.5} y={-6} width={5} height={12} rx={1} fill={padColor} stroke={padStroke} strokeWidth="0.5" />
                    <circle r={1} fill="#0d1b11" />
                  </g>
            )}
        </g>
        <text 
            x={textX} 
            y={textY} 
            textAnchor={anchor}
            className={`text-[12px] font-mono tracking-tighter select-none transition-all duration-100 ${
                isTarget 
                ? 'fill-white drop-shadow-[0_0_2px_white] font-bold' 
                : 'fill-white/80 font-medium' 
            }`}
        >
            {char}
        </text>
      </g>
    );
  };

  return (
    <div className="h-screen w-full bg-[#0d1b11] flex flex-col items-center justify-between overflow-hidden font-mono relative select-none text-[#a5d6a7] p-4">
      
      {/* Custom Text Modal */}
      {isEditing && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#1a2e22] border-2 border-[#2c3e30] rounded-lg p-4 shadow-2xl flex flex-col gap-4">
            <h3 className="text-[#4caf50] font-bold text-sm tracking-widest flex items-center gap-2">
              <Edit3 size={14} /> CUSTOM TEXT
            </h3>
            <textarea
              value={customTextBuffer}
              onChange={(e) => setCustomTextBuffer(e.target.value.toUpperCase())}
              className="w-full h-32 bg-[#0f1f15] text-[#81c784] font-mono text-sm p-2 rounded border border-[#2c5c3e] focus:outline-none focus:border-[#4caf50] resize-none"
              placeholder="ENTER TEXT (A-Z 0-9)..."
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 rounded text-xs border border-red-900/50 text-red-400 hover:bg-red-900/20"
              >
                CANCEL
              </button>
              <button 
                onClick={saveCustomText}
                className="px-3 py-1 rounded text-xs border border-green-900/50 text-green-400 hover:bg-green-900/20 font-bold"
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-40" 
           style={{ 
             backgroundImage: `
               radial-gradient(#1b5e20 1px, transparent 1px),
               radial-gradient(#1b5e20 1px, transparent 1px)
             `,
             backgroundSize: '10px 10px',
             backgroundPosition: '0 0, 5px 5px'
           }}>
      </div>
      
      {/* Top Display Area */}
      <div className="w-full max-w-4xl bg-[#1a2e22] border-4 border-[#2c3e30] rounded-lg p-2 shadow-lg relative mt-2 z-20 flex flex-col h-40">
          <div className="flex justify-between items-center mb-1 border-b border-[#2c5c3e] pb-1">
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setIsPracticeMode(!isPracticeMode); reset(); }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors text-[10px] ${isPracticeMode ? 'bg-cyan-900 border-cyan-500 text-cyan-100' : 'bg-[#0d1b11] border-[#2c5c3e] text-[#a5d6a7]'}`}
                >
                  <BookOpen size={10} />
                  <span>{isPracticeMode ? "TRAINING MODE" : "FREE PLAY"}</span>
                </button>

                <button 
                  onClick={cycleSpeed}
                  className="flex items-center gap-1 text-[9px] bg-[#0d1b11] px-2 py-0.5 rounded border border-[#2c5c3e] text-[#a5d6a7] hover:text-white transition-colors"
                >
                  <Gauge size={10} />
                  <span>{currentSpeed.label}</span>
                </button>
             </div>

             <div className="flex items-center gap-2">
               {isPracticeMode && (
                 <>
                    <button onClick={openCustomTextModal} className="text-[10px] text-cyan-400 hover:text-white flex items-center gap-1 border border-cyan-900/50 px-2 rounded">
                        <Edit3 size={10} /> EDIT
                    </button>
                    <button onClick={changePracticeText} className="text-[10px] text-yellow-500 hover:text-white flex items-center gap-1 border border-yellow-900/50 px-2 rounded">
                        NEXT TEXT
                    </button>
                 </>
               )}
               <button onClick={reset} className="text-[10px] text-[#4caf50] hover:text-white flex items-center gap-1">
                 <Trash2 size={10} /> CLEAR
               </button>
             </div>
          </div>
          
          <div className="flex-1 overflow-hidden relative bg-[#0f1f15] shadow-inner rounded p-2">
             {!isPracticeMode ? (
               <div className="h-full overflow-y-auto font-mono text-sm leading-relaxed custom-scrollbar whitespace-pre-wrap break-all text-[#81c784]">
                 {message || <span className="opacity-30">Waiting for signal...</span>}
                 <span className="animate-pulse inline-block w-2 h-4 bg-[#4caf50] align-middle ml-1"></span>
                 <div ref={messageEndRef} />
               </div>
             ) : (
               <div className="h-full flex flex-col justify-center items-center">
                 <div className="flex flex-wrap justify-center gap-1 mb-2 max-w-full px-4">
                   {practiceText.split('').map((char, index) => {
                     let colorClass = "text-slate-600"; 
                     if (index < practiceIndex) colorClass = "text-green-500"; 
                     if (index === practiceIndex) {
                        if (char === ' ') colorClass = "bg-cyan-900/40 border-b-2 border-cyan-400 text-transparent w-4"; 
                        else if (lastInputCorrect === false) colorClass = "text-red-500 bg-red-900/20";
                        else colorClass = "text-cyan-400 bg-cyan-900/20 underline decoration-2 underline-offset-4";
                     }
                     return (
                       <span key={index} className={`text-2xl font-black font-mono transition-colors ${colorClass}`}>
                         {char === ' ' ? '\u00A0' : char}
                       </span>
                     );
                   })}
                 </div>
                 <div className="flex gap-4 text-xs font-mono text-slate-400 mt-1">
                    <div className="flex items-center gap-1">
                      <Trophy size={12} className="text-yellow-500" />
                      <span>WPM: <span className="text-white">{practiceStats.wpm}</span></span>
                    </div>
                    <span>Text: {practiceIndex}/{practiceText.length}</span>
                 </div>
               </div>
             )}
          </div>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 w-full max-w-7xl flex items-center justify-center relative z-10">
        <svg 
          viewBox="-400 -30 800 280" 
          className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
          preserveAspectRatio="xMidYMid meet"
        >
          {Object.entries(NODES).map(([char, node]) => renderLine(char, node))}

          <g transform="translate(0, 0)">
            <rect x="-8" y="-8" width="16" height="16" rx="2" className="fill-[#212121] stroke-[#d4af37] stroke-[0.5]" />
            <path d="M-8 -4 H-10 M-8 0 H-10 M-8 4 H-10 M8 -4 H10 M8 0 H10 M8 4 H10 M-4 -8 V-10 M0 -8 V-10 M4 -8 V-10 M-4 8 V10 M0 8 V10 M4 8 V10" stroke="#d4af37" strokeWidth="1" />
            <text x="0" y="2.5" textAnchor="middle" className="text-[5px] fill-[#d4af37] font-mono font-bold tracking-widest">IC1</text>
          </g>

          {Object.entries(NODES).map(([char, node]) => renderNode(char, node))}
        </svg>
      </div>
      
      {/* Bottom Controls */}
      <div className="w-full max-w-4xl flex items-end justify-between px-4 pb-4 z-20">
        <button onClick={addDit} className="group flex flex-col items-center gap-2 active:scale-95 transition-transform">
           <div className={`w-16 h-16 rounded-full border-4 border-[#1b3323] flex items-center justify-center bg-[#2e5c3e] shadow-[inset_0_2px_5px_rgba(255,255,255,0.2),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] transition-all ${activeSignal === 'dit' ? 'bg-[#3e7c53] translate-y-1' : ''}`}>
             <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_5px_white]"></div>
           </div>
           <span className="text-[10px] text-white/50 font-bold tracking-widest bg-[#00000033] px-2 py-0.5 rounded">DIT [J / ←]</span>
        </button>
        
        <div className="flex flex-col items-center justify-end pb-2 gap-3 mx-4">
             {/* Current Buffer */}
             <div className="h-10 flex items-center justify-center min-w-[100px] bg-[#4a5e4d] border-2 border-[#2c3e30] rounded shadow-[inset_0_0_5px_rgba(0,0,0,0.8)]">
                <span className="text-xl font-mono text-[#111] tracking-[0.1em] font-bold opacity-80" style={{fontFamily: 'monospace'}}>
                    {currentPath || "READY"}
                </span>
             </div>
             
             {/* Controls */}
             <div className="flex gap-2">
                <button onClick={handleBackspace} className="text-[9px] text-amber-400/80 hover:text-amber-400 uppercase tracking-widest flex items-center gap-1 transition-colors border border-amber-900/50 px-2 py-1 rounded hover:bg-amber-900/20">
                    <Delete size={8} /> DEL [BS]
                </button>
                <button onClick={reset} className="text-[9px] text-red-400/80 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors border border-red-900/50 px-2 py-1 rounded hover:bg-red-900/20">
                    <RotateCcw size={8} /> RESET [ESC]
                </button>
             </div>
        </div>

        <button onClick={addDah} className="group flex flex-col items-center gap-2 active:scale-95 transition-transform">
           <div className={`w-16 h-16 rounded-full border-4 border-[#1b3323] flex items-center justify-center bg-[#2e5c3e] shadow-[inset_0_2px_5px_rgba(255,255,255,0.2),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] transition-all ${activeSignal === 'dah' ? 'bg-[#3e7c53] translate-y-1' : ''}`}>
             <div className="w-8 h-3 bg-white rounded-sm shadow-[0_0_5px_white]"></div>
           </div>
           <span className="text-[10px] text-white/50 font-bold tracking-widest bg-[#00000033] px-2 py-0.5 rounded">DAH [K / →]</span>
        </button>
      </div>
      
      {/* Floating Char */}
      {lastChar && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
           <span key={Date.now()} className={`text-[20vw] font-black animate-ping select-none font-mono ${lastChar === 'ERR' || lastChar === 'WAIT!' ? 'text-red-500/20' : 'text-[#ffffff15]'}`}>
             {lastChar}
           </span>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f1f15;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2e7d32;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
```