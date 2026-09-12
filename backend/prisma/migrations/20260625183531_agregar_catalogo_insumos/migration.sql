-- AlterEnum
ALTER TYPE "TipoAlerta" ADD VALUE 'stock';

-- AlterTable
ALTER TABLE "insumos_aplicados" ADD COLUMN     "insumo_id" TEXT;

-- CreateTable
CREATE TABLE "insumos" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoInsumo" NOT NULL,
    "unidad" TEXT NOT NULL,
    "stock_actual" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "costo_unitario_usd" DECIMAL(14,4),
    "proveedor" TEXT,
    "nota" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insumos_cuenta_id_idx" ON "insumos"("cuenta_id");

-- CreateIndex
CREATE INDEX "insumos_cuenta_id_nombre_idx" ON "insumos"("cuenta_id", "nombre");

-- CreateIndex
CREATE INDEX "insumos_aplicados_insumo_id_idx" ON "insumos_aplicados"("insumo_id");

-- AddForeignKey
ALTER TABLE "insumos_aplicados" ADD CONSTRAINT "insumos_aplicados_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
