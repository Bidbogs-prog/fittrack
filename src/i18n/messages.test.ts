import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import { ACTIVITY_LEVELS, GOALS, MACRO_PRESETS } from "@/lib/nutrition";
import { MEAL_TYPES } from "@/lib/types";
import { STATUS_KEYS } from "./status";
import { DEFAULT_LOCALE, LOCALES } from "./request";

/**
 * Guards the translation files (roadmap 2.3). Key parity and ICU validity
 * were checked by hand while there were 49 keys; the extraction takes that
 * past 400, where a missing key silently renders its own path to the user
 * and a malformed plural throws at render.
 */

type Messages = { [key: string]: string | Messages };

function load(locale: string): Messages {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"));
}

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** Placeholder and rich-tag names an ICU message expects from the caller. */
function placeholders(ast: MessageFormatElement[], into = new Set<string>()): Set<string> {
  for (const node of ast) {
    if ("value" in node && typeof node.value === "string" && node.type !== TYPE.literal) {
      into.add(node.value);
    }
    if (node.type === TYPE.tag) placeholders(node.children, into);
    if (node.type === TYPE.plural || node.type === TYPE.select) {
      for (const option of Object.values(node.options)) placeholders(option.value, into);
    }
  }
  return into;
}

const source = flatten(load(DEFAULT_LOCALE));
const translations = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

describe("messages", () => {
  it("has messages to check", () => {
    expect(source.size).toBeGreaterThan(0);
  });

  it.each([...source.keys()])("%s parses as ICU in every locale", (key) => {
    for (const locale of LOCALES) {
      const message = flatten(load(locale)).get(key);
      expect(() => parse(message ?? ""), `${locale}: ${key}`).not.toThrow();
    }
  });

  // These lookups are built at runtime (`tActivity(key)`), so TypeScript
  // can't catch a renamed enum member or a typo'd message key.
  it.each([
    ["activity", Object.keys(ACTIVITY_LEVELS)],
    ["goal", Object.keys(GOALS)],
    ["macroPreset", MACRO_PRESETS.map((p) => p.key)],
  ] as const)("%s has a label and detail for every member", (namespace, keys) => {
    const missing = keys
      .flatMap((key) => [`${namespace}.${key}`, `${namespace}.${key}Detail`])
      .filter((path) => !source.has(path));
    expect(missing).toEqual([]);
  });

  it("has a name for every meal type", () => {
    expect(MEAL_TYPES.filter((meal) => !source.has(`meals.${meal}`))).toEqual([]);
  });

  it("has a message for every status key an action can redirect with", () => {
    expect(STATUS_KEYS.filter((key) => !source.has(`status.${key}`))).toEqual([]);
  });

  describe.each(translations)("%s", (locale) => {
    const target = flatten(load(locale));

    it("has no missing keys", () => {
      expect([...source.keys()].filter((k) => !target.has(k))).toEqual([]);
    });

    it("has no keys absent from the source locale", () => {
      expect([...target.keys()].filter((k) => !source.has(k))).toEqual([]);
    });

    it("is not left untranslated where the source is prose", () => {
      // A copied English string is usually a forgotten key. Only real prose
      // counts: strip ICU placeholders and rich-text tags first, so a message
      // that is mostly symbols and units ("/ {litres} L") isn't flagged for
      // being identical in another language — it legitimately is.
      const prose = (value: string) =>
        value
          .replace(/\{[^}]*\}/g, " ")
          .replace(/<\/?[a-zA-Z]+>/g, " ")
          .split(/\s+/)
          .filter((word) => (word.match(/\p{L}/gu) ?? []).length > 1);
      const copied = [...source]
        .filter(([key, value]) => prose(value).length > 2 && target.get(key) === value)
        .map(([key]) => key);
      expect(copied).toEqual([]);
    });

    it("keeps every placeholder the source message declares", () => {
      const drifted: string[] = [];
      for (const [key, value] of source) {
        const want = placeholders(parse(value));
        const got = placeholders(parse(target.get(key) ?? ""));
        const missing = [...want].filter((p) => !got.has(p));
        const extra = [...got].filter((p) => !want.has(p));
        if (missing.length || extra.length) {
          drifted.push(`${key}: missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)}`);
        }
      }
      expect(drifted).toEqual([]);
    });
  });
});
