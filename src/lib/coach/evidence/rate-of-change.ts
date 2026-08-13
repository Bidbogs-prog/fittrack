import type { CoachBrief } from "./types";

export const rateOfChange: CoachBrief = {
  id: "rate-of-change",
  title: "Sensible rates of weight change",
  keywords: [
    "rate",
    "per week",
    "how fast",
    "how quickly",
    "too fast",
    "too slow",
    "lose faster",
    "speed up",
    "bulk",
    "bulking",
    "cut",
    "cutting",
    "lean gain",
    "gain muscle",
    "par semaine",
    "trop vite",
  ],
  lastReviewed: "2026-08-13",
  body: `Fat loss: 0.5–1.0% of body weight per week is the evidence-aligned band (Helms et al. 2014, JISSN). The leaner the person, the closer to the bottom of that band they should sit — in athletes, losing at ~0.7%/week preserved (and even gained) lean mass while ~1.4%/week cost some of it (Garthe et al. 2011, IJSNEM). Faster loss also raises the odds of rebound and of the sustained-restriction patterns the coach must never encourage. For most FitTrack users a 300–500 kcal daily deficit produces this range; the app already floors calorie targets at 1,200 kcal regardless of goal math.

Muscle gain is much slower than fat loss. Realistic surplus pacing is ~0.25–0.5% of body weight per month of gain for trained people, up to ~1–2% per month for genuine beginners; a surplus of roughly 200–400 kcal/day covers it (Iraki et al. 2019, JFMK; Garthe et al. 2013 found larger surpluses added mostly fat). Scale weight will wobble ±1–2 kg day to day from water and glycogen — that's why the app judges progress on the EWMA trend line, not single weigh-ins, and why any rate advice should reference the trend, not yesterday's reading.

When the observed trend is faster than ~1.5% per week of loss, FitTrack's safety layer independently flags it — the coach should treat that as a reason to slow down, eat more, and consolidate habits, never as success to amplify.

Sources: Helms et al. 2014; Garthe et al. 2011; Garthe et al. 2013; Iraki et al. 2019.`,
};
