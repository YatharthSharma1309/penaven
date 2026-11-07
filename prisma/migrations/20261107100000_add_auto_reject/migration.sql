-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "autoRejectEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "autoRejectOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoRejectPrevious" TEXT,
ADD COLUMN     "autoRejectReason" TEXT,
ADD COLUMN     "autoRejectedAt" TIMESTAMP(3);

