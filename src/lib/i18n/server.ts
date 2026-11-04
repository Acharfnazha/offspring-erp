import "server-only";
import { cookies } from "next/headers";
import { dictionaries, isLocale, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "ofs_locale";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "en";
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, dict: dictionaries[locale], dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const) };
}
