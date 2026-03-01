import type { TFunction } from "i18next";
import i18next from "i18next";
import { lazy, Suspense } from "react";
import { initReactI18next, Trans, useTranslation } from "react-i18next";
import { ClientOnly } from "~/components/client-only";
import { BlockMath, InlineMath } from "~/components/math";
import { ScientificCitation } from "~/components/scientific-citation";
import resources from "~/locales";
import { getLocale } from "~/middleware/i18next";
import type { Route } from "./+types/long-wire-antenna";

const LongWireAntennaScene = lazy(
  () => import("~/components/long-wire-antenna-scene"),
);

export const loader = async ({ request }: Route.LoaderArgs) => {
  const locale = getLocale(request);
  const t: TFunction<["common", "demos"]> = await i18next
    .use(initReactI18next)
    .init({
      lng: locale,
      resources,
    });
  return {
    title: t("demos:longWireAntenna.metaTitle"),
    description: t("demos:longWireAntenna.metaDescription"),
    keywords: t("demos:longWireAntenna.metaKeywords"),
  };
};

export const meta = ({ loaderData }: Route.MetaArgs) => {
  const { title, description, keywords } = loaderData;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "keywords", content: keywords },
  ];
};

export default function LongWireAntennaPage() {
  const { t } = useTranslation("demos");
  const ant = "longWireAntenna";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t(`${ant}.title`)}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-6">
        <ClientOnly
          fallback={
            <div className="h-[450px] md:h-[600px] w-full flex items-center justify-center bg-slate-100 rounded-lg">
              {t("loading")}
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="h-[450px] md:h-[600px] w-full flex items-center justify-center bg-slate-100 rounded-lg">
                {t("loading")}
              </div>
            }
          >
            <LongWireAntennaScene />
          </Suspense>
        </ClientOnly>

        <div className="prose dark:prose-invert max-w-none">
          <h3>{t("aboutTitle")}</h3>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${ant}.about`}
              components={{ strong: <strong /> }}
            />
          </p>
          <ul>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${ant}.gain`}
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${ant}.lobes`}
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${ant}.ground`}
                components={{ strong: <strong /> }}
              />
            </li>
          </ul>

          <div className="prose dark:prose-invert max-w-none mb-8">
            <h3>{t(`${ant}.theoryTitle`)}</h3>
            <p>{t(`${ant}.theoryDesc`)}</p>
            <p>
              <Trans
                ns="demos"
                i18nKey={`${ant}.theoryFormulaIntro`}
                components={{ M: <InlineMath /> }}
              />
            </p>
            <BlockMath math="E(\theta) \propto \left| \frac{\cos\left(\frac{n\pi}{2} \cos \theta\right)}{\sin \theta} \right|" />
            <p>
              <Trans
                ns="demos"
                i18nKey={`${ant}.theoryFormulaExpl`}
                components={{ M: <InlineMath /> }}
              />
            </p>
            <BlockMath math="n = \frac{L}{\lambda/2} = \frac{2.5\lambda}{0.5\lambda} = 5" />
            <p>
              <Trans
                ns="demos"
                i18nKey={`${ant}.theoryResult`}
                components={{ M: <InlineMath /> }}
              />
            </p>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900 border rounded-lg p-4 md:p-6 mb-8 text-sm md:text-base leading-relaxed">
            <ScientificCitation
              title={t("physicsValidation")}
              content={
                <>
                  <p className="mb-2">
                    <Trans
                      ns="demos"
                      i18nKey={`${ant}.physicsContent`}
                      components={{ strong: <strong /> }}
                    />
                  </p>
                  <p className="text-muted-foreground italic border-l-2 border-primary/20 pl-4 py-1">
                    {t(`${ant}.physicsQuote`)}
                  </p>
                </>
              }
              citations={[
                {
                  id: "arrl",
                  text: "ARRL Antenna Book. Chapter on Long Wire and Traveling Wave Antennas.",
                },
                {
                  id: "kraus",
                  text: "Kraus, J. D. Antennas. McGraw-Hill.",
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
