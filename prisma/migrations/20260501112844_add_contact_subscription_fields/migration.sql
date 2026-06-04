-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "source" TEXT,
ADD COLUMN     "subscribedAt" TIMESTAMP(3),
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3);
