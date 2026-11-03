/**
 * A one-page, text-based PDF built in memory, so the suite needs no binary
 * fixture in the repo. The text sits in a Helvetica text object that
 * pdf-parse can read back.
 */
export function tinyResumePdf(lines: string[]): Buffer {
  const escape = (text: string) => text.replace(/[\\()]/g, (char) => `\\${char}`);
  const textOps = lines
    .map((line, index) => `${index === 0 ? "" : "0 -18 Td "}(${escape(line)}) Tj`)
    .join("\n");
  const content = `BT /F1 12 Tf 72 720 Td\n${textOps}\nET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/** The smallest job the API accepts, with requirements the resume can meet. */
export function jobPayload(title: string, skills: string[]) {
  return {
    title,
    clientName: "",
    description: `${title}. Sample role created by the two-client end-to-end suite.`,
    requiredSkills: skills,
    preferredSkills: [],
    experienceLevel: null,
    minYearsExperience: 2,
    educationRequirements: [],
    certifications: [],
    roleType: null,
  };
}
