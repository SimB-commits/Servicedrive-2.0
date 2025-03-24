-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "emailFrom" TEXT,
ADD COLUMN     "emailInReplyTo" TEXT,
ADD COLUMN     "emailMessageId" TEXT,
ADD COLUMN     "emailReferences" TEXT,
ADD COLUMN     "emailReplyTo" TEXT,
ADD COLUMN     "emailSubject" TEXT,
ADD COLUMN     "emailTo" TEXT,
ADD COLUMN     "isFromCustomer" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "senderId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key","storeId")
);

-- CreateIndex
CREATE INDEX "Setting_storeId_idx" ON "Setting"("storeId");

-- CreateIndex
CREATE INDEX "Message_ticketId_createdAt_idx" ON "Message"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_isFromCustomer_idx" ON "Message"("isFromCustomer");

-- CreateIndex
CREATE INDEX "Message_emailMessageId_idx" ON "Message"("emailMessageId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
