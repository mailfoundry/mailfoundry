-- AlterTable: add Stripe customer ID to GroupAccount
ALTER TABLE "GroupAccount" ADD COLUMN "stripeCustomerId" TEXT;

-- AlterTable: add Stripe invoice tracking to IbsaGroupOrder
ALTER TABLE "IbsaGroupOrder" ADD COLUMN "stripeInvoiceId" TEXT;
ALTER TABLE "IbsaGroupOrder" ADD COLUMN "invoicedAt" TIMESTAMP(3);
ALTER TABLE "IbsaGroupOrder" ADD COLUMN "paidAt" TIMESTAMP(3);
