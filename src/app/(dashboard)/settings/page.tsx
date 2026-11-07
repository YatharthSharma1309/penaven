import { Header } from "@/components/layout/header";
import { AgentSettingsForm } from "@/components/settings/agent-settings-form";
import { PlanCard } from "@/components/settings/plan-card";
import { WidgetSettingsCard } from "@/components/settings/widget-settings-card";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { PLANS } from "@/lib/billing/plans";
import { razorpayConfig } from "@/lib/billing/razorpay";
import { planSummary } from "@/lib/billing/subscription-state";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { getAgentSettings } from "@/lib/settings";

const appUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
const hasAppUrl = Boolean(process.env.APP_URL?.trim());

export default async function SettingsPage() {
  const { organization } = await requireOrgMembershipOrRedirect("ADMIN");
  const settings = await getAgentSettings(organization.id);
  // The public demo has no plan to buy: it skips the caps for everyone.
  const showPlan = !isPublicDemoMode();

  return (
    <>
      <Header
        title="AI Agent Settings"
        description="Configure greeting, tone, instructions, your customer-facing widget, and your plan."
      />
      <main id="main-content" className="flex-1 px-4 py-6 sm:p-6 lg:p-8">
        <AgentSettingsForm initialSettings={settings} />
        <WidgetSettingsCard
          widgetPublicKey={organization.widgetPublicKey}
          widgetEnabled={organization.widgetEnabled}
          allowedOrigins={(settings.widget?.allowedOrigins ?? []).join("\n")}
          appUrl={appUrl}
          hasAppUrl={hasAppUrl}
        />
        {showPlan ? (
          <PlanCard
            summary={planSummary(organization)}
            renewsAt={organization.planRenewsAt?.toISOString() ?? null}
            checkoutReady={razorpayConfig() !== null}
            proPriceUsd={PLANS.pro.priceUsd}
            free={{
              answers: PLANS.free.assistantAnswersPerMonth,
              screens: PLANS.free.resumeScreensPerMonth,
              roles: PLANS.free.roles,
            }}
            pro={{
              answers: PLANS.pro.assistantAnswersPerMonth,
              screens: PLANS.pro.resumeScreensPerMonth,
              roles: PLANS.pro.roles,
            }}
          />
        ) : null}
      </main>
    </>
  );
}
