"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";

export function FaqItems({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="border-b border-ink-800">
      {items.map(({ q, a }, i) => {
        const on = open === i;
        return (
          <div key={q} className="border-t border-ink-800">
            <h3>
              <button
                type="button"
                id={`faq-q-${i}`}
                aria-expanded={on}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpen(on ? -1 : i)}
                className="flex min-h-14 w-full items-center justify-between gap-4 py-[18px] text-start font-display text-[17px] font-medium text-paper"
              >
                {q}
                <Plus
                  weight="bold"
                  aria-hidden
                  className={`size-4 shrink-0 text-flame transition-transform duration-300 ${on ? "rotate-45" : ""}`}
                />
              </button>
            </h3>
            <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="collapse-rows" data-open={on}>
              <div>
                <p className="max-w-[64ch] pb-[18px] text-[15px] leading-relaxed text-paper-dim">{a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
