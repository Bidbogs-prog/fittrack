"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALES, LOCALE_COOKIE } from "@/i18n/request";

/**
 * Language switch for signed-out pages (landing, auth). Cookie only — no
 * account needed; /account has the signed-in equivalent.
 */
export async function setLocalePublic(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  const back = String(formData.get("back") ?? "/");
  const target = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  if ((LOCALES as readonly string[]).includes(locale)) {
    const store = await cookies();
    store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/", "layout");
  }
  redirect(target);
}
