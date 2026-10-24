import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

/**
 * Open-redirect regression suite (security, CWE-601). Equivalence partitions:
 * valid same-origin paths are kept (normalised); every off-site or malformed
 * input falls back. DR-001 in docs/qa/defects.md.
 */
const FALLBACK = "/dashboard";

describe("safeRedirectPath — valid partition (same-origin paths)", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/coach?c=new&q=hi", "/coach?c=new&q=hi"],
    ["/history#week", "/history#week"],
    ["/", "/"],
    ["/foods/../account", "/account"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirectPath(input, FALLBACK)).toBe(expected);
  });
});

describe("safeRedirectPath — invalid partition (falls back)", () => {
  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["tab-smuggled", "/\t/evil.com"],
    ["newline-smuggled", "/\n/evil.com"],
    ["absolute https", "https://evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative path", "dashboard"],
    ["empty", ""],
  ])("%s", (_name, input) => {
    expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
  });

  it.each([null, undefined, 42, {}])("non-string %p", (input) => {
    expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
  });
});
