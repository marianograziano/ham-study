import { useTranslation } from "react-i18next";
import { ReferenceList } from "./ReferenceList";

interface CwMobileRefProps {
  onClose: () => void;
}

export const CwMobileRef = ({ onClose }: CwMobileRefProps) => {
  const { t } = useTranslation("common");

  return (
    <div className="absolute inset-0 z-50 bg-[#0d1b11]/95 backdrop-blur-md p-4 overflow-y-auto flex flex-col gap-4 md:hidden">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-[#4caf50] font-bold">
          {t("tools.cw.panel.morse_code_reference")}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-white/50 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="space-y-4 pb-10">
        <ReferenceList
          title={t("tools.cw.panel.letters")}
          filter={(c) => /^[A-Z]$/.test(c)}
          twoCols
        />
        <div className="grid grid-cols-2 gap-4">
          <ReferenceList
            title={t("tools.cw.panel.numbers")}
            filter={(c) => /^[0-9]$/.test(c)}
          />
          <ReferenceList
            title={t("tools.cw.panel.symbols")}
            filter={(c) =>
              !/^[A-Z0-9]$/.test(c) && !["CH", "Ä", "Ö", "Ü", "Ð"].includes(c)
            }
          />
        </div>
      </div>
    </div>
  );
};
