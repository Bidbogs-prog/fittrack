import { DownloadSimple, Info, PersonSimpleRun, SignOut, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { LOCALES, LOCALE_LABELS } from "@/i18n/request";
import { signout } from "../../(auth)/actions";
import { changePassword, deleteAccount, saveFastingWindow, saveUnits, setLocale } from "./actions";

export const metadata = { title: "Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ profile }, { error, message }, t, locale] = await Promise.all([
    getProfile(),
    searchParams,
    getTranslations("account"),
    getLocale(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          {profile.email}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          {t("title")}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href="/onboarding?edit=1"
            className="btn-press inline-flex items-center gap-2 rounded-lg border border-ink-700 px-4 py-2.5 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
          >
            <PersonSimpleRun weight="bold" className="size-4" />
            {t("updateBodyStats")}
          </a>
          <form action={signout}>
            <button
              type="submit"
              className="btn-press inline-flex items-center gap-2 rounded-lg border border-ink-700 px-4 py-2.5 text-xs font-semibold text-paper-dim transition-colors hover:border-danger/50 hover:text-danger"
            >
              <SignOut weight="bold" className="size-4" />
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>

      {message && (
        <p className="flex max-w-xl items-start gap-2 rounded-lg border border-lime/25 bg-lime/[0.06] px-3.5 py-3 text-sm text-lime">
          <Info className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{message}</span>
        </p>
      )}
      {error && (
        <p className="flex max-w-xl items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      <section className="max-w-xl rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">{t("language")}</h2>
        <p className="mt-2 text-sm text-paper-dim">{t("languageHint")}</p>
        <form action={setLocale} className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("language")}>
            {LOCALES.map((code) => (
              <label
                key={code}
                className={`btn-press cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  locale === code
                    ? "border-lime/60 bg-lime/10 text-lime"
                    : "border-ink-700 text-paper-dim hover:text-paper"
                }`}
              >
                <input
                  type="radio"
                  name="locale"
                  value={code}
                  defaultChecked={locale === code}
                  className="sr-only"
                />
                {LOCALE_LABELS[code]}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="btn-press rounded-xl bg-lime px-5 py-2 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
          >
            {t("save")}
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">{t("changePassword")}</h2>
        <form action={changePassword} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="field-label">{t("newPassword")}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="field"
              placeholder={t("passwordPlaceholder")}
            />
          </div>
          <button
            type="submit"
            className="btn-press rounded-xl bg-lime px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
          >
            {t("updatePassword")}
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">{t("units")}</h2>
        <p className="mt-2 text-sm text-paper-dim">{t("unitsHint")}</p>
        <form action={saveUnits} className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-2" role="radiogroup" aria-label={t("units")}>
            {(
              [
                ["metric", t("unitsMetric")],
                ["imperial", t("unitsImperial")],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`btn-press cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  profile.units === value
                    ? "border-lime/60 bg-lime/10 text-lime"
                    : "border-ink-700 text-paper-dim hover:text-paper"
                }`}
              >
                <input
                  type="radio"
                  name="units"
                  value={value}
                  defaultChecked={profile.units === value}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="btn-press rounded-xl bg-lime px-5 py-2 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
          >
            {t("save")}
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">{t("fasting")}</h2>
        <p className="mt-2 text-sm text-paper-dim">{t("fastingHint")}</p>
        <form action={saveFastingWindow} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="fasting-start" className="field-label">{t("firstMeal")}</label>
              <input
                id="fasting-start"
                name="start"
                type="time"
                defaultValue={profile.eating_window_start?.slice(0, 5) ?? ""}
                className="field tabular"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="fasting-end" className="field-label">{t("lastMeal")}</label>
              <input
                id="fasting-end"
                name="end"
                type="time"
                defaultValue={profile.eating_window_end?.slice(0, 5) ?? ""}
                className="field tabular"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn-press rounded-xl bg-lime px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
          >
            {t("saveWindow")}
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">{t("yourData")}</h2>
        <p className="mt-2 text-sm text-paper-dim">{t("yourDataHint")}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              [t("foodDiary"), "diary"],
              [t("weightHistory"), "weight"],
            ] as const
          ).map(([label, what]) => (
            <div key={what} className="rounded-xl border border-ink-700 px-4 py-3">
              <p className="text-sm font-medium text-paper">{label}</p>
              <p className="mt-2 flex gap-2">
                {(["csv", "json"] as const).map((format) => (
                  <a
                    key={format}
                    href={`/api/export?what=${what}&format=${format}`}
                    download
                    className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold uppercase text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
                  >
                    <DownloadSimple weight="bold" className="size-3.5" />
                    {format}
                  </a>
                ))}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-xl rounded-2xl border border-danger/30 bg-danger/[0.04] p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-danger">{t("deleteAccount")}</h2>
        <p className="mt-2 text-sm text-paper-dim">{t("deleteHint")}</p>
        <form action={deleteAccount} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="confirm" className="field-label">
              {t.rich("deleteConfirmLabel", {
                keyword: (chunks) => <span className="font-mono text-danger">{chunks}</span>,
              })}
            </label>
            <input
              id="confirm"
              name="confirm"
              autoComplete="off"
              required
              className="field"
              placeholder="delete"
            />
          </div>
          <button
            type="submit"
            className="btn-press rounded-xl border border-danger/50 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-danger transition-colors hover:bg-danger/10"
          >
            {t("deleteButton")}
          </button>
        </form>
      </section>
    </div>
  );
}
