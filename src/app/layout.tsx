import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { getDictionary } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OFFSPRING ERP", template: "%s · OFFSPRING ERP" },
  description: "Enterprise resource planning for Offspring Group S.A.R.L. — fruit export, cold storage and logistics.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6faf7" }, { media: "(prefers-color-scheme: dark)", color: "#0b1411" }] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getDictionary();
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position={dir === "rtl" ? "bottom-left" : "bottom-right"} closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
