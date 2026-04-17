import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";

import { Label } from "@/components/ui/label";

test("Label renders as a label element and forwards children", () => {
  render(<Label htmlFor="email">Email</Label>);

  const label = screen.getByText("Email");
  expect(label.tagName).toBe("LABEL");
  expect(label.getAttribute("for")).toBe("email");
});

test("Label merges custom class names without dropping defaults", () => {
  render(<Label className="custom">Styled</Label>);

  const label = screen.getByText("Styled");
  expect(label.className).toContain("custom");
  expect(label.className).toContain("text-sm");
});

test("Label forwards refs to the underlying element", () => {
  const ref = createRef<HTMLLabelElement>();
  render(<Label ref={ref}>Name</Label>);

  expect(ref.current?.tagName).toBe("LABEL");
});
