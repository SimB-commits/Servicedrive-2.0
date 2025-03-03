/*
  Warnings:

  - Added the required column `address` to the `Store` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company` to the `Store` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `UserStore` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "company" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserStore" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
