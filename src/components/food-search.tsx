"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

export function FoodSearch({
  initialQuery,
  category,
  mine = false,
  placeholder,
  trailing,
}: {
  initialQuery: string;
  category: string | null;
  mine?: boolean;
  placeholder?: string;
  /** Right-hand slot inside the box (scan button, shortcut hint). */
  trailing?: React.ReactNode;
}) {
  const t = useTranslations("addFood");
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  // ⌘K / Ctrl+K jumps to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function navigate(q: string) {
    const params = new URLSearchParams();
    if (mine) params.set("mine", "1");
    if (category) params.set("c", category);
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex min-h-12 flex-1 items-center gap-2.5 rounded-[14px] border border-ink-700 bg-ink-900 ps-3.5 pe-2 focus-within:border-flame/50">
      <MagnifyingGlass className="size-4 shrink-0 text-paper-mute" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => navigate(next), 300);
        }}
        placeholder={placeholder ?? t("searchByNameOrBrand")}
        aria-label={t("searchFoods")}
        className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-paper outline-none placeholder:text-paper-mute pointer-fine:text-sm"
      />
      {trailing}
    </div>
  );
}
