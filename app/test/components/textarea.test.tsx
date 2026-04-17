import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";

import { Textarea } from "@/components/ui/textarea";

test("Textarea renders a textarea element", () => {
  render(<Textarea placeholder="Notes" />);

  const textarea = screen.getByPlaceholderText("Notes");
  expect(textarea.tagName).toBe("TEXTAREA");
});

test("Textarea merges custom class names with the base classes", () => {
  render(<Textarea className="custom-class" placeholder="Agenda" />);

  const textarea = screen.getByPlaceholderText("Agenda");
  expect(textarea.className).toContain("custom-class");
  expect(textarea.className).toContain("min-h-20");
});

test("Textarea forwards refs to the underlying element", () => {
  const ref = createRef<HTMLTextAreaElement>();
  render(<Textarea ref={ref} aria-label="Meeting notes" />);

  expect(ref.current).not.toBeNull();
  expect(ref.current?.tagName).toBe("TEXTAREA");
});
