-- AlterTable
ALTER TABLE "IbsaConvention" ADD COLUMN     "faCollectionDate" TIMESTAMP(3),
ADD COLUMN     "faDeliveryAddress" TEXT,
ADD COLUMN     "faDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "faPaidAt" TIMESTAMP(3),
ADD COLUMN     "faPaymentDueDate" TIMESTAMP(3),
ADD COLUMN     "faShippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "faStatus" TEXT NOT NULL DEFAULT 'pending';
