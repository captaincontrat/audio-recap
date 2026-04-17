import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";

import { Input } from "@/components/ui/input";

test("Input renders an input element with the default type", () => {
  render(<Input placeholder="Email" />);

  const input = screen.getByPlaceholderText("Email");
  expect(input.tagName).toBe("INPUT");
  expect(input.getAttribute("type")).toBe("text");
});

test("Input forwards the type prop and custom class names", () => {
  render(<Input type="password" className="custom-class" placeholder="Password" />);

  const input = screen.getByPlaceholderText("Password");
  expect(input.getAttribute("type")).toBe("password");
  expect(input.className).toContain("custom-class");
});

test("Input forwards refs to the underlying element", () => {
  const ref = createRef<HTMLInputElement>();
  render(<Input ref={ref} aria-label="Name" />);

  expect(ref.current).not.toBeNull();
  expect(ref.current?.tagName).toBe("INPUT");
});
