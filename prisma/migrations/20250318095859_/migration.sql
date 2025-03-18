/*
  Warnings:

  - A unique constraint covering the columns `[externalId,storeId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalId_storeId_key" ON "Customer"("externalId", "storeId");
