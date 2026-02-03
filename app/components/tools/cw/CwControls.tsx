import {
  ArrowCounterClockwiseIcon,
  BackspaceIcon,
} from "@phosphor-icons/react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

interface CwControlsProps {
  inputRef: RefObject<HTMLInputElement | null>;
  currentPath: string;
  activeSignal: string | null;
  addDit: () => void;
  addDah: () => void;
  handleBackspace: () => void;
  reset: () => void;
}

export const CwControls = ({
  inputRef,
  currentPath,
  activeSignal,
  addDit,
  addDah,
  handleBackspace,
  reset,
}: CwControlsProps) => {
  const { t } = useTranslation("common");

  return (
    <div className="w-full max-w-4xl flex items-end justify-between px-4 pb-4 z-20">
      <button
        type="button"
        onClick={addDit}
        className="group flex flex-col items-center gap-2 active:scale-95 transition-transform"
      >
        <div
          className={`w-16 h-16 rounded-full border-4 border-[#1b3323] flex items-center justify-center bg-[#2e5c3e] shadow-[inset_0_2px_5px_rgba(255,255,255,0.2),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] transition-all ${activeSignal === "dit" ? "bg-[#3e7c53] translate-y-1" : ""}`}
        >
          <div className="w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_5px_white]"></div>
        </div>
        <span className="text-[10px] text-white/50 font-bold tracking-widest bg-[#00000033] px-2 py-0.5 rounded">
          {t("tools.cw.control.dit")}
        </span>
      </button>

      <div className="flex flex-col items-center justify-end pb-2 gap-3 mx-4">
        <div className="relative h-10 flex items-center justify-center min-w-[100px] bg-[#4a5e4d] border-2 border-[#2c3e30] rounded shadow-[inset_0_0_5px_rgba(0,0,0,0.8)] cursor-text">
          <input
            ref={inputRef as RefObject<HTMLInputElement>}
            type="text"
            className="absolute inset-0 w-full h-full opacity-0 cursor-text p-0 m-0 border-0 bg-transparent text-transparent caret-transparent z-10"
            tabIndex={-1}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            aria-label={t("tools.cw.input_aria_label")}
          />
          <span
            className="text-xl font-mono text-[#111] tracking-widest font-bold opacity-80"
            style={{ fontFamily: "monospace" }}
          >
            {currentPath || t("tools.cw.status.ready")}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleBackspace}
            className="text-[9px] text-amber-400/80 hover:text-amber-400 uppercase tracking-widest flex items-center gap-1 transition-colors border border-amber-900/50 px-2 py-1 rounded hover:bg-amber-900/20"
          >
            <BackspaceIcon size={12} /> {t("tools.cw.control.backspace")}
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-[9px] text-red-400/80 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors border border-red-900/50 px-2 py-1 rounded hover:bg-red-900/20"
          >
            <ArrowCounterClockwiseIcon size={12} />{" "}
            {t("tools.cw.control.reset")}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={addDah}
        className="group flex flex-col items-center gap-2 active:scale-95 transition-transform"
      >
        <div
          className={`w-16 h-16 rounded-full border-4 border-[#1b3323] flex items-center justify-center bg-[#2e5c3e] shadow-[inset_0_2px_5px_rgba(255,255,255,0.2),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] transition-all ${activeSignal === "dah" ? "bg-[#3e7c53] translate-y-1" : ""}`}
        >
          <div className="w-8 h-3 bg-white rounded-sm shadow-[0_0_5px_white]"></div>
        </div>
        <span className="text-[10px] text-white/50 font-bold tracking-widest bg-[#00000033] px-2 py-0.5 rounded">
          {t("tools.cw.control.dah")}
        </span>
      </button>
    </div>
  );
};
