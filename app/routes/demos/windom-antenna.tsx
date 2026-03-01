import type { TFunction } from "i18next";
import i18next from "i18next";
import { lazy, Suspense } from "react";
import { initReactI18next, Trans, useTranslation } from "react-i18next";
import { ClientOnly } from "~/components/client-only";
import { BlockMath, InlineMath } from "~/components/math";
import { ScientificCitation } from "~/components/scientific-citation";
import resources from "~/locales";
import { getLocale } from "~/middleware/i18next";
import type { Route } from "./+types/windom-antenna";

const WindomAntennaScene = lazy(
  () => import("~/components/windom-antenna-scene"),
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
    title: t("demos:windomAntenna.metaTitle"),
    description: t("demos:windomAntenna.metaDescription"),
    keywords: t("demos:windomAntenna.metaKeywords"),
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

export default function WindomAntennaPage() {
  const { t } = useTranslation("demos");
  const windom = "windomAntenna";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t(`${windom}.title`)}</h1>
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
            <WindomAntennaScene />
          </Suspense>
        </ClientOnly>

        <div className="prose dark:prose-invert max-w-none">
          {/* Overview */}
          <h3>{t(`${windom}.overviewTitle`)}</h3>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.overview`}
              components={{ strong: <strong />, M: <InlineMath /> }}
            />
          </p>
          <ul>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${windom}.structure`}
                components={{ strong: <strong /> }}
              />
            </li>
          </ul>

          {/* Principle / Why 1/3? */}
          <h3>{t(`${windom}.principleTitle`)}</h3>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.principleIntro`}
              components={{ strong: <strong /> }}
            />
          </p>
          <ul>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${windom}.principlePoints.fundamental`}
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${windom}.principlePoints.harmonics2`}
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${windom}.principlePoints.harmonics4`}
                components={{ strong: <strong /> }}
              />
            </li>
          </ul>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.principleConclusion`}
              components={{ strong: <strong /> }}
            />
          </p>

          {/* Matching System */}
          <h3>{t(`${windom}.matchingTitle`)}</h3>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.matchingIntro`}
              components={{ strong: <strong />, M: <InlineMath /> }}
            />
          </p>
          <BlockMath math="\text{Balun Ratio} = \frac{Z_{antenna}}{Z_{cable}} = \frac{200\Omega}{50\Omega} = 4:1" />
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.matchingConclusion`}
              components={{ strong: <strong /> }}
            />
          </p>

          {/* Radiation Pattern */}
          <h3>{t(`${windom}.patternTitle`)}</h3>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.patternIntro`}
              components={{ strong: <strong /> }}
            />
          </p>
          <ul>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${windom}.patternPoints.fundamental`}
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${windom}.patternPoints.harmonic`}
                components={{ strong: <strong /> }}
              />
            </li>
          </ul>

          {/* Comparison Table */}
          <h3>{t(`${windom}.comparisonTitle`)}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr>
                  <th className="p-4 border-b dark:border-zinc-700 font-semibold">
                    {t(`${windom}.tableHead.feature`)}
                  </th>
                  <th className="p-4 border-b dark:border-zinc-700 font-semibold">
                    {t(`${windom}.tableHead.dipole`)}
                  </th>
                  <th className="p-4 border-b dark:border-zinc-700 font-semibold">
                    {t(`${windom}.tableHead.windom`)}
                  </th>
                  <th className="p-4 border-b dark:border-zinc-700 font-semibold">
                    {t(`${windom}.tableHead.efhw`)}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b dark:border-zinc-800">
                  <td className="p-4">{t(`${windom}.tableRow.feedPos`)}</td>
                  <td className="p-4">{t(`${windom}.tableCell.dipoleFeed`)}</td>
                  <td className="p-4 font-semibold text-primary">
                    {t(`${windom}.tableCell.windomFeed`)}
                  </td>
                  <td className="p-4">{t(`${windom}.tableCell.efhwFeed`)}</td>
                </tr>
                <tr className="border-b dark:border-zinc-800">
                  <td className="p-4">{t(`${windom}.tableRow.multiBand`)}</td>
                  <td className="p-4">{t(`${windom}.tableCell.dipoleBand`)}</td>
                  <td className="p-4 font-semibold text-primary">
                    {t(`${windom}.tableCell.windomBand`)}
                  </td>
                  <td className="p-4 font-semibold text-primary">
                    {t(`${windom}.tableCell.efhwBand`)}
                  </td>
                </tr>
                <tr className="border-b dark:border-zinc-800">
                  <td className="p-4">{t(`${windom}.tableRow.match`)}</td>
                  <td className="p-4">
                    {t(`${windom}.tableCell.dipoleMatch`)}
                  </td>
                  <td className="p-4 font-semibold text-primary">
                    {t(`${windom}.tableCell.windomMatch`)}
                  </td>
                  <td className="p-4 font-semibold text-primary">
                    {t(`${windom}.tableCell.efhwMatch`)}
                  </td>
                </tr>
                <tr className="border-b dark:border-zinc-800">
                  <td className="p-4">{t(`${windom}.tableRow.ground`)}</td>
                  <td className="p-4">
                    {t(`${windom}.tableCell.dipoleGround`)}
                  </td>
                  <td className="p-4">
                    {t(`${windom}.tableCell.windomGround`)}
                  </td>
                  <td className="p-4 font-semibold text-primary">
                    {t(`${windom}.tableCell.efhwGround`)}
                  </td>
                </tr>
                <tr>
                  <td className="p-4">{t(`${windom}.tableRow.cons`)}</td>
                  <td className="p-4">{t(`${windom}.tableCell.dipoleCons`)}</td>
                  <td className="p-4">{t(`${windom}.tableCell.windomCons`)}</td>
                  <td className="p-4">{t(`${windom}.tableCell.efhwCons`)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.comparisonSummary`}
              components={{ strong: <strong /> }}
            />
          </p>

          {/* Misconception */}
          <h3>{t(`${windom}.misconceptionTitle`)}</h3>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.misconceptionIntro`}
              components={{ strong: <strong /> }}
            />
          </p>
          <h4>{t(`${windom}.misconceptionPhysicsTitle`)}</h4>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.misconceptionPhysics`}
              components={{ strong: <strong /> }}
            />
          </p>
          <h4>{t(`${windom}.misconceptionFeedTitle`)}</h4>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.misconceptionFeed`}
              components={{ strong: <strong /> }}
            />
          </p>
          <ul>
            <li>{t(`${windom}.misconceptionFeedLow`)}</li>
            <li>{t(`${windom}.misconceptionFeedHigh`)}</li>
            <li>{t(`${windom}.misconceptionFeedMid`)}</li>
          </ul>
          <p>
            <strong className="text-primary">
              {t(`${windom}.misconceptionConclusion`)}
            </strong>
          </p>
          <h4>{t(`${windom}.misconceptionExTitle`)}</h4>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.misconceptionEx`}
              components={{ strong: <strong /> }}
            />
          </p>

          {/* Polarization */}
          <h3>{t(`${windom}.polarizationTitle`)}</h3>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.polarizationIntro`}
              components={{ strong: <strong /> }}
            />
          </p>

          <h4>{t(`${windom}.polarizationReason1Title`)}</h4>
          <p>{t(`${windom}.polarizationReason1`)}</p>

          <h4>{t(`${windom}.polarizationReason2Title`)}</h4>
          <ul>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${windom}.polarizationReason2List.horizontal`}
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${windom}.polarizationReason2List.invertedV`}
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                ns="demos"
                i18nKey={`${windom}.polarizationReason2List.sloper`}
                components={{ strong: <strong /> }}
              />
            </li>
          </ul>

          <h4>{t(`${windom}.polarizationExceptionTitle`)}</h4>
          <p>
            <Trans
              ns="demos"
              i18nKey={`${windom}.polarizationException`}
              components={{ strong: <strong /> }}
            />
          </p>

          <div className="bg-zinc-50 dark:bg-zinc-900 border rounded-lg p-4 md:p-6 mb-8 text-sm md:text-base leading-relaxed">
            <ScientificCitation
              title={t("physicsValidation")}
              content={
                <p className="mb-2">
                  <Trans
                    ns="demos"
                    i18nKey={`${windom}.physicsContent`}
                    components={{ strong: <strong /> }}
                  />
                </p>
              }
              citations={[
                {
                  id: "arrl-antenna-book",
                  text: "The ARRL Antenna Book. Chapter 6: Multiband Antennas.",
                },
                {
                  id: "w8ji-windom",
                  text: "W8JI. Windom Antenna and Off-Center Fed Dipoles.",
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
