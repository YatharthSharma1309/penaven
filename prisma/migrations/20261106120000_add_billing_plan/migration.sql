-- Paid checkout: the workspace plan and its Razorpay subscription.
-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "plan" "BillingPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planRenewsAt" TIMESTAMP(3),
ADD COLUMN     "razorpaySubscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_razorpaySubscriptionId_key" ON "Organization"("razorpaySubscriptionId");
