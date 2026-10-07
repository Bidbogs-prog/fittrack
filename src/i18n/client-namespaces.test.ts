import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Client components only receive the namespaces listed in CLIENT_NAMESPACES
 * (src/app/layout.tsx). A missing one renders raw keys ("consent.accept")
 * in production, so every useTranslations("ns") in a "use client" file must
 * be listed.
 */
const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

describe("client message namespaces", () => {
  it("ships every namespace a client component reads", () => {
    const layout = readFileSync(join(SRC, "app/layout.tsx"), "utf8");
    const listed = new Set(
      [...(layout.match(/CLIENT_NAMESPACES = \[([\s\S]*?)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1])
    );
    const missing: string[] = [];
    for (const file of walk(SRC)) {
      const source = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(source)) continue;
      for (const m of source.matchAll(/useTranslations\("([^"]+)"\)/g)) {
        const ns = m[1].split(".")[0];
        if (!listed.has(ns)) missing.push(`${ns}  (${file.slice(SRC.length + 1)})`);
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
