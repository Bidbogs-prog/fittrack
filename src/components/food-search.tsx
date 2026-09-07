"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

export function FoodSearch({
  initialQuery,
  category,
  mine = false,
}: {
  initialQuery: string;
  category: string | null;
  mine?: boolean;
}) {
  const t = useTranslations("addFood");
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
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
    <div className="relative max-w-md lg:max-w-lg">
      <MagnifyingGlass className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-paper-mute" />
      <input
        type="search"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => navigate(next), 300);
        }}
        placeholder={t("searchByNameOrBrand")}
        aria-label={t("searchFoods")}
        className="field ps-10"
      />
    </div>
  );
}
