import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { SharedShortlist } from "@/lib/recruitment/shortlist";

type SharedShortlistViewProps = {
  shortlist: SharedShortlist;
};

export function SharedShortlistView({ shortlist }: SharedShortlistViewProps) {
  const client = shortlist.clientName.trim();

  return (
    <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted">Penaven shortlist</p>
        <h1 className="text-2xl font-semibold text-foreground">
          {client ? `${shortlist.title} for ${client}` : shortlist.title}
        </h1>
        <p className="text-sm leading-6 text-muted">
          Each requirement next to the resume line, then you decide. This page does not change anyone’s status.
        </p>
      </header>

      {shortlist.fictional ? (
        <p className="rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm leading-6 text-foreground">
          Fictional sample. Maya starts on the shortlist. Decisions made in the hiring
          demo stay in that browser and do not change this page.
        </p>
      ) : null}

      <Card>
        <CardTitle>What the role asks for</CardTitle>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shortlist.requiredSkills.map((skill) => (
            <Badge key={skill} tone="info">
              {skill}
            </Badge>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">{shortlist.description}</p>
      </Card>

      {shortlist.candidates.length === 0 ? (
        <Card>
          <CardTitle>No one has moved forward yet</CardTitle>
          <CardDescription>
            Shortlist, interview, or hire someone and this page will show them here.
          </CardDescription>
        </Card>
      ) : (
        shortlist.candidates.map((candidate) => (
          <Card key={candidate.displayName}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{candidate.displayName}</CardTitle>
                <CardDescription>
                  {candidate.status}
                  {candidate.matchScore != null
                    ? ` · ${candidate.matchScore}% criteria alignment`
                    : ""}
                </CardDescription>
              </div>
            </div>
            {candidate.summary ? (
              <p className="mt-4 text-sm leading-6 text-foreground">{candidate.summary}</p>
            ) : null}
            {candidate.evidence.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm leading-6 text-foreground">
                {candidate.evidence.map((item) => (
                  <li key={`${item.skill}-${item.quote}`}>
                    <span className="font-medium">{item.skill}.</span> {item.quote}
                  </li>
                ))}
              </ul>
            ) : null}
            {candidate.gaps.length > 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted">
                Still open: {candidate.gaps.join(", ")}
              </p>
            ) : null}
            {candidate.interviewQuestions.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm font-medium text-foreground">Questions to ask</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-foreground">
                  {candidate.interviewQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </Card>
        ))
      )}
    </main>
  );
}
