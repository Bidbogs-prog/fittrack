"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export { gsap, ScrollTrigger, useGSAP };

/* Motion tokens — one vocabulary for the whole app. */
export const EASE = {
  /** Default entrance: soft acceleration, gentle settle. */
  out: "power3.out",
  /** Emphasis / hero moments. */
  emphasis: "expo.out",
  /** Exits are faster and sharper. */
  in: "power2.in",
  /** Slight overshoot for playful settles (badges, chips). */
  settle: "back.out(1.6)",
} as const;

export const DUR = {
  micro: 0.18,
  ui: 0.26,
  panel: 0.55,
  section: 0.8,
  hero: 1.15,
} as const;

export const STAGGER = 0.07;

export const REDUCED = "(prefers-reduced-motion: reduce)";
export const NOT_REDUCED = "(prefers-reduced-motion: no-preference)";
