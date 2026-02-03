import { useTranslation } from "react-i18next";

export const CwInstructions = () => {
  const { t } = useTranslation("common");

  return (
    <div className="w-full max-w-4xl mt-8 px-4 border-t border-[#2c3e30] pt-6 pb-12 z-10">
      <h2 className="text-xl font-bold text-[#4caf50] mb-4">
        {t("tools.cw.instructions.title")}
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-bold text-[#81c784] mb-2">
            {t("tools.cw.instructions.operation.title")}
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-[#a5d6a7]">
                {t("tools.cw.instructions.operation.keyboard")}
              </h4>
              <p className="text-xs md:text-sm text-[#a5d6a7]/80 leading-relaxed">
                {t("tools.cw.instructions.operation.keyboard_desc")}
              </p>
            </div>
            <div>
              <h4 className="font-bold text-[#a5d6a7]">
                {t("tools.cw.instructions.operation.buttons")}
              </h4>
              <p className="text-xs md:text-sm text-[#a5d6a7]/80 leading-relaxed">
                {t("tools.cw.instructions.operation.buttons_desc")}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-[#81c784] mb-2">
            {t("tools.cw.instructions.speed_guide.title")}
          </h3>
          <ul className="space-y-3 text-xs md:text-sm text-[#a5d6a7]/80 list-disc pl-4 leading-relaxed">
            <li>{t("tools.cw.instructions.speed_guide.beginner")}</li>
            <li>{t("tools.cw.instructions.speed_guide.intermediate")}</li>
            <li>{t("tools.cw.instructions.speed_guide.advanced")}</li>
          </ul>
        </div>

        <div>
          <h3 className="text-[#a5d6a7] font-bold mb-2">
            {t("tools.cw.panel.training_mode")}
          </h3>
          <p className="mb-2">
            {t("tools.cw.panel.training_mode")}:{" "}
            {t("tools.cw.instructions.training_desc")}
          </p>
        </div>
      </div>
    </div>
  );
};
