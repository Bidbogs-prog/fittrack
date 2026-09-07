import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE } from "./request";

/**
 * Every `t("key")` in the source must resolve to a real message.
 *
 * next-intl reports a missing key at render time, not build time — the
 * reader sees the key path where the copy should be. This walks the AST,
 * resolves each `useTranslations`/`getTranslations` binding to its
 * namespace, and checks the keys those bindings are called with.
 *
 * Dynamic keys (`t(`${key}Detail`)`) can't be resolved here; the enum
 * lookups in messages.test.ts cover those.
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

function flatten(messages: Record<string, unknown>, prefix = "", out = new Set<string>()): Set<string> {
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.add(path);
    else if (value && typeof value === "object") flatten(value as Record<string, unknown>, path, out);
  }
  return out;
}

const known = flatten(
  JSON.parse(readFileSync(join(process.cwd(), "messages", `${DEFAULT_LOCALE}.json`), "utf8"))
);

/** Keys referenced in code, as `namespace.key`, with the file that used them. */
function collectUsages(): { key: string; file: string }[] {
  const usages: { key: string; file: string }[] = [];

  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("seTranslations(") && !source.includes("etTranslations(")) continue;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    // (enclosing function, binding name) -> namespace ("" = no namespace).
    // Scope matters: a page's `generateMetadata` and its component body both
    // declare `t`, against different namespaces.
    const namespaces = new Map<ts.Node, Map<string, string>>();
    const scopeOf = (node: ts.Node): ts.Node => {
      let n: ts.Node | undefined = node.parent;
      while (n && !ts.isFunctionDeclaration(n) && !ts.isFunctionExpression(n) && !ts.isArrowFunction(n) && !ts.isMethodDeclaration(n)) {
        n = n.parent;
      }
      return n ?? sf;
    };
    const declare = (node: ts.Node, name: string, ns: string) => {
      const scope = scopeOf(node);
      if (!namespaces.has(scope)) namespaces.set(scope, new Map());
      namespaces.get(scope)!.set(name, ns);
    };
    const nsOfCall = (expr: ts.Node): string | undefined => {
      let call: ts.Node = expr;
      if (ts.isAwaitExpression(call)) call = call.expression;
      if (
        ts.isCallExpression(call) &&
        ts.isIdentifier(call.expression) &&
        /^(useTranslations|getTranslations)$/.test(call.expression.text)
      ) {
        const arg = call.arguments[0];
        return arg && ts.isStringLiteral(arg) ? arg.text : "";
      }
      return undefined;
    };

    const bind = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        // const t = useTranslations("ns")
        if (ts.isIdentifier(node.name)) {
          const ns = nsOfCall(node.initializer);
          if (ns !== undefined) declare(node, node.name.text, ns);
        }
        // const [a, t] = await Promise.all([..., getTranslations("ns")])
        if (ts.isArrayBindingPattern(node.name)) {
          let init: ts.Node = node.initializer;
          if (ts.isAwaitExpression(init)) init = init.expression;
          if (
            ts.isCallExpression(init) &&
            ts.isPropertyAccessExpression(init.expression) &&
            init.expression.name.text === "all" &&
            init.arguments[0] &&
            ts.isArrayLiteralExpression(init.arguments[0])
          ) {
            const items = (init.arguments[0] as ts.ArrayLiteralExpression).elements;
            node.name.elements.forEach((element, i) => {
              if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) return;
              const ns = items[i] ? nsOfCall(items[i]) : undefined;
              if (ns !== undefined) declare(node, element.name.text, ns);
            });
          }
        }
      }
      ts.forEachChild(node, bind);
    };
    bind(sf);
    if (!namespaces.size) continue;

    /** Nearest enclosing scope that bound this name. */
    const lookup = (node: ts.Node, name: string): string | undefined => {
      let n: ts.Node | undefined = node;
      while (n) {
        const found = namespaces.get(n)?.get(name);
        if (found !== undefined) return found;
        n = n.parent;
      }
      return namespaces.get(sf)?.get(name);
    };

    const read = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        // t("key") and t.rich("key") / t.markup("key")
        let name: string | undefined;
        if (ts.isIdentifier(node.expression)) name = node.expression.text;
        else if (
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          /^(rich|markup|raw|has)$/.test(node.expression.name.text)
        ) {
          name = node.expression.expression.text;
        }
        const arg = node.arguments[0];
        if (name && arg && ts.isStringLiteral(arg)) {
          const ns = lookup(node, name);
          if (ns !== undefined) usages.push({ key: ns ? `${ns}.${arg.text}` : arg.text, file });
        }
      }
      ts.forEachChild(node, read);
    };
    read(sf);
  }
  return usages;
}

const usages = collectUsages();

describe("message usage", () => {
  it("finds translation calls to check", () => {
    expect(usages.length).toBeGreaterThan(50);
  });

  it("references only keys that exist", () => {
    const missing = usages
      .filter((u) => !known.has(u.key))
      .map((u) => `${u.key}  (${u.file.replace(process.cwd(), "").replace(/\\/g, "/")})`);
    expect([...new Set(missing)]).toEqual([]);
  });
});
