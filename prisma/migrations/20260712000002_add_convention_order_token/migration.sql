-- CreateTable
CREATE TABLE "ConventionOrderToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "conventionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConventionOrderToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConventionOrderToken_token_key" ON "ConventionOrderToken"("token");

-- CreateIndex
CREATE INDEX "ConventionOrderToken_conventionId_idx" ON "ConventionOrderToken"("conventionId");
