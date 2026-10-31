-- Public /contact form messages. Read with `npm run db:studio`.
-- CreateEnum
CREATE TYPE "ContactTopic" AS ENUM ('ENTERPRISE', 'GENERAL');

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "teamSize" TEXT,
    "topic" "ContactTopic" NOT NULL DEFAULT 'ENTERPRISE',
    "message" TEXT NOT NULL,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");
