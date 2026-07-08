-- CreateTable
CREATE TABLE "IbsaProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "xyloCost" DOUBLE PRECISION,
    "inStock" INTEGER NOT NULL DEFAULT 0,
    "git" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IbsaProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IbsaConvention" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT,
    "conventionDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IbsaConvention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IbsaOrderItem" (
    "id" TEXT NOT NULL,
    "conventionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IbsaOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IbsaProduct_code_key" ON "IbsaProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "IbsaOrderItem_conventionId_productId_key" ON "IbsaOrderItem"("conventionId", "productId");

-- AddForeignKey
ALTER TABLE "IbsaOrderItem" ADD CONSTRAINT "IbsaOrderItem_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "IbsaConvention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IbsaOrderItem" ADD CONSTRAINT "IbsaOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "IbsaProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
