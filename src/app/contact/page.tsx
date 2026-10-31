import type { Metadata } from "next";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ContactForm } from "@/components/marketing/contact-form";
import { companyName } from "@/lib/brand";
import { contactTopicFromParam } from "@/lib/contact/validation";

export const metadata: Metadata = {
  title: `Contact | ${companyName}`,
  description: `Send the ${companyName} team a message.`,
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const topic = contactTopicFromParam((await searchParams).topic);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader
        variant="help"
        title="Contact"
        subtitle="A message to the team behind the product"
        backHref="/"
        backLabel="Home"
      />

      <main
        id="main-content"
        className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6"
      >
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Tell us what you need
        </h2>
        <ContactForm initialTopic={topic} />
      </main>

      <SiteFooter variant="minimal" />
    </div>
  );
}
