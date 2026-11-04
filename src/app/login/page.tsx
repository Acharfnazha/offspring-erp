import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/server";
import { AuthFrame } from "@/components/layout/auth-frame";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { dict } = await getDictionary();
  const { next } = await searchParams;
  return (
    <AuthFrame tagline={dict.auth.tagline}>
      <LoginForm next={next} labels={dict.auth} />
    </AuthFrame>
  );
}
