import {
  Barcode,
  BookmarkSimple,
  ChatCircleText,
  Database,
  Drop,
  Fire,
  Leaf,
  PersonSimpleWalk,
  Scales,
  Sparkle,
  Timer,
  WifiSlash,
} from "@phosphor-icons/react/dist/ssr";
import { Eyebrow, Shell } from "@/components/landing/shell";
import { DrawnBar } from "@/components/motion/progress";
import { Reveal } from "@/components/motion/reveal";

const PARSED_MEAL: [string, string, number][] = [
  ["Harira", "1 bowl · 350 g", 203],
  ["Msemen", "2 pieces · 160 g", 528],
  ["Mint tea, no sugar", "1 glass · 200 ml", 2],
];

const WEEK: { day: string; pct: number; over?: boolean }[] = [
  { day: "M", pct: 82 },
  { day: "T", pct: 95 },
  { day: "W", pct: 71 },
  { day: "T", pct: 100, over: true },
  { day: "F", pct: 88 },
  { day: "S", pct: 64 },
  { day: "S", pct: 91 },
];

function TileHead({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div>
      {icon}
      <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-paper">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-paper-mute">{copy}</p>
    </div>
  );
}

/**
 * The dashboard, previewed — every feature card mirrors a real tile from
 * the signed-in app so visitors see the product before creating an account.
 */
