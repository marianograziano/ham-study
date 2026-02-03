import { PencilSimpleIcon } from "@phosphor-icons/react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

interface CwPracticeModalProps {
  customTextBuffer: string;
  setCustomTextBuffer: Dispatch<SetStateAction<string>>;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  saveCustomText: () => void;
}

export const CwPracticeModal = ({
  customTextBuffer,
  setCustomTextBuffer,
  setIsEditing,
  saveCustomText,
}: CwPracticeModalProps) => {
  const { t } = useTranslation("common");

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-24 text-white">
      <div className="w-full max-w-md bg-[#1a2e22] border-2 border-[#2c3e30] rounded-lg p-4 shadow-2xl flex flex-col gap-4">
        <h3 className="text-[#4caf50] font-bold text-sm tracking-widest flex items-center gap-2">
          <PencilSimpleIcon size={14} /> {t("tools.cw.panel.custom_text")}
        </h3>
        <textarea
          value={customTextBuffer}
          onChange={(e) => setCustomTextBuffer(e.target.value.toUpperCase())}
          className="w-full h-32 bg-[#0f1f15] text-[#81c784] font-mono text-sm p-2 rounded border border-[#2c5c3e] focus:outline-none focus:border-[#4caf50] resize-none"
          placeholder={t("tools.cw.panel.custom_text_placeholder")}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-3 py-1 rounded text-xs border border-red-900/50 text-red-400 hover:bg-red-900/20"
          >
            {t("tools.cw.panel.cancel")}
          </button>
          <button
            type="button"
            onClick={saveCustomText}
            className="px-3 py-1 rounded text-xs border border-green-900/50 text-green-400 hover:bg-green-900/20 font-bold"
          >
            {t("tools.cw.panel.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};
