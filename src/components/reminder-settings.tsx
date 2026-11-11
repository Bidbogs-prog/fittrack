"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BellRinging, Check } from "@phosphor-icons/react";
import {
  removePushSubscription,
  savePushSubscription,
  saveReminderTimes,
  sendTestReminder,
  syncReminderClock,
} from "@/app/(app)/account/reminder-actions";
import { track } from "@/lib/analytics";
import { useClientValue } from "@/lib/use-client-clock";
import { currentSubscription, pushSupport, subscribeDevice, type PushSupport } from "@/lib/push-client";

export interface ReminderTimes {
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
}

const SLOTS = ["breakfast", "lunch", "dinner"] as const;
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

/** Turn on Web Push for this device and toggle the reminder action on. */
export function useEnableReminders(surface: string) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => {
    // Capability checks need the browser; read once after mount.
    const s = pushSupport();
    currentSubscription().then((sub) => {
      setSupport(s);
      setSubscribed(sub != null);
    });
  }, []);

  const enable = () =>
    start(async () => {
      setError(null);
      const res = await subscribeDevice();
      if (!res.ok) {
        setError(res.reason);
        if (res.reason === "denied") setSupport("denied");
        return;
      }
      const saved = await savePushSubscription({
        endpoint: res.endpoint,
        p256dh: res.p256dh,
        auth: res.auth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        utcOffsetMin: -new Date().getTimezoneOffset(),
        userAgent: navigator.userAgent,
      });
      if (!saved.ok) return setError("failed");
      setSubscribed(true);
      track("reminders_enabled", { surface });
    });

  return { support, subscribed, setSubscribed, error, busy, enable };
}

/** Me page: device opt-in, times per meal, test send. */
export function ReminderSettings({ initial }: { initial: ReminderTimes | null }) {
  const t = useTranslations("reminders");
  const { support, subscribed, setSubscribed, error, busy, enable } = useEnableReminders("account");
  const [saving, startSave] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const times = initial ?? { breakfast: "09:00", lunch: "13:30", dinner: "20:30" };

  const blocker =
    support === "ios-install" ? t("iosInstall")
    : support === "unsupported" ? t("unsupported")
    : support === "denied" ? t("denied")
    : support === "not-configured" ? t("notConfigured")
    : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-paper-dim">{t("body")}</p>

      {support == null ? null : blocker && !subscribed ? (
        <p className="rounded-lg border border-ink-700 px-3 py-2.5 text-xs leading-relaxed text-paper-dim">{blocker}</p>
      ) : subscribed ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="flex items-center gap-1.5 text-[13px] text-paper">
            <Check weight="bold" className="size-4 text-flame" />
            {t("on")}
          </p>
          <button
            type="button"
            className="text-xs text-flame hover:text-flame-glow"
            onClick={() =>
              startSave(async () => {
                const { sent } = await sendTestReminder();
                setNote(sent > 0 ? t("testSent") : t("failed"));
              })
            }
          >
            {t("test")}
          </button>
          <button
            type="button"
            className="text-xs text-paper-mute hover:text-danger"
            onClick={() =>
              startSave(async () => {
                const sub = await currentSubscription();
                if (sub) {
                  await removePushSubscription(sub.endpoint);
                  await sub.unsubscribe().catch(() => {});
                }
                setSubscribed(false);
                track("reminders_disabled", {});
              })
            }
          >
            {t("disable")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="btn-press btn-flame inline-flex min-h-10 items-center gap-2 self-start rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
        >
          <BellRinging weight="fill" className="size-4" />
          {busy ? t("enabling") : t("enable")}
        </button>
      )}
      {error && error !== "denied" && <p role="alert" className="text-xs text-danger">{t("failed")}</p>}

      {(subscribed || initial) && (
        <form
          action={(fd) =>
            startSave(async () => {
              fd.set("offset", String(-new Date().getTimezoneOffset()));
              const res = await saveReminderTimes(fd);
              setNote(res.ok ? t("saved") : t("failed"));
            })
          }
          className="flex flex-col gap-2"
        >
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map((slot) => (
              <label key={slot} className="flex flex-col gap-1">
                <span className="text-[11px] text-paper-mute">{t(`slot.${slot}`)}</span>
                <input type="time" name={slot} defaultValue={hhmm(times[slot])} className="field h-10 font-mono text-sm tabular" />
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-press self-start rounded-lg border border-ink-700 px-3.5 py-2 text-xs font-semibold text-paper-dim hover:text-paper disabled:opacity-60"
          >
            {t("save")}
          </button>
        </form>
      )}
      {note && <p role="status" className="text-xs text-paper-mute">{note}</p>}
    </div>
  );
}

/**
 * Today: one-time invitation after the user has logged a few meals (never on
 * first visit). Hidden when unsupported, already on, or dismissed.
 */
export function ReminderNudge({ show }: { show: boolean }) {
  const t = useTranslations("reminders");
  const { support, subscribed, busy, enable } = useEnableReminders("nudge");
  const remembered = useClientValue(() => localStorage.getItem("so3ra_reminder_nudge") === "1", true);
  const [dismissedNow, setDismissed] = useState(false);
  if (!show || remembered || dismissedNow || subscribed || support !== "ok") return null;

  const dismiss = () => {
    localStorage.setItem("so3ra_reminder_nudge", "1");
    setDismissed(true);
  };
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-flame/30 bg-[linear-gradient(135deg,rgba(255,157,59,.10),rgba(242,112,31,.02))] p-4">
      <BellRinging weight="fill" className="size-5 shrink-0 text-flame" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-paper">{t("nudgeTitle")}</p>
        <p className="text-xs text-paper-dim">{t("nudgeBody")}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={dismiss} className="px-2 text-xs text-paper-mute hover:text-paper">
          {t("nudgeLater")}
        </button>
        <button
          type="button"
          onClick={() => {
            enable();
            localStorage.setItem("so3ra_reminder_nudge", "1");
          }}
          disabled={busy}
          className="btn-press btn-flame min-h-9 rounded-lg px-3.5 text-[13px] font-semibold disabled:opacity-60"
        >
          {busy ? t("enabling") : t("enable")}
        </button>
      </div>
    </section>
  );
}


/**
 * App shell: when notifications are on, tell the server this device's UTC
 * offset whenever it changes (DST, travel, a tz-data update), so reminders
 * follow the clock the user actually sees.
 */
export function ReminderClockSync() {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const offset = -new Date().getTimezoneOffset();
    const key = "so3ra_reminder_offset";
    try {
      if (localStorage.getItem(key) === String(offset)) return;
    } catch {
      return;
    }
    syncReminderClock({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, utcOffsetMin: offset })
      .then(() => localStorage.setItem(key, String(offset)))
      .catch(() => {});
  }, []);
  return null;
}
