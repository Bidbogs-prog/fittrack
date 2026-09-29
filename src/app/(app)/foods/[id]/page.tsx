import { CaretLeft, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FoodImage } from "@/components/food-image";
import { requireUser } from "@/lib/auth";
import { foodSourceLabel } from "@/lib/foods";
import type { Food } from "@/lib/types";
import { Portion } from "./portion";

export const metadata = { title: "Food" };

export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ supabase, userId }, { id }, t] = await Promise.all([
    requireUser(),
    params,
    getTranslations("foods"),
  ]);

  // RLS scopes visibility: someone else's private food simply isn't found.
  const { data } = await supabase.from("foods").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const food = data as Food;

  return (
    <div className="flex flex-col gap-3.5 lg:gap-4">
      <Link href="/foods" className="inline-flex min-h-9 items-center gap-1 self-start text-sm text-paper-mute hover:text-paper">
        <CaretLeft weight="bold" className="size-3.5 rtl:-scale-x-100" />
        {t("title")}
      </Link>

      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-[22px]">
        <FoodImage
          src={food.image_url}
          alt={food.name}
          className="h-[150px] w-full rounded-[20px] lg:h-[170px] lg:w-[220px] lg:rounded-[22px]"
        />
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium tracking-[0.1em] text-paper-mute uppercase lg:text-[11px]">
            {t(`cat.${food.category}`)} · {foodSourceLabel(food)}
            <span className="max-lg:hidden"> · {Math.round(food.kcal)} kcal / 100 g</span>
          </p>
          <h1 dir="auto" className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-paper lg:text-[40px] lg:leading-[1.05] lg:tracking-[-0.035em]">
            {food.name}
          </h1>
          {food.brand && <p className="mt-0.5 text-sm text-paper-mute">{food.brand}</p>}
          {food.owner_id === userId && (
            <Link
              href={`/foods/${food.id}/edit`}
              className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 text-xs text-paper-mute hover:text-flame"
            >
              <PencilSimple className="size-3.5" />
              {t("edit")}
            </Link>
          )}
        </div>
      </header>

      <Portion food={food} />

      {food.source === "off" && (
        <p className="text-xs text-paper-mute">
          {t.rich("offRow", {
            off: (c) => (
              <a
                href="https://world.openfoodfacts.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-paper"
              >
                {c}
              </a>
            ),
          })}
        </p>
      )}
    </div>
  );
}
