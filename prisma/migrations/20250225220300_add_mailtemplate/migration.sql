-- AlterTable
ALTER TABLE "UserTicketStatus" ADD COLUMN     "mailTemplateId" INTEGER;

-- CreateTable
CREATE TABLE "MailTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserTicketStatus" ADD CONSTRAINT "UserTicketStatus_mailTemplateId_fkey" FOREIGN KEY ("mailTemplateId") REFERENCES "MailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
