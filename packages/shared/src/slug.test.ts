import { expect, it } from "vitest";
import { slugify } from "./slug";

it("slugifies names", () => {
  expect(slugify("  Acme Labs São Paulo! ")).toBe("acme-labs-sao-paulo");
});
