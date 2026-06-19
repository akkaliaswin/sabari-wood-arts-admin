-- Create sequence for Labourer codes
CREATE SEQUENCE labourer_code_seq START 1;

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "client_code" SET DEFAULT 'C' || lpad(nextval('client_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "labour_costs" ADD COLUMN     "labourer_id" UUID,
ALTER COLUMN "labour_code" SET DEFAULT 'L' || lpad(nextval('labour_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "material_purchases" ALTER COLUMN "material_code" SET DEFAULT 'M' || lpad(nextval('material_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "payment_code" SET DEFAULT 'PM' || lpad(nextval('payment_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "project_code" SET DEFAULT 'P' || lpad(nextval('project_code_seq')::text, 4, '0');

-- AlterTable
ALTER TABLE "work_items" ALTER COLUMN "work_code" SET DEFAULT 'W' || lpad(nextval('work_code_seq')::text, 4, '0');

-- CreateTable
CREATE TABLE "labourers" (
    "id" UUID NOT NULL,
    "labour_code" TEXT NOT NULL DEFAULT 'LAB' || lpad(nextval('labourer_code_seq')::text, 4, '0'),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "skill_type" TEXT NOT NULL,
    "joining_date" DATE NOT NULL,
    "active_status" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labourers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_status_history" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "previous_status" TEXT NOT NULL,
    "new_status" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_item_status_history" (
    "id" UUID NOT NULL,
    "work_item_id" UUID NOT NULL,
    "previous_status" TEXT NOT NULL,
    "new_status" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_item_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_activities" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "activity_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "labourers_labour_code_key" ON "labourers"("labour_code");

-- AddForeignKey
ALTER TABLE "labour_costs" ADD CONSTRAINT "labour_costs_labourer_id_fkey" FOREIGN KEY ("labourer_id") REFERENCES "labourers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_status_history" ADD CONSTRAINT "work_item_status_history_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill unique carpenter names into labourers table
INSERT INTO "labourers" ("id", "name", "phone", "skill_type", "joining_date", "active_status", "updated_at", "created_at")
SELECT
  gen_random_uuid() as id,
  carpenter_name as name,
  '0000000000' as phone,
  'Carpenter' as skill_type,
  CURRENT_DATE as joining_date,
  true as active_status,
  CURRENT_TIMESTAMP as updated_at,
  CURRENT_TIMESTAMP as created_at
FROM (
  SELECT DISTINCT carpenter_name FROM "labour_costs"
) unique_carpenters;

-- Link existing labour costs to newly created labourers
UPDATE "labour_costs" lc
SET "labourer_id" = l.id
FROM "labourers" l
WHERE lc.carpenter_name = l.name;

-- Backfill project activities: Project Created
INSERT INTO "project_activities" ("id", "project_id", "activity_type", "description", "created_at")
SELECT
  gen_random_uuid() as id,
  id as project_id,
  'PROJECT_CREATED' as activity_type,
  'Project ' || project_name || ' was created.' as description,
  created_at
FROM "projects";

-- Backfill project activities: Work Item Added
INSERT INTO "project_activities" ("id", "project_id", "activity_type", "description", "created_at")
SELECT
  gen_random_uuid() as id,
  project_id,
  'WORK_ITEM_ADDED' as activity_type,
  'Work Item added: ' || work_type || ' (Qty: ' || quantity || ', Price: ₹' || unit_price || ', Selling Price: ₹' || selling_price || ')' as description,
  created_at
FROM "work_items";

-- Backfill project activities: Material Added
INSERT INTO "project_activities" ("id", "project_id", "activity_type", "description", "created_at")
SELECT
  gen_random_uuid() as id,
  project_id,
  'MATERIAL_ADDED' as activity_type,
  'Material purchase logged: ' || material_name || ' (Amount: ₹' || amount || ', Vendor: ' || COALESCE(vendor, 'N/A') || ')' as description,
  created_at
FROM "material_purchases";

-- Backfill project activities: Labour Added
INSERT INTO "project_activities" ("id", "project_id", "activity_type", "description", "created_at")
SELECT
  gen_random_uuid() as id,
  project_id,
  'LABOUR_ADDED' as activity_type,
  'Labour cost logged for ' || carpenter_name || ' (Amount paid: ₹' || amount || ', Work: ' || COALESCE(work_description, 'N/A') || ')' as description,
  created_at
FROM "labour_costs";

-- Backfill project activities: Payment Received
INSERT INTO "project_activities" ("id", "project_id", "activity_type", "description", "created_at")
SELECT
  gen_random_uuid() as id,
  project_id,
  'PAYMENT_RECEIVED' as activity_type,
  'Payment received: ₹' || amount || ' via ' || payment_mode || ' (Ref: ' || COALESCE(reference_number, 'N/A') || ')' as description,
  created_at
FROM "payments";

-- Backfill project status history representing the current state
INSERT INTO "project_status_history" ("id", "project_id", "previous_status", "new_status", "changed_at")
SELECT
  gen_random_uuid() as id,
  id as project_id,
  'Lead' as previous_status,
  status as new_status,
  created_at as changed_at
FROM "projects";

