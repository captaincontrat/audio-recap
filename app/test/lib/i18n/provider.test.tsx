import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { LocaleProvider, useLocale, useTranslator } from "@/lib/i18n/provider";

function Greeter() {
  const translate = useTranslator();
  const locale = useLocale();
  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="heading">{translate("auth.signIn.heading")}</p>
      <p data-testid="welcome">{translate("chrome.dashboard.welcome", { name: "Alex" })}</p>
    </div>
  );
}

describe("LocaleProvider", () => {
  test.each(["en", "fr", "de", "es"] as const)("renders translations in %s", (locale) => {
    render(
      <LocaleProvider locale={locale}>
        <Greeter />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("locale").textContent).toBe(locale);
    expect(screen.getByTestId("heading").textContent).toBe(DICTIONARIES[locale]["auth.signIn.heading"]);
    expect(screen.getByTestId("welcome").textContent).toBe(DICTIONARIES[locale]["chrome.dashboard.welcome"].replace("{{name}}", "Alex"));
  });

  test("without a provider the default locale is English", () => {
    render(<Greeter />);

    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("heading").textContent).toBe(DICTIONARIES.en["auth.signIn.heading"]);
  });
});
