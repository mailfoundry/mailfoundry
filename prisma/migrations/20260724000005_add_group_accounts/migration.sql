-- CreateTable
CREATE TABLE "GroupAccount" (
    "id" TEXT NOT NULL,
    "groupType" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactMobile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAccountToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "groupAccountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupAccountToken_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "IbsaGroupOrder" ADD COLUMN "groupAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GroupAccount_contactEmail_key" ON "GroupAccount"("contactEmail");

-- CreateIndex
CREATE INDEX "GroupAccount_contactEmail_idx" ON "GroupAccount"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "GroupAccountToken_token_key" ON "GroupAccountToken"("token");

-- CreateIndex
CREATE INDEX "GroupAccountToken_token_idx" ON "GroupAccountToken"("token");

-- CreateIndex
CREATE INDEX "IbsaGroupOrder_groupAccountId_idx" ON "IbsaGroupOrder"("groupAccountId");

-- AddForeignKey
ALTER TABLE "GroupAccountToken" ADD CONSTRAINT "GroupAccountToken_groupAccountId_fkey" FOREIGN KEY ("groupAccountId") REFERENCES "GroupAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IbsaGroupOrder" ADD CONSTRAINT "IbsaGroupOrder_groupAccountId_fkey" FOREIGN KEY ("groupAccountId") REFERENCES "GroupAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
