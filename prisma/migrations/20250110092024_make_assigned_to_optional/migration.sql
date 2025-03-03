-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assignedTo_fkey";

-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "assignedTo" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
