import { describe, expect, it } from "vitest";
import { roles } from "./permissions";

describe("org roles", () => {
  it("only owner can delete the organization", () => {
    expect(roles.owner.authorize({ organization: ["delete"] }).success).toBe(true);
    expect(roles.admin.authorize({ organization: ["delete"] }).success).toBe(false);
  });

  it("developer manages platform resources but not members", () => {
    expect(roles.developer.authorize({ apiKey: ["create"], contract: ["deploy"] }).success).toBe(true);
    expect(roles.developer.authorize({ member: ["create"] }).success).toBe(false);
  });

  it("viewer is read-only", () => {
    expect(roles.viewer.authorize({ project: ["read"] }).success).toBe(true);
    expect(roles.viewer.authorize({ project: ["create"] }).success).toBe(false);
  });

  it("only owner can change billing", () => {
    expect(roles.owner.authorize({ billing: ["update"] }).success).toBe(true);
    expect(roles.admin.authorize({ billing: ["update"] }).success).toBe(false);
  });
});
