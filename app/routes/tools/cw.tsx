import i18next from "i18next";
import { useState } from "react";
import { initReactI18next, useTranslation } from "react-i18next";
import type { MetaFunction } from "react-router";
import { CwBoard } from "~/components/tools/cw/CwBoard";
import { CwControls } from "~/components/tools/cw/CwControls";
import { CwHeader } from "~/components/tools/cw/CwHeader";
import { CwInstructions } from "~/components/tools/cw/CwInstructions";
import { CwMobileRef } from "~/components/tools/cw/CwMobileRef";
import { CwPracticeModal } from "~/components/tools/cw/CwPracticeModal";
import { ReferenceList } from "~/components/tools/cw/ReferenceList";
import { useCwGame } from "~/components/tools/cw/useCwGame";
import resources from "~/locales";
import { getLocale } from "~/middleware/i18next";
import type { Route } from "./+types/cw";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const locale = getLocale(request);
  const t = await i18next.use(initReactI18next).init({
    lng: locale,
    ns: "common",
    resources,
  });
  return {
    title: `${t("tools.cw.title")} | Ham Study`,
    description: t("tools.cw.description"),
    keywords: t("tools.cw.keywords"),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "CW Trainer" }];
  const { title, description, keywords } = data;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "keywords", content: keywords },
  ];
};

export default function CwTrainer() {
  const { t } = useTranslation("common");
  const [showRef, setShowRef] = useState(false);

  const {
    currentPath,
    lastChar,
    message,
    activeSignal,
    cycleSpeed,
    addDit,
    addDah,
    handleBackspace,
    reset,
    inputRef,
    currentSpeed,
    // Practice Mode
    isPracticeMode,
    setIsPracticeMode,
    practiceText,
    practiceIndex,
    practiceStats,
    changePracticeText,
    openCustomTextModal,
    saveCustomText,
    lastInputCorrect,
    isEditing,
    setIsEditing,
    customTextBuffer,
    setCustomTextBuffer,
  } = useCwGame();

  return (
    <div className="min-h-screen w-full bg-[#0d1b11] flex flex-col items-center font-mono relative select-none text-[#a5d6a7]">
      {/* Custom Text Modal */}
      {isEditing && (
        <CwPracticeModal
          customTextBuffer={customTextBuffer}
          setCustomTextBuffer={setCustomTextBuffer}
          setIsEditing={setIsEditing}
          saveCustomText={saveCustomText}
        />
      )}

      {/* Background Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 h-full"
        style={{
          backgroundImage: `
               radial-gradient(#1b5e20 1px, transparent 1px),
               radial-gradient(#1b5e20 1px, transparent 1px)
             `,
          backgroundSize: "10px 10px",
          backgroundPosition: "0 0, 5px 5px",
        }}
      ></div>

      <div className="relative h-[80dvh] w-full flex flex-col items-center justify-between overflow-hidden p-4 z-10">
        {/* 左侧参考面板：字母 (Desktop) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-4 z-20 max-h-[80%] overflow-y-auto custom-scrollbar pointer-events-auto w-60">
          <ReferenceList
            title={t("tools.cw.panel.letters")}
            filter={(c) => /^[A-Z]$/.test(c)}
            twoCols
          />
        </div>

        {/* 右侧参考面板：数字与符号 (Desktop) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-4 z-20 max-h-[80%] overflow-y-auto custom-scrollbar pointer-events-auto w-36">
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

        {/* Mobile Reference Overlay */}
        {showRef && <CwMobileRef onClose={() => setShowRef(false)} />}

        {/* 顶部显示区：RX LOG + 速度控制 */}
        <CwHeader
          message={message}
          cycleSpeed={cycleSpeed}
          currentSpeed={currentSpeed}
          setShowRef={setShowRef}
          // Practice Mode Props
          isPracticeMode={isPracticeMode}
          setIsPracticeMode={setIsPracticeMode}
          practiceText={practiceText}
          practiceIndex={practiceIndex}
          practiceStats={practiceStats}
          lastInputCorrect={lastInputCorrect}
          changePracticeText={changePracticeText}
          openCustomTextModal={openCustomTextModal}
          reset={reset}
        />

        {/* 主电路板区域 */}
        <CwBoard currentPath={currentPath} />

        {/* 底部控制器 */}
        <CwControls
          inputRef={inputRef}
          currentPath={currentPath}
          activeSignal={activeSignal}
          addDit={addDit}
          addDah={addDah}
          handleBackspace={handleBackspace}
          reset={reset}
        />

        {lastChar && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
            <span
              key={Date.now()}
              className={`text-[20vw] font-black animate-ping select-none font-mono ${
                lastChar === "ERR" || lastChar === "WAIT!"
                  ? "text-red-500/20"
                  : "text-[#ffffff15]"
              }`}
            >
              {lastChar}
            </span>
          </div>
        )}
      </div>

      {/* Instructions Section */}
      <CwInstructions />
    </div>
  );
}
