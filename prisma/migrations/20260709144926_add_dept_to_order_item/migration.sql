/*
  Warnings:

  - A unique constraint covering the columns `[conventionId,productId,dept]` on the table `IbsaOrderItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "IbsaOrderItem_conventionId_productId_key";

-- AlterTable
ALTER TABLE "IbsaOrderItem" ADD COLUMN     "dept" TEXT NOT NULL DEFAULT 'CS';

-- CreateIndex
CREATE UNIQUE INDEX "IbsaOrderItem_conventionId_productId_dept_key" ON "IbsaOrderItem"("conventionId", "productId", "dept");
