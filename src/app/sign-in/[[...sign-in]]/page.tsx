import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { ClerkSetupNotice } from "@/components/auth/clerk-setup-notice";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { isClerkConfigured } from "@/lib/env/clerk";
import { companyName } from "@/lib/brand";
import { privatePageRobots } from "@/lib/seo/robots-meta";

export const metadata: Metadata = {
  title: `Sign in | ${companyName}`,
  robots: privatePageRobots,
};

export default function SignInPage() {
  if (isAuthBypassEnabled()) {
    redirect("/dashboard");
  }

  if (!isClerkConfigured()) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          <div className="mb-8">
            <BrandLogo showTagline />
          </div>
          <ClerkSetupNotice />
        </div>
        <SiteFooter variant="minimal" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <BrandLogo showTagline />
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/onboarding"
          fallbackRedirectUrl="/dashboard"
          appearance={clerkAppearance}
        />
      </div>
      <SiteFooter variant="minimal" />
    </div>
  );
}
