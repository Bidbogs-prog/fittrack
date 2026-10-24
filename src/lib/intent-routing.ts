/**
 * Composer routing (Today): obvious questions skip meal parsing and go
 * straight to the coach; diary edit requests never do, even when phrased
 * as questions. Everything else goes to the AI parser, which can still hand
 * off to the coach (intent "chat"). Pure so it can be tested in isolation.
 */
const QUESTION_PREFIXES = [
  "why", "how", "what", "should", "can", "could", "is ", "am i", "do ", "does", "when", "which",
  "any ", "ideas", "suggest", "pourquoi", "comment", "quoi", "que ", "quel", "est-ce", "combien",
  "dois", "peux", "idée", "علاش", "كيفاش", "واش", "شنو", "اشنو", "هل", "لماذا", "كيف", "ماذا", "ما ",
];

/** Diary verbs: "can you remove the rice?" is a request, not a question for the coach. */
const DIARY_VERBS = new RegExp(
  "(?<![a-z])(" +
    [
      // English, with common inflections ("address" must not match "add").
      "add(?:s|ed|ing)?", "log(?:s|ged|ging)?", "remov(?:e|es|ed|ing)", "delet(?:e|es|ed|ing)", "undo",
      "chang(?:e|es|ed|ing)", "mov(?:e|es|ed|ing)", "replac(?:e|es|ed|ing)", "swap(?:s|ped|ping)?",
      "edit(?:s|ed|ing)?", "updat(?:e|es|ed|ing)",
      // French: present, infinitive, imperative, past participle (DR-009).
      "ajout(?:e|es|er|ez|é|ée)?", "enl[eè]v(?:e|es|er|ez|é)", "supprim(?:e|es|er|ez|é|ée)",
      "retir(?:e|es|er|ez|é)", "modifi(?:e|es|er|ez|é)", "d[ée]plac(?:e|es|er|ez|é)",
      "rempla(?:ce|ces|cer|cez|cé)", "chang(?:er|ez|é)",
      // Darija in Latin script.
      "zid", "7yed", "7yd", "bddel", "bdl",
    ].join("|") +
    ")(?![a-zà-ÿ])|احذف|امسح|حيد|زيد|بدل|غيّر|أضف"
);

/** Rough intent split for the composer: questions go to the coach. */
export function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (DIARY_VERBS.test(t)) return false;
  if (/[?؟]\s*$/.test(t)) return true;
  return QUESTION_PREFIXES.some((p) => t.startsWith(p));
}
