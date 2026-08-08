import type { Units } from "./types";

/**
 * Display units (roadmap 2.2). Storage is metric everywhere — kg and cm in
 * the database, grams in the diary. Imperial is presentation only:
 * convert on the way out, convert back at the input edge.
 */

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** The unit a weight number is shown in. */
export function weightUnit(units: Units): "kg" | "lb" {
  return units === "imperial" ? "lb" : "kg";
}

/** Weight in display units, 1 decimal. */
export function displayWeight(kg: number, units: Units): number {
  const v = units === "imperial" ? kgToLb(kg) : kg;
  return Math.round(v * 10) / 10;
}

/** "72.5 kg" / "159.8 lb". */
export function formatWeight(kg: number, units: Units): string {
  return `${displayWeight(kg, units).toFixed(1)} ${weightUnit(units)}`;
}

/** A user-typed weight in display units, back to storage kg. */
export function inputWeightToKg(value: number, units: Units): number {
  const kg = units === "imperial" ? lbToKg(value) : value;
  return Math.round(kg * 10) / 10;
}

/** "178 cm" / "5 ft 10 in". */
export function formatHeight(cm: number, units: Units): string {
  if (units !== "imperial") return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / CM_PER_IN);
  return `${Math.floor(totalIn / 12)} ft ${totalIn % 12} in`;
}
