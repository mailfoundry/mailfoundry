-- CreateTable: IbsaPurchaseOrder
CREATE TABLE "IbsaPurchaseOrder" (
    "id"         TEXT NOT NULL,
    "poNumber"   TEXT NOT NULL,
    "supplier"   TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'ordered',
    "orderedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "totalExVat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IbsaPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IbsaPurchaseOrderLine
CREATE TABLE "IbsaPurchaseOrderLine" (
    "id"               TEXT NOT NULL,
    "purchaseOrderId"  TEXT NOT NULL,
    "rsCode"           TEXT,
    "description"      TEXT NOT NULL,
    "variant"          TEXT,
    "cartonSize"       INTEGER,
    "cartonsOrdered"   INTEGER NOT NULL,
    "cartonsReceived"  INTEGER NOT NULL DEFAULT 0,
    "pricePerCarton"   DOUBLE PRECISION,
    "totalCost"        DOUBLE PRECISION,
    "productBreakdown" TEXT NOT NULL DEFAULT '[]',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IbsaPurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IbsaPurchaseOrderLine_purchaseOrderId_idx" ON "IbsaPurchaseOrderLine"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "IbsaPurchaseOrderLine" ADD CONSTRAINT "IbsaPurchaseOrderLine_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "IbsaPurchaseOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
