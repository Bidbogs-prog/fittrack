import type { CoachBrief } from "./types";

export const plateaus: CoachBrief = {
  id: "plateaus",
  title: "Plateaus & stalls",
  keywords: [
    "plateau",
    "stuck",
    "stall",
    "stalled",
    "not losing",
    "stopped losing",
    "same weight",
    "no progress",
    "starvation mode",
    "not working",
    "stagne",
    "bloqué",
  ],
  lastReviewed: "2026-08-13",
  body: `Before changing anything, define the plateau properly: no movement in the EWMA trend weight for 2–3 weeks, with reasonable logging coverage. A flat week means nothing — daily water, glycogen, sodium and cycle-related shifts of 1–2 kg routinely mask fat loss for days at a time, and a "whoosh" after a stable stretch is just that water clearing.

Once a real 2–3 week stall is established, work the causes in order of likelihood:
1. Intake drift. Logging gets looser over time — untracked bites, sauces, oils, weekend swings. Under-reporting is the dominant explanation for "eating 1,200 and not losing" (Lichtman et al. 1992, NEJM: intake under-reported by ~47% on average). The fix is a tightening week (weigh everything, log same-day), not a bigger deficit.
2. Expenditure fell with body weight — a smaller body burns less, plus some adaptive reduction (Rosenbaum & Leibel 2010). FitTrack's adaptive TDEE recalibrates every Monday, so check whether the target already moved; if the deficit has genuinely evaporated, a modest 100–200 kcal adjustment or more daily movement (steps) restores it.
3. Adherence fatigue. If logging coverage itself is dropping, the plateau is a consistency problem — a maintenance diet break (see refeeds brief) beats pushing a deficit the user can't hold.

What the coach must not do with plateaus: prescribe aggressive cuts below the app's floor, stack fasting on top of a deficit, or frame the stall as failure — and for users in restricted mode, plateau troubleshooting is limited to logging quality and maintenance-level habits.

Sources: Lichtman et al. 1992; Rosenbaum & Leibel 2010.`,
};
