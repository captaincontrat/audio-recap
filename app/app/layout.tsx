import { Geist, Geist_Mono, Merriweather } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/lib/i18n/provider";
import { getServerLocale } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

const merriweather = Merriweather({ subsets: ["latin"], variable: "--font-serif" });

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale } = await getServerLocale();
  return (
    <html lang={locale} suppressHydrationWarning className={cn("antialiased", fontSans.variable, fontMono.variable, "font-serif", merriweather.variable)}>
      <body>
        <ThemeProvider>
          <LocaleProvider locale={locale}>{children}</LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
