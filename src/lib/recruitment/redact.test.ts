import { describe, expect, it } from "vitest";
import { nameTokens, redactForScreening } from "@/lib/recruitment/redact";

describe("redactForScreening: contact details", () => {
  it.each([
    ["jane.doe@example.com"],
    ["j_doe+jobs@mail.co.in"],
    ["JANE@EXAMPLE.ORG"],
  ])("removes the email %s", (email) => {
    const out = redactForScreening(`Contact: ${email}`);
    expect(out).toBe("Contact: [email]");
  });

  it.each([
    ["+91 98765 43210"],
    ["+91-9876543210"],
    ["09876543210"],
    ["9876543210"],
    ["98765-43210"],
    ["0091 98765 43210"],
    ["080 2345 6789"],
    ["+1 (555) 123-4567"],
    ["(555) 123-4567"],
    ["555.123.4567"],
    ["+44 20 7946 0958"],
    ["+49 30 123456"],
  ])("removes the phone number %s", (phone) => {
    expect(redactForScreening(`Phone: ${phone}`)).toBe("Phone: [phone]");
  });

  it("removes a phone and email on one contact line", () => {
    expect(redactForScreening("jane@x.io | +91 98765 43210 | Bengaluru")).toBe(
      "[email] | [phone] | Bengaluru",
    );
  });

  it.each([
    ["https://www.linkedin.com/in/jane-doe-123/"],
    ["http://janedoe.dev/projects"],
    ["www.janedoe.com"],
    ["linkedin.com/in/jane-doe"],
    ["github.com/janedoe"],
    ["janedoe.github.io"],
  ])("removes the link %s", (link) => {
    expect(redactForScreening(`Profile: ${link}`)).toBe("Profile: [link]");
  });

  it("keeps sentence punctuation after a link", () => {
    expect(redactForScreening("See github.com/janedoe/app.")).toBe("See [link].");
  });

  it.each([
    ["GitHub: janedoe", "GitHub: [link]"],
    ["LinkedIn - jane-doe-123", "LinkedIn - [link]"],
    ["Portfolio: janedoe.dev", "Portfolio: [link]"],
    ["GitHub: @janedoe", "GitHub: [link]"],
  ])("removes the labelled handle in %s", (input, expected) => {
    expect(redactForScreening(input)).toBe(expected);
  });
});

describe("redactForScreening: the candidate's name", () => {
  it("removes each name token, whole-word and case-insensitive", () => {
    const out = redactForScreening(
      "PRIYA NAIR\nPriya led the migration. Ms. Nair's team shipped it.",
      "Priya Nair",
    );
    expect(out).toBe("[name]\n[name] led the migration. Ms. [name] team shipped it.");
  });

  it("does not remove a token inside another word", () => {
    expect(redactForScreening("Worked with Annex teams on Sanjose data", "Ann San")).toBe(
      "Worked with Annex teams on Sanjose data",
    );
  });

  it("ignores tokens under two characters", () => {
    expect(nameTokens("J. R. Tolkien")).toEqual(["Tolkien"]);
    expect(redactForScreening("J. R. built a parser in C", "J R")).toBe(
      "J. R. built a parser in C",
    );
  });

  it("ignores words a file name adds", () => {
    expect(nameTokens("Resume Final Rahul Verma")).toEqual(["Rahul", "Verma"]);
    expect(nameTokens("Candidate")).toEqual([]);
  });

  it("handles hyphenated and accented names", () => {
    const out = redactForScreening("Anne-Marie Lévesque. Anne Marie led QA.", "Anne-Marie Lévesque");
    expect(out).toBe("[name]. [name] led QA.");
  });

  it("keeps a name token that is also a job skill when told to", () => {
    const out = redactForScreening("Ruby Patel\n5 years of Ruby on Rails", "Ruby Patel", {
      keepTerms: ["Ruby", "PostgreSQL"],
    });
    expect(out).toBe("Ruby [name]\n5 years of Ruby on Rails");
  });

  it("works without a display name", () => {
    expect(redactForScreening("Built APIs in Go", undefined)).toBe("Built APIs in Go");
    expect(redactForScreening("Built APIs in Go", null)).toBe("Built APIs in Go");
  });
});

