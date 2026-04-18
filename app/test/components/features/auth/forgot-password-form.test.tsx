import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { LocaleProvider } from "@/lib/i18n/provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("ForgotPasswordForm localization", () => {
  test.each(["en", "fr", "de", "es"] as const)("renders labels and submit in %s", (locale) => {
    render(
      <LocaleProvider locale={locale}>
        <ForgotPasswordForm />
      </LocaleProvider>,
    );

    const dict = DICTIONARIES[locale];
    expect(screen.getByLabelText(dict["common.email.label"])).toBeDefined();
    expect(screen.getByRole("button", { name: dict["auth.forgotPassword.submit"] })).toBeDefined();
  });
});
