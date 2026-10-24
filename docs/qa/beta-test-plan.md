# Beta test plan

**Test object:** So3ra PWA, invite-gated closed beta. **Period:** ~8 weeks before the Ramadan 2027 public launch. **Participants:** 100–300 adults in Morocco, admitted in weekly batches of 50–200.

## Scope
- In scope: onboarding, logging (search, barcode, text, voice, photo, saved meals), AI edits, coach chat, day read, Monday check-in, coach memory, premium limits, waitlist/invite flows, three languages.
- Out of scope: payments (no provider yet), native apps, health sync.

## Approach
- Weekly exploratory session (60 min) on iPhone Safari + installed PWA, Android Chrome, desktop; charters rotate across the risk register.
- Every release: CI gate green; coach eval if prompts changed; manual smoke of sign-up with invite → onboarding → log → edit → coach.
- User feedback: coach thumbs, one-question day-7 survey, 10 interviews (5 retained, 5 churned).

## Entry criteria
- Founder blockers in ROADMAP G0 cleared for anything beyond friends and family.
- No open Critical/High defects; CI green on the release commit.

## Exit criteria (beta → public launch)
- No open Critical/High defects for 2 consecutive weeks.
- Coach eval 28/28 on two runs on the launch prompt; memory-injection cases added and passing.
- Activation ≥ 50% (≥ 3 meals in 48 h); D7 ≥ 25%; AI cost per active user within 25% of the model ($0.12 free / $0.58 premium per month).

## Metrics
Per invite code / source in PostHog: activation, D7, D30, logging days/week, AI-log share, premium and health-sync intent; defects found per week by severity.
