-- CreateTable
CREATE TABLE "SenderAddress" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SenderAddress_storeId_isDefault_idx" ON "SenderAddress"("storeId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "SenderAddress_storeId_email_key" ON "SenderAddress"("storeId", "email");

-- AddForeignKey
ALTER TABLE "SenderAddress" ADD CONSTRAINT "SenderAddress_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
