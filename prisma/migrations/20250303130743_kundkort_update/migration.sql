-- CreateTable
CREATE TABLE "CustomerCard" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "email" TEXT,
    "phone" TEXT,
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "loyal" BOOLEAN NOT NULL DEFAULT false,
    "dynamicFields" JSONB DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "storeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCard_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomerCard" ADD CONSTRAINT "CustomerCard_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
