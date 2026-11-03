import { describe, expect, it } from "vitest";
import { aiUnavailableReply } from "@/lib/chat/answer-outcome";
import {
  inboxRowPreview,
  inboxRowStatus,
  latestExchange,
  type ExchangeMessage,
} from "./latest-exchange";

const source = [{ documentTitle: "Policies", content: "Refunds within 30 days." }];
const notFound =
  "I could not find relevant information in your knowledge base about gift cards.";

/** The live run: refund (answered), hours (answered), gift cards (not covered). */
function threeQuestionThread(): ExchangeMessage[] {
  const oldestFirst: ExchangeMessage[] = [
    { role: "USER", content: "What is your refund policy?" },
    { role: "ASSISTANT", content: "Refunds are accepted within 30 days.", sources: source },
    { role: "USER", content: "What are your opening hours?" },
    { role: "ASSISTANT", content: "We are open 9 to 5, Monday to Friday.", sources: source },
    { role: "USER", content: "Do you sell gift cards?" },
    { role: "ASSISTANT", content: notFound, sources: [] },
  ];
  return oldestFirst.reverse();
}

describe("latestExchange", () => {
  it("pairs the latest reply with the question it answered", () => {
    const { question, reply } = latestExchange(threeQuestionThread());
    expect(question?.content).toBe("Do you sell gift cards?");
    expect(reply?.content).toBe(notFound);
  });

  it("has no reply while the visitor waits on the latest question", () => {
    const messages = [
      { role: "USER", content: "Do you ship abroad?" },
      ...threeQuestionThread(),
    ];
    const { question, reply, lastRole } = latestExchange(messages);
    expect(question?.content).toBe("Do you ship abroad?");
    expect(reply).toBeNull();
    expect(lastRole).toBe("USER");
  });

  it("skips SYSTEM turns", () => {
    const messages = [
      { role: "SYSTEM", content: "Handed to a person." },
      ...threeQuestionThread(),
    ];
    expect(latestExchange(messages).reply?.content).toBe(notFound);
  });

  it("is empty with no messages", () => {
    expect(latestExchange([])).toEqual({ question: null, reply: null, lastRole: null });
  });
});

describe("inboxRowPreview", () => {
  it("names the later question next to its reply, not the title's", () => {
    const preview = inboxRowPreview({
      title: "What is your refund policy?",
      messagesNewestFirst: threeQuestionThread(),
    });
    expect(preview.question).toBe("Do you sell gift cards?");
    expect(preview.reply).toBe("Not in your docs. A person can take this.");
  });

  it("does not repeat the question when it is the title", () => {
    const preview = inboxRowPreview({
      title: "What is your refund policy?",
      messagesNewestFirst: [
        { role: "ASSISTANT", content: "Refunds are accepted within 30 days.", sources: source },
        { role: "USER", content: "What is your refund policy?" },
      ],
    });
    expect(preview).toEqual({
      question: null,
      reply: "Refunds are accepted within 30 days.",
    });
  });

  it("treats a long first question cut to 80 characters as the title", () => {
    const long = `${"Can I change the delivery address on an order ".repeat(3)}?`;
    const preview = inboxRowPreview({
      title: long.slice(0, 80),
      messagesNewestFirst: [{ role: "USER", content: long }],
    });
    expect(preview).toEqual({ question: null, reply: "No reply yet" });
  });

  it("says no reply yet when the newest question is unanswered", () => {
    const preview = inboxRowPreview({
      title: "What is your refund policy?",
      messagesNewestFirst: [
        { role: "USER", content: "Do you ship abroad?" },
        ...threeQuestionThread(),
      ],
    });
    expect(preview).toEqual({ question: "Do you ship abroad?", reply: "No reply yet" });
  });

  it("does not claim the docs lack an answer when the model was unavailable", () => {
    const preview = inboxRowPreview({
      title: "What is your refund policy?",
      messagesNewestFirst: [
        { role: "ASSISTANT", content: aiUnavailableReply("WIDGET"), sources: source },
        { role: "USER", content: "Can I return a gift?" },
        ...threeQuestionThread(),
      ],
    });
    expect(preview).toEqual({
      question: "Can I return a gift?",
      reply: "A person can take this.",
    });
  });

  it("keeps the reply when its question fell outside the fetched turns", () => {
    const preview = inboxRowPreview({
      title: "Hi",
      messagesNewestFirst: [
        { role: "ASSISTANT", content: "Anything else?", sources: source },
      ],
    });
    expect(preview).toEqual({ question: null, reply: "Anything else?" });
  });

  it("puts multi-line text on one line", () => {
    const preview = inboxRowPreview({
      title: "First",
      messagesNewestFirst: [
        { role: "ASSISTANT", content: "Line one.\n\nLine two.", sources: source },
        { role: "USER", content: "Second\nquestion" },
      ],
    });
    expect(preview).toEqual({ question: "Second question", reply: "Line one. Line two." });
  });

  it("says so with no messages", () => {
    expect(inboxRowPreview({ title: null, messagesNewestFirst: [] })).toEqual({
      question: null,
      reply: "No messages yet",
    });
  });
});

describe("inboxRowStatus", () => {
  it("follows the latest exchange, not an earlier answered one", () => {
    expect(
      inboxRowStatus({ messagesNewestFirst: threeQuestionThread(), hasOpenTicket: false }),
    ).toBe("open");
  });

  it("is answered when the latest reply came from the docs", () => {
    expect(
      inboxRowStatus({
        messagesNewestFirst: threeQuestionThread().slice(2),
        hasOpenTicket: false,
      }),
    ).toBe("answered");
  });

  it("is open while the visitor waits, even after an answered reply", () => {
    expect(
      inboxRowStatus({
        messagesNewestFirst: [
          { role: "USER", content: "Do you ship abroad?" },
          ...threeQuestionThread().slice(2),
        ],
        hasOpenTicket: false,
      }),
    ).toBe("open");
  });

  it("is waiting for a human with an open case", () => {
    expect(
      inboxRowStatus({ messagesNewestFirst: threeQuestionThread(), hasOpenTicket: true }),
    ).toBe("waiting_for_human");
  });
});
