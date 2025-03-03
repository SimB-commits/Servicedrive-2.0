-- DropForeignKey
ALTER TABLE "TicketField" DROP CONSTRAINT "TicketField_ticketTypeId_fkey";

-- AddForeignKey
ALTER TABLE "TicketField" ADD CONSTRAINT "TicketField_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