describe("redactForScreening: labelled personal details", () => {
  it.each([
    "Date of Birth: 12/05/1996",
    "Date of birth 12 May, 1996",
    "DOB: 1996-05-12",
    "D.O.B.: 12-05-1996",
    "Age: 28",
    "Age - 28",
    "Gender: Female",
    "Sex: M",
    "Marital Status: Married",
    "Nationality: Indian",
    "Religion: Hindu",
    "Caste: General",
    "Father's Name: Ramesh Kumar",
    "Father Name - Ramesh Kumar",
  ])("removes %s", (line) => {
    expect(redactForScreening(`Personal\n${line}\nSkills: SQL`)).toBe(
      "Personal\n[personal detail removed]\nSkills: SQL",
    );
  });

  it("removes several fields on one line and keeps the rest", () => {
    expect(
      redactForScreening("Location: Pune | DOB: 01/01/1995 | Gender: Male | Languages: Hindi"),
    ).toBe("Location: Pune | [personal detail removed] | [personal detail removed] | Languages: Hindi");
  });

  it("splits comma-separated fields", () => {
    expect(redactForScreening("Age: 30, Marital status: Single")).toBe(
      "[personal detail removed], [personal detail removed]",
    );
  });

  it("does not touch the same words in work evidence", () => {
    const text = [
      "Led a gender diversity hiring programme.",
      "Reduced page usage: 40% less memory.",
      "Built an age-verification flow for the onboarding team.",
    ].join("\n");
    expect(redactForScreening(text)).toBe(text);
  });

  it.each([
    ["[Photo]"],
    ["Photograph"],
    ["Passport size photo attached"],
    ["(profile picture)"],
  ])("removes the photo reference %s", (line) => {
    expect(redactForScreening(`${line}\nExperience`)).toBe("[photo removed]\nExperience");
  });

  it("removes an embedded image file name", () => {
    expect(redactForScreening("Image: jane_headshot.jpg")).toBe("Image: [photo removed]");
  });

  it("keeps photography and photo editing as skills", () => {
    const text = "Hobbies: Photography\nSkills: Photo editing, Lightroom";
    expect(redactForScreening(text)).toBe(text);
  });
});

describe("redactForScreening: work evidence survives", () => {
  it.each([
    ["C++, C#, Node.js, Next.js, ASP.NET, .NET 8, Vue.js"],
    ["5 years of experience with React"],
    ["10+ years in backend engineering"],
    ["Acme Corp, 2019–2023"],
    ["Acme Corp, 2019-2023"],
    ["Jan 2019 - Mar 2023"],
    ["2015 - 2019 2019 - 2023"],
    ["2013 - 2023 (10 years)"],
    ["Graduated 05/2018, CGPA 8.52/10"],
    ["Served 1,20,000 users and cut p95 latency to 120 ms"],
    ["Python 3.11, Java 17, PostgreSQL 15"],
    ["01-02-2020 to 03-04-2021"],
    ["Configured hosts 192.168.10.100 and 10.0.0.1"],
    ["Bengaluru 560001"],
    ["ISO 27001, SOC 2 Type II"],
  ])("keeps %s", (text) => {
    expect(redactForScreening(text, "Jane Doe")).toBe(text);
  });

  it("redacts a realistic header and keeps the body", () => {
    const resume = [
      "Rahul Verma",
      "rahul.verma@gmail.com | +91 98765 43210 | linkedin.com/in/rahulverma",
      "DOB: 14/03/1994 | Gender: Male | Marital Status: Single",
      "",
      "Experience",
      "Senior Engineer, Flipkart (2019–2023)",
      "- Built Node.js services in TypeScript; 5 years with C++.",
      "- Rahul mentored four engineers.",
    ].join("\n");

    expect(redactForScreening(resume, "Rahul Verma")).toBe(
      [
        "[name]",
        "[email] | [phone] | [link]",
        "[personal detail removed] | [personal detail removed] | [personal detail removed]",
        "",
        "Experience",
        "Senior Engineer, Flipkart (2019–2023)",
        "- Built Node.js services in TypeScript; 5 years with C++.",
        "- [name] mentored four engineers.",
      ].join("\n"),
    );
  });

  it("keeps CRLF line endings", () => {
    expect(redactForScreening("Jane Doe\r\nDOB: 1990\r\nSQL", "Jane Doe")).toBe(
      "[name]\r\n[personal detail removed]\r\nSQL",
    );
  });
});

describe("review fixes (9 Nov 2026)", () => {
  it("handles a resume padded with a long run of spaces in linear time", () => {
    const padded = `Skills:${" ".repeat(12_000)}SQL and Zendesk`;
    const started = performance.now();
    const out = redactForScreening(padded, "Jane Doe");
    expect(performance.now() - started).toBeLessThan(200);
    expect(out).toContain("SQL and Zendesk");
  });

  it("keeps work text after a personal field on the same line", () => {
    expect(redactForScreening("Gender: Male, Skills: SQL", "Jane Doe")).toBe(
      "[personal detail removed], Skills: SQL",
    );
    expect(redactForScreening("Nationality: Indian, Python expert", "Jane Doe")).toContain(
      "Python expert",
    );
  });

  it("removes a whole date of birth with a comma before the year", () => {
    const out = redactForScreening("Date of birth: 12 March, 1995", "Jane Doe");
    expect(out).not.toContain("1995");
  });

  it("does not treat 'age -' in work text as a personal field", () => {
    expect(redactForScreening("age - gating logic in checkout", "Jane Doe")).toBe(
      "age - gating logic in checkout",
    );
  });

  it("hides a name-like first line when the display name is unknown", () => {
    const out = redactForScreening("Asha Rao\nSupport lead at Acme", "Candidate");
    expect(out.startsWith("[name]")).toBe(true);
    expect(out).toContain("Support lead at Acme");
  });

  it("keeps a job-title first line when the display name is unknown", () => {
    const text = "Senior Support Engineer\nZendesk admin";
    expect(redactForScreening(text, "Candidate")).toBe(text);
  });
});
