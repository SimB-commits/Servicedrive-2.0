-- CreateTable
CREATE TABLE "VerifiedDomain" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedDomain_domainId_key" ON "VerifiedDomain"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedDomain_domain_storeId_key" ON "VerifiedDomain"("domain", "storeId");

-- AddForeignKey
ALTER TABLE "VerifiedDomain" ADD CONSTRAINT "VerifiedDomain_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
