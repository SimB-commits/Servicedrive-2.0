/*
  Warnings:

  - You are about to drop the column `phone` on the `CustomerCard` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CustomerCard" DROP COLUMN "phone",
ADD COLUMN     "phoneNumber" TEXT;
