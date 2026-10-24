import { describe, expect, it } from "vitest";
import { isPremium } from "./entitlements";

/**
 * Premium access — decision table. Conditions: row exists, status, period
 * end (none / future / past), lookup error. Premium only when all hold:
 * a row, status "active", and no end or an end in the future.
 */
function stub(row: { status: string; current_period_end: string | null } | null, error = false) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  chain.maybeSingle = async () => (error ? { data: null, error: { message: "down" } } : { data: row, error: null });
  return { from: () => chain } as never;
}

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

describe("isPremium decision table", () => {
  it.each([
    // [rule, row, lookup error, expected]
    ["R1 no row", null, false, false],
    ["R2 active, no end (manual grant)", { status: "active", current_period_end: null }, false, true],
    ["R3 active, end in future", { status: "active", current_period_end: future }, false, true],
    ["R4 active, end in past (expired pass)", { status: "active", current_period_end: past }, false, false],
    ["R5 canceled, end in future", { status: "canceled", current_period_end: future }, false, false],
    ["R6 past_due, no end", { status: "past_due", current_period_end: null }, false, false],
    ["R7 lookup error → free (fail closed)", { status: "active", current_period_end: null }, true, false],
  ] as const)("%s", async (_rule, row, error, expected) => {
    expect(await isPremium(stub(row, error), "u")).toBe(expected);
  });
});