export function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-[1200px] scroll-mt-28 px-4 py-24 sm:px-6 md:py-32">
      <Reveal className="max-w-2xl">
        <Eyebrow>Inside the app</Eyebrow>
        <h2 className="mt-5 font-display text-4xl font-bold tracking-tighter text-paper md:text-5xl" data-reveal>
          Your dashboard, before you sign up.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-paper-dim" data-reveal>
          Everything below is a real tile from the app — the same cards you
          will use every day, from AI meal logging to the weekly coach report.
        </p>
      </Reveal>

      <Reveal className="mt-14 grid gap-5 md:grid-cols-12" stagger={0.1}>
        {/* AI meal logging — describe it, get portions */}
        <Shell className="md:col-span-7">
          <TileHead
            icon={<Sparkle weight="duotone" className="size-7 text-lime" />}
            title="Log a meal in one sentence"
            copy="Type it or snap it — the AI splits your plate into foods and gram portions, you confirm, it lands in the diary."
          />
          <div className="mt-6 rounded-xl border border-ink-700 bg-ink-950/50 p-4">
            <p className="ml-auto w-fit max-w-full rounded-2xl rounded-br-md bg-lime px-4 py-2.5 text-sm font-medium text-lime-ink">
              harira, two msemen and a mint tea
            </p>
            <div className="mt-4 space-y-2">
              {PARSED_MEAL.map(([name, portion, kcal]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-paper">{name}</p>
                    <p className="text-[11px] text-paper-mute">{portion}</p>
                  </div>
                  <p className="shrink-0 font-mono text-sm text-paper-dim tabular">{kcal} kcal</p>
                </div>
              ))}
            </div>
          </div>
        </Shell>

        {/* AI coach insights */}
        <Shell className="md:col-span-5">
          <TileHead
            icon={<ChatCircleText weight="duotone" className="size-7 text-lime" />}
            title="A coach that reads your day"
            copy="Daily insights with the rigour of a dietitian — what went well, what to fix at the next meal."
          />
          <div className="mt-6 space-y-3">
            {[
              "Protein is 38 g behind pace — front-load it at lunch.",
              "Fibre landed at 12 g yesterday. Add khobz kamil or a pear.",
              "Great streak: 5 days inside your calorie window.",
            ].map((line) => (
              <p
                key={line}
                className="rounded-xl border border-ink-700 bg-ink-950/50 px-4 py-3 text-sm leading-relaxed text-paper-dim"
              >
                {line}
              </p>
            ))}
            <p className="text-[10px] uppercase tracking-[0.18em] text-paper-mute">
              General guidance — not medical advice
            </p>
          </div>
        </Shell>

        {/* Adaptive targets */}
        <Shell className="md:col-span-7">
          <TileHead
            icon={<Scales weight="duotone" className="size-7 text-lime" />}
            title="Targets that follow your body"
            copy="Log your weight and So3ra reads the trend, recalibrates your real TDEE and nudges your targets — the formula is just the starting point."
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Trend", "−0.42 kg / wk", "smoothed, not noisy"],
                ["Real TDEE", "2,764 kcal", "vs 2,700 estimated"],
                ["Adjustment", "+64 kcal", "applied this week"],
              ] as const
            ).map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border border-ink-700 bg-ink-950/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-paper-mute">
                  {label}
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-paper tabular">
                  {value}
                </p>
                <p className="text-[11px] text-paper-mute">{sub}</p>
              </div>
            ))}
          </div>
        </Shell>

        {/* Habits & streaks */}
        <Shell className="md:col-span-5">
          <TileHead
            icon={<Fire weight="duotone" className="size-7 text-lime" />}
            title="The whole day, not just food"
            copy="Water, steps, workouts, fasting windows and logging streaks live on the same screen as your macros."
          />
          <div className="mt-6 grid grid-cols-2 gap-3">
            {(
              [
                [Drop, "Water", "6 / 8 glasses"],
                [PersonSimpleWalk, "Steps", "8,450"],
                [Timer, "Fast", "14 h 02 m"],
                [Fire, "Streak", "18 days"],
              ] as const
            ).map(([Icon, label, value]) => (
              <div key={label} className="rounded-xl border border-ink-700 bg-ink-950/50 p-4">
                <Icon weight="duotone" className="size-5 text-lime" />
                <p className="mt-2 text-[11px] text-paper-mute">{label}</p>
                <p className="font-mono text-sm font-semibold text-paper tabular">{value}</p>
              </div>
            ))}
          </div>
        </Shell>

        {/* Barcode + food library */}
        <Shell className="md:col-span-6">
          <TileHead
            icon={<Barcode weight="duotone" className="size-7 text-lime" />}
            title="Scan it, search it, or make it"
            copy="A barcode scanner backed by Open Food Facts Morocco, plus your own foods and recipes — stored per 100 g, always exact."
          />
          <div className="mt-6 rounded-xl border border-ink-700 bg-ink-950/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-paper">Natural yogurt, scanned</p>
                <p className="font-mono text-[11px] text-paper-mute">611…4302</p>
              </div>
              <p className="shrink-0 rounded-full border border-lime/25 bg-lime/[0.07] px-3 py-1 font-mono text-xs text-lime tabular">
                61 kcal / 100 g
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["Protein", 46, "3.4 g"],
                  ["Carbs", 63, "4.7 g"],
                  ["Fat", 44, "3.3 g"],
                ] as const
              ).map(([label, pct, grams], i) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-14 text-[11px] text-paper-mute">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <DrawnBar pct={pct} delay={i * 0.12} className="bg-lime" />
                  </div>
                  <span className="w-12 text-right font-mono text-[11px] text-paper-dim tabular">
                    {grams}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Shell>

        {/* Weekly report */}
        <Shell className="md:col-span-6">
          <TileHead
            icon={<Leaf weight="duotone" className="size-7 text-lime" />}
            title="A report card every Monday"
            copy="Calendar-week summaries with charts, averages and a written coach review of what actually happened."
          />
          <div className="mt-6 rounded-xl border border-ink-700 bg-ink-950/50 p-4">
            <div className="flex h-24 items-end justify-between gap-2">
              {WEEK.map(({ day, pct, over }, i) => (
                <div key={`${day}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <div
                    className={`w-full max-w-7 rounded-t ${over ? "bg-fat" : "bg-lime/80"}`}
                    style={{ height: `${pct * 0.82}%` }}
                  />
                  <span className="text-[10px] text-paper-mute">{day}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-ink-700 pt-3 text-sm leading-relaxed text-paper-dim">
              “Six of seven days inside the window — Thursday&rsquo;s overshoot was
              mostly fat. Average protein 171 g. Keep the weekend structure.”
            </p>
          </div>
        </Shell>

        {/* compact strip */}
        {(
          [
            [
              BookmarkSimple,
              "Saved meals",
              "Snapshot any meal and re-log the whole thing in one tap — or copy yesterday entirely.",
            ],
            [
              Leaf,
              "Micronutrients too",
              "Iron, calcium, sodium and friends tracked against daily values — never guessed, never faked as zero.",
            ],
            [
              WifiSlash,
              "Offline, installable",
              "A PWA that logs on the metro and syncs when you resurface. English, French and Arabic with full RTL.",
            ],
          ] as const
        ).map(([Icon, title, copy]) => (
          <Shell key={title} className="md:col-span-4">
            <Icon weight="duotone" className="size-6 text-lime" />
            <h3 className="mt-3 font-display text-base font-semibold tracking-tight text-paper">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-paper-mute">{copy}</p>
          </Shell>
        ))}
      </Reveal>

      <Reveal className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-paper-mute">
        <Database className="size-4" />
        <span>
          Product data from{" "}
          <a
            href="https://world.openfoodfacts.org"
            rel="noreferrer"
            target="_blank"
            className="underline underline-offset-2 hover:text-paper"
          >
            Open Food Facts
          </a>{" "}
          (ODbL). Numbers above are illustrative.
        </span>
      </Reveal>
    </section>
  );
}
