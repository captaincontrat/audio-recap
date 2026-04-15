import { expect, test } from "vitest";

import { cn } from "@/lib/utils";

test("cn merges conflicting Tailwind classes", () => {
  expect(cn("px-2", "text-sm", "px-4")).toBe("text-sm px-4");
});
