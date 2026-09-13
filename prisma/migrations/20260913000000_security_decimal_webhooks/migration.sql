-- Convert monetary values from floating point to fixed precision.
ALTER TABLE "Church" ALTER COLUMN "initialCapital" TYPE DECIMAL(14,2) USING "initialCapital"::DECIMAL(14,2);
ALTER TABLE "Member" ALTER COLUMN "salary" TYPE DECIMAL(14,2) USING "salary"::DECIMAL(14,2);
ALTER TABLE "Transaction" ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING "amount"::DECIMAL(14,2);
ALTER TABLE "MemberCard" ALTER COLUMN "paidAmount" TYPE DECIMAL(14,2) USING "paidAmount"::DECIMAL(14,2);
ALTER TABLE "Subscription" ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING "amount"::DECIMAL(14,2);
ALTER TABLE "Debt" ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING "amount"::DECIMAL(14,2);
ALTER TABLE "DebtPayment" ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING "amount"::DECIMAL(14,2);
ALTER TABLE "CardOrder" ALTER COLUMN "unitPriceUsd" TYPE DECIMAL(14,2) USING "unitPriceUsd"::DECIMAL(14,2);
ALTER TABLE "CardOrder" ALTER COLUMN "totalPriceUsd" TYPE DECIMAL(14,2) USING "totalPriceUsd"::DECIMAL(14,2);

CREATE TABLE "PaymentWebhook" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhook_reference_event_key" ON "PaymentWebhook"("reference", "event");
CREATE INDEX "PaymentWebhook_receivedAt_idx" ON "PaymentWebhook"("receivedAt");

CREATE UNIQUE INDEX "Attendance_eventId_memberId_key" ON "Attendance"("eventId", "memberId");
