import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A server component that imports a plain function from a "use client"
 * module gets a client reference, not the function — calling it throws at
 * render time ("something broke" in production). Components are fine to
 * import (they render); helpers must live in a module without the
 * directive. This catches `helper(...)` calls on such imports.
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

const isClient = (file: string) => /^\s*["']use client["']/.test(readFileSync(file, "utf8"));

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? join(dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

describe("client boundary", () => {
  it("server modules never call functions imported from client modules", () => {
    const problems: string[] = [];
    for (const file of walk(SRC)) {
      if (isClient(file)) continue;
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/import\s+(?!type\b)\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
        const target = resolve(file, m[2]);
        if (!target || !isClient(target)) continue;
        for (const raw of m[1].split(",")) {
          const name = raw.trim();
          if (!name || name.startsWith("type ")) continue;
          const local = name.split(/\s+as\s+/).pop()!;
          // Lower-case bindings are helpers (components are PascalCase).
          if (/^[a-z]/.test(local) && new RegExp(`\\b${local}\\s*\\(`).test(source)) {
            problems.push(`${file.slice(SRC.length + 1)} calls ${local}() from ${target.slice(SRC.length + 1)}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
