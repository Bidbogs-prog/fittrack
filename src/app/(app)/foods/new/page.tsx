import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireUser } from "@/lib/auth";
import { createUserFood } from "../actions";
import { UserFoodForm } from "../user-food-form";

export const metadata = { title: "New food" };

export default async function NewFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; name?: string; barcode?: string; from?: string }>;
}) {
  const [{ supabase, userId }, params, t] = await Promise.all([requireUser(), searchParams, getTranslations("foodForm")]);
  const admin = await isAdmin(supabase, userId);
  const fromScan = params.from === "scan";

  return (
    <div className="space-y-7">
      <header>
        <Link
          href="/foods"
          className="text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
        >
          {t("back")}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          {fromScan ? t("titleScan") : admin ? t("titleAdmin") : t("titleUser")}
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-paper-dim">
          {admin ? t("introAdmin") : t("introUser")} {t("introPer100")}
        </p>
      </header>

      <UserFoodForm
        action={createUserFood}
        error={params.error}
        defaults={{ name: params.name, barcode: params.barcode }}
        from={fromScan ? "scan" : undefined}
      />
    </div>
  );
}
