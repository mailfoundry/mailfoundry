-- CreateTable
CREATE TABLE "IbsaGroupOrder" (
    "id" TEXT NOT NULL,
    "groupType" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactMobile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IbsaGroupOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IbsaGroupOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "IbsaGroupOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IbsaGroupOrder_status_idx" ON "IbsaGroupOrder"("status");

-- CreateIndex
CREATE INDEX "IbsaGroupOrderLine_orderId_idx" ON "IbsaGroupOrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "IbsaGroupOrderLine_orderId_productId_dept_key" ON "IbsaGroupOrderLine"("orderId", "productId", "dept");

-- AddForeignKey
ALTER TABLE "IbsaGroupOrderLine" ADD CONSTRAINT "IbsaGroupOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "IbsaGroupOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IbsaGroupOrderLine" ADD CONSTRAINT "IbsaGroupOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "IbsaProduct"("id") ON UPDATE CASCADE;
