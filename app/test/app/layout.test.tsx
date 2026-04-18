import { expect, test, vi } from "vitest";

vi.mock("next/font/google", () => {
  function mockFont({ variable }: { variable: string }) {
    return { variable };
  }

  return {
    Geist: mockFont,
    Geist_Mono: mockFont,
    Merriweather: mockFont,
  };
});

vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: vi.fn(async () => ({ locale: "en", source: "default" })),
}));

import RootLayout from "@/app/layout";

test("RootLayout configures the document shell", async () => {
  const child = <span id="child">Child</span>;
  const html = await RootLayout({ children: child });

  expect(html.type).toBe("html");
  expect(html.props.lang).toBe("en");
  expect(html.props.suppressHydrationWarning).toBe(true);
  expect(html.props.className).toContain("antialiased");
  expect(html.props.className).toContain("--font-sans");
  expect(html.props.className).toContain("--font-mono");
  expect(html.props.className).toContain("--font-serif");

  const body = html.props.children;
  const themeProvider = body.props.children;
  const localeProvider = themeProvider.props.children;

  expect(body.type).toBe("body");
  expect(localeProvider.props.locale).toBe("en");
  expect(localeProvider.props.children).toBe(child);
});
