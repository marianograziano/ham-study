import { ProhibitIcon } from "@phosphor-icons/react";

interface CwGameControlsProps {
  currentPattern: string;
  isPlaying: boolean;
  isPaused: boolean;
  onDit: () => void;
  onDah: () => void;
  onClear: () => void;
}

export function CwGameControls({
  currentPattern,
  isPlaying,
  isPaused,
  onDit,
  onDah,
  onClear,
}: CwGameControlsProps) {
  const isDisabled = !isPlaying || isPaused;

  return (
    <div className="w-full p-6 bg-[#18181a] border-t-4 border-slate-800 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
      <div className="max-w-4xl mx-auto">
        {/* Display Screen */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-green-500/5 blur-xl rounded-full" />
          <div className="relative bg-[#0a0a0a] border border-slate-700 rounded-sm p-4 text-center shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] text-green-900 uppercase tracking-widest mb-1 absolute top-2 left-4">
              Input Buffer
            </div>
            <div className="h-16 flex items-center justify-center">
              <span className="text-4xl font-mono font-bold text-phosphor tracking-[0.2em] text-shadow-glow">
                {currentPattern || <span className="opacity-20">__</span>}
              </span>
              <span className="animate-pulse w-3 h-8 bg-green-500 ml-1 opacity-50 block" />
            </div>

            {/* Clear Button (Small tactile) */}
            <button
              onClick={onClear}
              type="button"
              disabled={!currentPattern}
              className="absolute right-2 top-2 p-2 text-slate-600 hover:text-red-500 transition-colors"
            >
              <ProhibitIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mechanical Keys */}
        <div className="grid grid-cols-2 gap-8 px-4 sm:px-12">
          {/* DIT Key */}
          <button
            type="button"
            onClick={(e) => {
              const btn = e.currentTarget;
              btn.style.transform = "translate(0, 4px)";
              btn.style.boxShadow = "0 0 0 #000";
              setTimeout(() => {
                btn.style.transform = "translate(0, 0)";
                btn.style.boxShadow = "0 6px 0 #052e16";
              }, 100);
              onDit();
            }}
            disabled={isDisabled}
            style={{ transition: "all 0.05s", boxShadow: "0 6px 0 #052e16" }}
            className="group relative bg-slate-900 h-24 rounded-lg border-2 border-green-900 active:translate-y-[4px] active:shadow-none bg-linear-to-b from-slate-800 to-slate-900 disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="flex flex-col items-center justify-center h-full">
              <span className="text-6xl text-green-400 font-bold leading-none mb-2 group-hover:text-shadow-glow">
                ·
              </span>
              <span className="text-xs text-slate-500 font-mono tracking-widest">
                DIT (J)
              </span>
            </div>
          </button>

          {/* DAH Key */}
          <button
            type="button"
            onClick={(e) => {
              const btn = e.currentTarget;
              btn.style.transform = "translate(0, 4px)";
              btn.style.boxShadow = "0 0 0 #000";
              setTimeout(() => {
                btn.style.transform = "translate(0, 0)";
                btn.style.boxShadow = "0 6px 0 #052e16";
              }, 100);
              onDah();
            }}
            disabled={isDisabled}
            style={{ transition: "all 0.05s", boxShadow: "0 6px 0 #052e16" }}
            className="group relative bg-slate-900 h-24 rounded-lg border-2 border-green-900 active:translate-y-[4px] active:shadow-none bg-linear-to-b from-slate-800 to-slate-900 disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="flex flex-col items-center justify-center h-full">
              <span className="text-6xl text-green-400 font-bold leading-none mb-2 group-hover:text-shadow-glow">
                −
              </span>
              <span className="text-xs text-slate-500 font-mono tracking-widest">
                DAH (K)
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
