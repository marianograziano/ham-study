import {
  ActivityIcon,
  BookIcon,
  GaugeIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { SpeedSetting } from "./types";

interface CwHeaderProps {
  message: string;
  setMessage: (msg: string) => void;
  cycleSpeed: () => void;
  currentSpeed: SpeedSetting;
  setShowRef: Dispatch<SetStateAction<boolean>>;
}

export const CwHeader = ({
  message,
  setMessage,
  cycleSpeed,
  currentSpeed,
  setShowRef,
}: CwHeaderProps) => {
  const { t } = useTranslation("common");

  return (
    <div className="w-full max-w-4xl bg-[#1a2e22] border-4 border-[#2c3e30] rounded-lg p-2 shadow-lg relative mt-2 z-20 flex flex-col h-28 md:h-36">
      <div className="flex justify-between items-center mb-1 border-b border-[#2c5c3e] pb-1">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-[#4caf50] font-bold tracking-widest flex items-center gap-2">
            <ActivityIcon size={12} /> {t("tools.cw.panel.rx_log")}
          </span>

          {/* Mobile Reference Toggle */}
          <button
            type="button"
            onClick={() => setShowRef((p) => !p)}
            className="md:hidden text-[9px] bg-[#0d1b11] px-2 py-0.5 rounded border border-[#2c5c3e] text-[#a5d6a7] hover:text-white transition-colors"
          >
            <BookIcon size={10} className="inline" /> {t("tools.cw.panel.ref")}
          </button>

          <button
            type="button"
            onClick={cycleSpeed}
            className="flex items-center gap-1 text-[9px] bg-[#0d1b11] px-2 py-0.5 rounded border border-[#2c5c3e] text-[#a5d6a7] hover:text-white transition-colors"
          >
            <GaugeIcon size={10} />
            <span>
              {t("tools.cw.panel.speed")}:{" "}
              {t(`tools.cw.speed.${currentSpeed.label}`)} (
              {t(`tools.cw.speed.${currentSpeed.desc}`)})
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMessage("")}
          className="text-[10px] text-[#4caf50] hover:text-white flex items-center gap-1"
        >
          <TrashIcon size={10} /> {t("tools.cw.panel.clear")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-sm p-1 leading-relaxed custom-scrollbar whitespace-pre-wrap break-all text-[#81c784] shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] bg-[#0f1f15]">
        {message}
        <span className="animate-pulse inline-block w-2 h-4 bg-[#4caf50] align-middle ml-1"></span>
      </div>
    </div>
  );
};
