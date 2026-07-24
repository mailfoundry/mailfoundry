-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "referer" TEXT NOT NULL DEFAULT '',
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_viewedAt_idx" ON "PageView"("viewedAt" DESC);

-- CreateIndex
CREATE INDEX "PageView_hostname_idx" ON "PageView"("hostname");
