import {
  ActivityIcon,
  ArrowRightIcon,
  BookBookmarkIcon,
  BookOpenIcon,
  GaugeIcon,
  PencilSimpleIcon,
  TrashIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { SpeedSetting } from "./types";

interface CwHeaderProps {
  message: string;
  cycleSpeed: () => void;
  currentSpeed: SpeedSetting;
  setShowRef: Dispatch<SetStateAction<boolean>>;
  // Practice Mode Props
  isPracticeMode: boolean;
  setIsPracticeMode: Dispatch<SetStateAction<boolean>>;
  practiceText: string;
  practiceIndex: number;
  practiceStats: { wpm: number; startTime: number | null; correct: number };
  lastInputCorrect: boolean | null;
  changePracticeText: () => void;
  openCustomTextModal: () => void;
  reset: () => void;
}

export const CwHeader = ({
  message,
  cycleSpeed,
  currentSpeed,
  setShowRef,
  isPracticeMode,
  setIsPracticeMode,
  practiceText,
  practiceIndex,
  practiceStats,
  lastInputCorrect,
  changePracticeText,
  openCustomTextModal,
  reset,
}: CwHeaderProps) => {
  const { t } = useTranslation("common");

  return (
    <div className="w-full max-w-4xl bg-[#1a2e22] border-4 border-[#2c3e30] rounded-lg p-2 shadow-lg relative mt-2 z-20 flex flex-col h-40">
      <div className="flex justify-between items-center mb-1 border-b border-[#2c5c3e] pb-1">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="hidden md:flex text-[10px] text-[#4caf50] font-bold tracking-widest items-center gap-2 whitespace-nowrap">
            <ActivityIcon size={12} /> {t("tools.cw.panel.rx_log")}
          </span>

          <button
            type="button"
            onClick={() => setShowRef((p) => !p)}
            className="md:hidden text-[9px] bg-[#0d1b11] px-2 py-0.5 rounded border border-[#2c5c3e] text-[#a5d6a7] hover:text-white transition-colors whitespace-nowrap"
          >
            <BookBookmarkIcon size={10} className="inline" />{" "}
            {t("tools.cw.panel.ref")}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPracticeMode(!isPracticeMode);
              reset();
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors text-[10px] whitespace-nowrap ${
              isPracticeMode
                ? "bg-cyan-900 border-cyan-500 text-cyan-100"
                : "bg-[#0d1b11] border-[#2c5c3e] text-[#a5d6a7]"
            }`}
          >
            <BookOpenIcon size={10} />
            <span>
              {isPracticeMode
                ? t("tools.cw.panel.training_mode")
                : t("tools.cw.panel.free_play")}
            </span>
          </button>

          <button
            type="button"
            onClick={cycleSpeed}
            className="flex items-center gap-1 text-[9px] bg-[#0d1b11] px-2 py-0.5 rounded border border-[#2c5c3e] text-[#a5d6a7] hover:text-white transition-colors whitespace-nowrap"
          >
            <GaugeIcon size={10} />
            <span>
              {t("tools.cw.panel.speed")}:{" "}
              {t(`tools.cw.speed.${currentSpeed.label}`)} (
              {t(`tools.cw.speed.${currentSpeed.desc}`)})
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPracticeMode && (
            <>
              <button
                type="button"
                onClick={openCustomTextModal}
                className="text-[10px] text-cyan-400 hover:text-white flex items-center gap-1 border border-cyan-900/50 px-2 rounded"
              >
                <PencilSimpleIcon size={10} /> {t("tools.cw.panel.edit")}
              </button>
              <button
                type="button"
                onClick={changePracticeText}
                className="text-[10px] text-yellow-500 hover:text-white flex items-center gap-1 border border-yellow-900/50 px-2 rounded"
              >
                <ArrowRightIcon size={10} /> {t("tools.cw.panel.next")}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={reset}
            className="text-[10px] text-[#4caf50] hover:text-white flex items-center gap-1"
          >
            <TrashIcon size={10} /> {t("tools.cw.panel.clear")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-[#0f1f15] shadow-inner rounded p-2">
        {!isPracticeMode ? (
          <div className="h-full overflow-y-auto font-mono text-sm leading-relaxed custom-scrollbar whitespace-pre-wrap break-all text-[#81c784]">
            {message || (
              <span className="opacity-30">Waiting for signal...</span>
            )}
            <span className="animate-pulse inline-block w-2 h-4 bg-[#4caf50] align-middle ml-1"></span>
          </div>
        ) : (
          <div className="h-full flex flex-col justify-center items-center">
            <div className="flex flex-wrap justify-center gap-1 mb-2 max-w-full px-4">
              {practiceText.split("").map((char, index) => {
                let colorClass = "text-slate-600";
                if (index < practiceIndex) colorClass = "text-green-500";
                if (index === practiceIndex) {
                  if (char === " ")
                    colorClass =
                      "bg-cyan-900/40 border-b-2 border-cyan-400 text-transparent w-4";
                  else if (lastInputCorrect === false)
                    colorClass = "text-red-500 bg-red-900/20";
                  else
                    colorClass =
                      "text-cyan-400 bg-cyan-900/20 underline decoration-2 underline-offset-4";
                }
                return (
                  <span
                    key={`${index}-${char}`}
                    className={`text-2xl font-black font-mono transition-colors ${colorClass}`}
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </div>
            <div className="flex gap-4 text-xs font-mono text-slate-400 mt-1">
              <div className="flex items-center gap-1">
                <TrophyIcon size={12} className="text-yellow-500" />
                <span>
                  WPM: <span className="text-white">{practiceStats.wpm}</span>
                </span>
              </div>
              <span>
                Text: {practiceIndex}/{practiceText.length}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
