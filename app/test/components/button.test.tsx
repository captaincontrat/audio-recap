import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button, buttonVariants } from "@/components/ui/button";

test("Button renders a button element by default", () => {
  render(<Button>Click me</Button>);

  const button = screen.getByRole("button", { name: "Click me" });

  expect(button.getAttribute("data-slot")).toBe("button");
  expect(button.getAttribute("data-variant")).toBe("default");
  expect(button.getAttribute("data-size")).toBe("default");
});

test("Button can render as its child element", () => {
  render(
    <Button asChild variant="link" size="sm">
      <a href="/docs">Docs</a>
    </Button>,
  );

  const link = screen.getByRole("link", { name: "Docs" });

  expect(link.tagName).toBe("A");
  expect(link.getAttribute("href")).toBe("/docs");
  expect(link.getAttribute("data-variant")).toBe("link");
  expect(link.getAttribute("data-size")).toBe("sm");
});

test("buttonVariants includes variant, size, and custom classes", () => {
  const className = buttonVariants({
    variant: "outline",
    size: "lg",
    className: "custom-class",
  });

  expect(className).toContain("border-border");
  expect(className).toContain("h-8");
  expect(className).toContain("custom-class");
});
