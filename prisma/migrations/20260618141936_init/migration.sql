-- Create sequences for custom codes
CREATE SEQUENCE client_code_seq START 1;
CREATE SEQUENCE project_code_seq START 1;
CREATE SEQUENCE work_code_seq START 1;
CREATE SEQUENCE material_code_seq START 1;
CREATE SEQUENCE payment_code_seq START 1;
CREATE SEQUENCE labour_code_seq START 1;

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "client_code" TEXT NOT NULL DEFAULT 'C' || lpad(nextval('client_code_seq')::text, 4, '0'),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternate_phone" TEXT,
    "location" TEXT,
    "address" TEXT,
    "referred_by" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "project_code" TEXT NOT NULL DEFAULT 'P' || lpad(nextval('project_code_seq')::text, 4, '0'),
    "client_id" UUID NOT NULL,
    "project_name" TEXT NOT NULL,
    "project_type" TEXT,
    "project_location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Lead',
    "quoted_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "start_date" DATE,
    "expected_completion_date" DATE,
    "actual_completion_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_items" (
    "id" UUID NOT NULL,
    "work_code" TEXT NOT NULL DEFAULT 'W' || lpad(nextval('work_code_seq')::text, 4, '0'),
    "project_id" UUID NOT NULL,
    "work_type" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_price" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_purchases" (
    "id" UUID NOT NULL,
    "material_code" TEXT NOT NULL DEFAULT 'M' || lpad(nextval('material_code_seq')::text, 4, '0'),
    "project_id" UUID NOT NULL,
    "purchase_date" DATE NOT NULL,
    "material_name" TEXT NOT NULL,
    "vendor" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "unit" TEXT,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "bill_number" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "payment_code" TEXT NOT NULL DEFAULT 'PM' || lpad(nextval('payment_code_seq')::text, 4, '0'),
    "project_id" UUID NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "payment_mode" TEXT NOT NULL,
    "reference_number" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labour_costs" (
    "id" UUID NOT NULL,
    "labour_code" TEXT NOT NULL DEFAULT 'L' || lpad(nextval('labour_code_seq')::text, 4, '0'),
    "project_id" UUID NOT NULL,
    "carpenter_name" TEXT NOT NULL,
    "work_description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "payment_date" DATE NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labour_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_client_code_key" ON "clients"("client_code");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_code_key" ON "projects"("project_code");

-- CreateIndex
CREATE UNIQUE INDEX "work_items_work_code_key" ON "work_items"("work_code");

-- CreateIndex
CREATE UNIQUE INDEX "material_purchases_material_code_key" ON "material_purchases"("material_code");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payment_code_key" ON "payments"("payment_code");

-- CreateIndex
CREATE UNIQUE INDEX "labour_costs_labour_code_key" ON "labour_costs"("labour_code");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labour_costs" ADD CONSTRAINT "labour_costs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
