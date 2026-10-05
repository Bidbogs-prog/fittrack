import { CaretRight, CheckCircle, DownloadSimple, Info, SignOut, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { LOCALES, LOCALE_LABELS } from "@/i18n/request";
import { getActiveTargets } from "@/lib/adaptive";
import { getCoachAllowance } from "@/lib/ai-usage";
import { getProfile, isAdmin } from "@/lib/auth";
import { isPremium } from "@/lib/entitlements";
import { ACTIVITY_LEVELS, ageFromBirthDate, macroSplitFromProfile } from "@/lib/nutrition";
import { formatHeight, formatWeight } from "@/lib/units";
import { signout } from "../../(auth)/actions";
import { changePassword, deleteAccount, saveUnits, setLocale } from "./actions";
import { SplitEditor, WindowEditor } from "./editors";

export const metadata = { title: "Me" };

const card = "rounded-[20px] border border-ink-800 bg-ink-900 lg:rounded-[22px]";
const eyebrow = "text-[10px] font-semibold tracking-[0.14em] text-paper-mute uppercase";
const row = "flex min-h-12 items-center justify-between gap-3 border-t border-ink-800 px-3.5 lg:px-5";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ supabase, userId, profile }, { error, message }, t, ta, locale] = await Promise.all([
    getProfile(),
    searchParams,
    getTranslations("me"),
    getTranslations("account"),
    getLocale(),
  ]);

  // Entry point only — every /admin page and action re-verifies membership.
  const [admin, active, premium] = await Promise.all([
    isAdmin(supabase, userId),
    getActiveTargets(supabase, userId, profile),
    isPremium(supabase, userId),
  ]);
  const allowance = await getCoachAllowance(supabase, userId, premium);
  const monthlyLeft =
    allowance.monthly != null ? Math.max(0, allowance.monthly - allowance.usedMonth) : null;
  const targets = active?.targets ?? null;
  const format = await getFormatter();

  const name = profile.full_name ?? profile.email ?? t("athlete");
  const initial = name.trim().charAt(0).toUpperCase();
  const saved = macroSplitFromProfile(profile);
  const effective = (() => {
    if (!targets || targets.kcal <= 0) return { protein: 30, carbs: 45, fat: 25 };
    const p = Math.round(((targets.protein * 4) / targets.kcal) * 100);
    const f = Math.round(((targets.fat * 9) / targets.kcal) * 100);
    return { protein: p, carbs: 100 - p - f, fat: f };
  })();

  return (
    <div className="flex flex-col gap-3 lg:gap-[18px]">
      <header className="flex items-center gap-3 lg:gap-4">
        <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--ink-600),var(--ink-800))] font-display text-xl font-semibold text-paper-dim lg:size-16 lg:text-2xl">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold text-paper lg:text-4xl lg:leading-none lg:tracking-[-0.03em]">
            {profile.full_name ?? t("title")}
          </h1>
          <p className="mt-0.5 truncate text-xs text-paper-mute lg:mt-1 lg:text-[13px]">{profile.email}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-paper-mute lg:text-xs">
            <span
              className={
                premium
                  ? "rounded-full bg-[linear-gradient(135deg,#ffc94d,#ff9d3b_50%,#f2701f)] px-2 py-0.5 font-semibold text-flame-ink"
                  : "rounded-full border border-ink-700 px-2 py-0.5 font-medium text-paper-dim"
              }
            >
              {premium ? t("planPremium") : t("planFree")}
            </span>
            <span>
              {premium
                ? allowance.daily != null && t("planPremiumHint", { daily: allowance.daily })
                : monthlyLeft != null &&
                  allowance.daily != null &&
                  t("planFreeHint", { left: monthlyLeft, monthly: allowance.monthly!, daily: allowance.daily })}
            </span>
          </p>
        </div>
      </header>

      {message && (
        <p role="status" className="flex max-w-xl items-start gap-2 rounded-xl border border-fibre/30 bg-fibre/10 px-3.5 py-3 text-sm text-fibre">
          <Info className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{message}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="flex max-w-xl items-start gap-2 rounded-xl border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {/* body */}
        <section className={`${card} flex flex-col gap-2.5 p-3.5 max-lg:order-3 lg:p-5`}>
          <h2 className={eyebrow}>{t("body")}</h2>
          <dl className="grid grid-cols-2 gap-2.5 font-mono">
            {(
              [
                [t("weight"), profile.weight_kg ? formatWeight(profile.weight_kg, profile.units) : "—"],
                [t("height"), profile.height_cm ? formatHeight(profile.height_cm, profile.units) : "—"],
                [t("age"), profile.birth_date ? String(ageFromBirthDate(profile.birth_date)) : "—"],
                [
                  t("training"),
                  profile.activity_level ? `×${ACTIVITY_LEVELS[profile.activity_level].multiplier}` : "—",
                ],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="font-sans text-[11px] text-paper-mute">{label}</dt>
                <dd className="text-base text-paper tabular lg:text-lg">{value}</dd>
              </div>
            ))}
          </dl>
          <a
            href="/onboarding?edit=1"
            className="mt-auto inline-flex min-h-9 items-center text-[13px] font-medium text-flame hover:text-flame-glow"
          >
            {t("updateBody")} <span aria-hidden className="ms-1 rtl:-scale-x-100">→</span>
          </a>
        </section>

        {/* eating window */}
        <section className={`${card} p-3.5 max-lg:order-1 lg:p-5`}>
          <WindowEditor start={profile.eating_window_start} end={profile.eating_window_end} />
        </section>

        {/* targets */}
        <section className={`${card} flex flex-col gap-2 p-3.5 max-lg:order-2 lg:gap-2.5 lg:p-5`}>
          <div className="flex items-center justify-between">
            <h2 className={eyebrow}>{t("targets")}</h2>
            {active?.adaptive && (
              <span className="inline-flex items-center gap-1 text-[11px] text-fibre lg:text-xs">
                {t("adaptive")} <CheckCircle weight="fill" className="size-3.5" />
              </span>
            )}
          </div>
          <p className="font-mono text-lg font-semibold tracking-[-0.03em] text-paper tabular lg:text-[26px]">
            {targets ? `${format.number(targets.kcal)} kcal` : "—"}
          </p>
          <SplitEditor saved={saved} effective={effective} />
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <section className={`${card} overflow-hidden text-sm`}>
          <h2 className={`${eyebrow} px-3.5 pt-3.5 pb-2 lg:px-5`}>{t("preferences")}</h2>
          <form action={saveUnits} className={row}>
            <span className="text-paper">{ta("units")}</span>
            <span className="flex gap-1">
              {(["metric", "imperial"] as const).map((u) => (
                <button
                  key={u}
                  type="submit"
                  name="units"
                  value={u}
                  aria-pressed={profile.units === u}
                  className={`min-h-9 rounded-full px-3 text-xs ${
                    profile.units === u ? "bg-ink-800 text-paper" : "text-paper-mute hover:text-paper"
                  }`}
                >
                  {t(u)}
                </button>
              ))}
            </span>
          </form>
          <form action={setLocale} className={row}>
            <span className="text-paper">{ta("language")}</span>
            <span className="flex gap-1">
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="submit"
                  name="locale"
                  value={code}
                  lang={code}
                  aria-pressed={locale === code}
                  className={`min-h-9 rounded-full px-2.5 text-xs ${
                    locale === code ? "bg-ink-800 text-paper" : "text-paper-mute hover:text-paper"
                  }`}
                >
                  {LOCALE_LABELS[code]}
                </button>
              ))}
            </span>
          </form>
          <details className="group border-t border-ink-800">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 text-paper lg:px-5 [&::-webkit-details-marker]:hidden">
              {ta("changePassword")}
              <CaretRight weight="bold" className="size-3.5 text-paper-mute transition-transform group-open:rotate-90 rtl:-scale-x-100" />
            </summary>
            <form action={changePassword} className="flex flex-wrap items-center gap-2 px-3.5 pb-3.5 lg:px-5">
              <label htmlFor="password" className="sr-only">
                {ta("newPassword")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="field min-w-0 flex-1"
                placeholder={ta("passwordPlaceholder")}
              />
              <button type="submit" className="btn-flame btn-press min-h-11 rounded-xl px-4 text-sm">
                {ta("updatePassword")}
              </button>
            </form>
          </details>
        </section>

        <section className={`${card} overflow-hidden text-sm`}>
          <h2 className={`${eyebrow} px-3.5 pt-3.5 pb-2 lg:px-5`}>{t("account")}</h2>
          <Link href="/coach" className={`${row} hover:bg-ink-850`}>
            <span className="text-paper">{t("coachChats")}</span>
            <CaretRight weight="bold" className="size-3.5 text-paper-mute rtl:-scale-x-100" />
          </Link>
          <div className={row}>
            <span className="text-paper">{t("export")}</span>
            <span className="flex gap-1">
              {(
                [
                  ["diary", ta("foodDiary")],
                  ["weight", ta("weightHistory")],
                ] as const
              ).map(([what, label]) => (
                <a
                  key={what}
                  href={`/api/export?what=${what}&format=csv`}
                  download
                  className="inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-xs text-paper-mute hover:text-flame"
                >
                  <DownloadSimple weight="bold" className="size-3.5" />
                  {label}
                </a>
              ))}
            </span>
          </div>
          {admin && (
            <Link href="/admin" className={`${row} hover:bg-ink-850`}>
              <span className="text-paper">{ta("adminConsole")}</span>
              <span className="rounded-md border border-flame/40 px-1.5 py-px text-[11px] text-flame">ADMIN</span>
            </Link>
          )}
          <form action={signout} className="border-t border-ink-800">
            <button
              type="submit"
              className="flex min-h-12 w-full items-center gap-2 px-3.5 text-start text-danger hover:bg-danger/5 lg:px-5"
            >
              <SignOut weight="bold" className="size-4" />
              {ta("signOut")}
            </button>
          </form>
        </section>
      </div>

      <details className="group max-w-xl rounded-[20px] border border-danger/30 bg-danger/[0.04]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-danger [&::-webkit-details-marker]:hidden">
          {ta("deleteAccount")}
          <CaretRight weight="bold" className="size-3.5 transition-transform group-open:rotate-90 rtl:-scale-x-100" />
        </summary>
        <div className="px-4 pb-4">
          <p className="text-sm text-paper-dim">{ta("deleteHint")}</p>
          <form action={deleteAccount} className="mt-4 space-y-3">
            <label htmlFor="confirm" className="field-label">
              {ta.rich("deleteConfirmLabel", {
                keyword: (chunks) => <span className="font-mono text-danger">{chunks}</span>,
              })}
            </label>
            <input id="confirm" name="confirm" autoComplete="off" required className="field" placeholder="delete" />
            <button
              type="submit"
              className="btn-press min-h-11 rounded-xl border border-danger/50 px-5 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
            >
              {ta("deleteButton")}
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
