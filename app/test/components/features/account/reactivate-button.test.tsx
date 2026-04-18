import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ReactivateButton } from "@/components/features/account/reactivate-button";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { LocaleProvider } from "@/lib/i18n/provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("ReactivateButton localization", () => {
  test.each(["en", "fr", "de", "es"] as const)("renders its label in %s", (locale) => {
    render(
      <LocaleProvider locale={locale}>
        <ReactivateButton />
      </LocaleProvider>,
    );

    expect(screen.getByRole("button", { name: DICTIONARIES[locale]["chrome.reactivateButton.submit"] })).toBeDefined();
  });
});
