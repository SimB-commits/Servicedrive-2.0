-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "customStatusId" INTEGER,
ALTER COLUMN "status" DROP NOT NULL;

-- CreateTable
CREATE TABLE "UserTicketStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "dynamicFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTicketStatus_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_customStatusId_fkey" FOREIGN KEY ("customStatusId") REFERENCES "UserTicketStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
