-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "client_code" SET DEFAULT 'C' || lpad(nextval('client_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "labour_costs" ALTER COLUMN "labour_code" SET DEFAULT 'L' || lpad(nextval('labour_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "labourers" ALTER COLUMN "labour_code" SET DEFAULT 'LAB' || lpad(nextval('labourer_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "material_purchases" ALTER COLUMN "material_code" SET DEFAULT 'M' || lpad(nextval('material_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "payment_code" SET DEFAULT 'PM' || lpad(nextval('payment_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "project_code" SET DEFAULT 'P' || lpad(nextval('project_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "work_items" ADD COLUMN     "actual_cost" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ALTER COLUMN "work_code" SET DEFAULT 'W' || lpad(nextval('work_code_seq')::text, 4, '0');
