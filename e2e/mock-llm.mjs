// Deterministic stand-in for the OpenAI-compatible LLM Gateway, for system
// tests. Answers by request shape: JSON-schema requests (meal parser, day
// read) get canned JSON; streaming chat requests (coach) get SSE chunks.
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 3199);
const usage = { prompt_tokens: 100, completion_tokens: 20, cost: 0 };

function parserReply(prompt) {
  const description = (prompt.match(/MEAL DESCRIPTION\n([^\n]*)/) ?? [])[1]?.toLowerCase() ?? "";
  if (/\b(remove|delete)\b/.test(description)) {
    const target = description.replace(/.*\b(remove|delete)\b\s+(the\s+)?/, "").trim();
    const line = prompt.split("\n").find((l) => /^E\d+:/.test(l) && l.toLowerCase().includes(target));
    const ref = line?.split(":")[0];
    return { intent: "edit", items: [], refs: [], edits: ref ? [{ ref, action: "delete" }] : [] };
  }
  if (description.includes("?") || description.startsWith("i feel")) return { intent: "chat", items: [], refs: [] };
  return {
    intent: "log",
    refs: [],
    items: [
      { name: "Eggs", portion: "2 large", grams: 100, kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5, fibre_g: 0, search_query: "zzz-no-match" },
      { name: "Toast", portion: "1 slice", grams: 30, kcal: 80, protein_g: 2.7, carbs_g: 14, fat_g: 1, fibre_g: 1.2, search_query: "zzz-no-match" },
    ],
  };
}

function jsonFor(system, prompt) {
  if (system.includes("meal-parsing engine")) return parserReply(prompt);
  if (system.includes("quick read of one diary day")) {
    return { summary: "Solid start: protein is on track.", insights: [{ kind: "win", tag: "Protein", text: "Good protein at breakfast." }] };
  }
  if (system.includes("long-term memory")) return { add: [], remove: [] };
  return {};
}

createServer((req, res) => {
  if (req.method === "GET" && req.url?.endsWith("/models")) {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [] }));
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const r = JSON.parse(body || "{}");
    const system = r.messages?.find((m) => m.role === "system")?.content ?? "";
    const last = r.messages?.at(-1)?.content;
    const prompt = typeof last === "string" ? last : (last ?? []).map((p) => p.text ?? "").join("\n");
    if (r.stream) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      for (const text of ["Mock coach: ", "aim for ", "**150 g protein** today."]) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage })}\n\n`);
      res.end("data: [DONE]\n\n");
      return;
    }
    const content = r.response_format ? JSON.stringify(jsonFor(system, prompt)) : "Mock summary.";
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }], usage })
    );
  });
}).listen(port, () => console.log(`mock LLM on :${port}`));
