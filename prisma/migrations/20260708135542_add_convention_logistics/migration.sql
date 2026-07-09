-- AlterTable
ALTER TABLE "IbsaConvention" ADD COLUMN     "collectionDate" TIMESTAMP(3),
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactMobile" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentDueDate" TIMESTAMP(3);
