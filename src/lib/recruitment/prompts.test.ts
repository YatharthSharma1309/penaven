import { describe, expect, it } from "vitest";
import { parseJobAssistResult } from "@/lib/recruitment/prompts";

const base = {
  description: "Lead a small support team and improve response times.",
  requiredSkills: ["Zendesk"],
  preferredSkills: ["SQL"],
  experienceLevel: "Senior",
  minYearsExperience: 5,
  educationRequirements: [],
  certifications: [],
  roleType: "Full-time",
};

describe("parseJobAssistResult", () => {
  it("treats null lists as empty", () => {
    const result = parseJobAssistResult(
      JSON.stringify({ ...base, educationRequirements: null, certifications: null, preferredSkills: null }),
    );

    expect(result.educationRequirements).toEqual([]);
    expect(result.certifications).toEqual([]);
    expect(result.preferredSkills).toEqual([]);
  });

  it("shortens skills that run past the limit", () => {
    const result = parseJobAssistResult(
      JSON.stringify({ ...base, requiredSkills: ["x".repeat(200)] }),
    );

    expect(result.requiredSkills[0]).toHaveLength(80);
  });

  it("drops blank list items and caps a list at 40", () => {
    const result = parseJobAssistResult(
      JSON.stringify({
        ...base,
        preferredSkills: ["  ", null, ...Array.from({ length: 50 }, (_, i) => `Skill ${i}`)],
      }),
    );

    expect(result.preferredSkills).toHaveLength(40);
    expect(result.preferredSkills[0]).toBe("Skill 0");
  });

  it("keeps null for unknown experience and role type", () => {
    const result = parseJobAssistResult(
      JSON.stringify({ ...base, experienceLevel: null, roleType: null, minYearsExperience: null }),
    );

    expect(result.experienceLevel).toBeNull();
    expect(result.roleType).toBeNull();
    expect(result.minYearsExperience).toBeNull();
  });

  it("still rejects a result with no required skills", () => {
    expect(() =>
      parseJobAssistResult(JSON.stringify({ ...base, requiredSkills: null })),
    ).toThrow();
  });
});
