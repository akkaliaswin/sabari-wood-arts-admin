-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "client_code" SET DEFAULT 'C' || lpad(nextval('client_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "labour_costs" ADD COLUMN     "work_item_id" UUID,
ALTER COLUMN "labour_code" SET DEFAULT 'L' || lpad(nextval('labour_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "material_purchases" ADD COLUMN     "work_item_id" UUID,
ALTER COLUMN "material_code" SET DEFAULT 'M' || lpad(nextval('material_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "payment_code" SET DEFAULT 'PM' || lpad(nextval('payment_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "project_code" SET DEFAULT 'P' || lpad(nextval('project_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "work_items" ADD COLUMN     "selling_price" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ALTER COLUMN "work_code" SET DEFAULT 'W' || lpad(nextval('work_code_seq')::text, 4, '0');

-- AddForeignKey
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labour_costs" ADD CONSTRAINT "labour_costs_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing work items selling_price with total_price
UPDATE "work_items" SET "selling_price" = "total_price";
