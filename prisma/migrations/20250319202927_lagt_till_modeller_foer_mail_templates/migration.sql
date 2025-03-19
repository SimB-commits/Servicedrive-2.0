-- CreateEnum
CREATE TYPE "MailTemplateUsage" AS ENUM ('NEW_TICKET', 'STATUS_UPDATE', 'MANUAL', 'REMINDER', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "MailTemplateSettings" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "usage" "MailTemplateUsage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailTemplateSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailTemplateSettings_storeId_usage_idx" ON "MailTemplateSettings"("storeId", "usage");

-- CreateIndex
CREATE UNIQUE INDEX "MailTemplateSettings_storeId_usage_key" ON "MailTemplateSettings"("storeId", "usage");

-- AddForeignKey
ALTER TABLE "MailTemplateSettings" ADD CONSTRAINT "MailTemplateSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailTemplateSettings" ADD CONSTRAINT "MailTemplateSettings_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
