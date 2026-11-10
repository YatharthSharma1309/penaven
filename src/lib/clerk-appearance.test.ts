import { describe, expect, it } from "vitest";
import { clerkAppearance } from "./clerk-appearance";

describe("clerkAppearance", () => {
  it("uses Clerk 7 colour variables, not the removed colorText", () => {
    expect(clerkAppearance.variables).not.toHaveProperty("colorText");
    expect(clerkAppearance.variables).toMatchObject({
      colorForeground: "#0f172a",
      colorMutedForeground: "#475569",
      colorBackground: "#ffffff",
      colorInput: "#ffffff",
      colorInputForeground: "#0f172a",
      colorPrimaryForeground: "#ffffff",
    });
  });

  it("keeps the card on a light colour scheme in the dark site theme", () => {
    expect(clerkAppearance.elements.rootBox).toContain("[color-scheme:light]");
    expect(clerkAppearance.elements.cardBox).toContain("[color-scheme:light]");
  });
});
