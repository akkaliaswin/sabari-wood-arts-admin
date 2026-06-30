-- Create sequence for LabourPayment codes
CREATE SEQUENCE IF NOT EXISTS labour_payment_code_seq START 1;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "quoted_amount" DROP NOT NULL,
ALTER COLUMN "quoted_amount" DROP DEFAULT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "work_item_types" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_disabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_item_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "labour_payments" (
    "id" UUID NOT NULL,
    "payment_code" TEXT NOT NULL DEFAULT 'LP' || lpad(nextval('labour_payment_code_seq')::text, 4, '0'),
    "labourer_id" UUID NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "payment_type" TEXT NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labour_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "work_item_types_name_key" ON "work_item_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "labour_payments_payment_code_key" ON "labour_payments"("payment_code");

-- AddForeignKey
ALTER TABLE "labour_payments" DROP CONSTRAINT IF EXISTS "labour_payments_labourer_id_fkey";
ALTER TABLE "labour_payments" ADD CONSTRAINT "labour_payments_labourer_id_fkey" FOREIGN KEY ("labourer_id") REFERENCES "labourers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
