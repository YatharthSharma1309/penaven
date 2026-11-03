/**
 * The two sample businesses the suite plays. Every name, slug, email and key
 * here is test data: the `e2e-` slugs and `penaven-e2e-` emails mark it, and
 * the global setup deletes and recreates these rows on each run.
 */
export type ClientId = "clinic" | "shop";

export type Client = {
  id: ClientId;
  /** Shown in the dashboard and widget only through the greeting below. */
  name: string;
  slug: string;
  /** DEMO_USER_EMAIL for this client's server. */
  ownerEmail: string;
  /** DEMO_WIDGET_KEY for this client's server. */
  widgetKey: string;
  port: number;
  baseURL: string;
  greeting: string;
  faq: { fileName: string; body: string };
  jobTitle: string;
  /** candidateName is what the app derives from the file name. */
  resume: { fileName: string; candidateName: string; lines: string[] };
};

const HOST = "http://localhost";

export const CLINIC_PORT = Number(process.env.TWO_CLIENTS_CLINIC_PORT ?? 3200);
export const SHOP_PORT = Number(process.env.TWO_CLIENTS_SHOP_PORT ?? 3201);
/** Only used by the Clerk spec, when TWO_CLIENTS_CLERK=1. */
export const CLERK_PORT = Number(process.env.TWO_CLIENTS_CLERK_PORT ?? 3202);

export const CLIENTS: Record<ClientId, Client> = {
  clinic: {
    id: "clinic",
    name: "Brightside Dental (sample)",
    slug: "e2e-brightside-dental",
    ownerEmail: "penaven-e2e-clinic@example.com",
    widgetKey: "wk_test_e2e_brightside_dental_widget",
    port: CLINIC_PORT,
    baseURL: `${HOST}:${CLINIC_PORT}`,
    greeting: "Hello from Brightside Dental (sample). Ask about cleanings or hours.",
    faq: {
      fileName: "brightside-dental-faq.md",
      body: [
        "# Brightside Dental (sample) FAQ",
        "",
        "Opening hours: Monday to Friday 8am to 5pm. On Saturday the clinic is open 9am to 1pm for check-ups only.",
        "",
        "Teeth cleaning: a routine cleaning appointment takes 45 minutes and costs 95 dollars.",
        "",
        "Dental emergencies: call the front desk for a same-day emergency slot.",
      ].join("\n"),
    },
    jobTitle: "Dental Hygienist (e2e sample)",
    resume: {
      fileName: "avery-clinic-candidate.pdf",
      candidateName: "avery clinic candidate",
      lines: [
        "Avery Clinic Candidate",
        "Registered dental hygienist with 6 years of experience.",
        "Skills: periodontal charting, patient education, infection control.",
      ],
    },
  },
  shop: {
    id: "shop",
    name: "Northpeak Outdoor (sample)",
    slug: "e2e-northpeak-outdoor",
    ownerEmail: "penaven-e2e-shop@example.com",
    widgetKey: "wk_test_e2e_northpeak_outdoor_widget",
    port: SHOP_PORT,
    baseURL: `${HOST}:${SHOP_PORT}`,
    greeting: "Welcome to Northpeak Outdoor (sample). Ask about tents, boots or returns.",
    faq: {
      fileName: "northpeak-outdoor-faq.md",
      body: [
        "# Northpeak Outdoor (sample) FAQ",
        "",
        "Opening hours: the store is open every day 10am to 7pm, and on Saturday until 9pm.",
        "",
        "Tent returns: unused tents can be returned within 30 days for a full refund.",
        "",
        "Boot sizing: hiking boots run half a size small, so order half a size up.",
      ].join("\n"),
    },
    jobTitle: "Retail Gear Specialist (e2e sample)",
    resume: {
      fileName: "jordan-shop-candidate.pdf",
      candidateName: "jordan shop candidate",
      lines: [
        "Jordan Shop Candidate",
        "Outdoor retail associate with 4 years of experience.",
        "Skills: product knowledge, merchandising, customer service.",
      ],
    },
  },
};

export function otherClient(client: Client): Client {
  return client.id === "clinic" ? CLIENTS.shop : CLIENTS.clinic;
}

/** Both FAQs cover it, so each widget must cite its own document. */
export const COVERED_QUESTION = "What are your opening hours on Saturday?";

/** Neither FAQ has two of these words, so both widgets hand off. */
export const UNCOVERED_QUESTION = "Do you repair vintage motorcycles?";

/** A key no organization has. */
export const BOGUS_WIDGET_KEY = "wk_live_e2e_made_up_key_that_matches_nothing";
