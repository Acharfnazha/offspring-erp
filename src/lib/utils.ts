import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .split("_")
    .map((w) => (w === "i" || w === "ii" ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}
