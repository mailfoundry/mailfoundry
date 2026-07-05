-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "html" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignClick" (
    "id" TEXT NOT NULL,
    "sendId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignClick_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignClick" ADD CONSTRAINT "CampaignClick_sendId_fkey" FOREIGN KEY ("sendId") REFERENCES "CampaignSend"("id") ON DELETE CASCADE ON UPDATE CASCADE;
