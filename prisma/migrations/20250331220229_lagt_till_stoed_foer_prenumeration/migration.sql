-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTUP', 'TEAM', 'GROWING', 'PROFESSIONAL');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "monthlyTicketCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscriptionAutoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionEndDate" TIMESTAMP(3),
ADD COLUMN     "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'STARTUP',
ADD COLUMN     "subscriptionStartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ticketCountResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "StoreUsageMetrics" (
    "id" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "adminCount" INTEGER NOT NULL DEFAULT 1,
    "customTicketTypeCount" INTEGER NOT NULL DEFAULT 0,
    "customStatusCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedDomainCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreUsageMetrics_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StoreUsageMetrics" ADD CONSTRAINT "StoreUsageMetrics_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
