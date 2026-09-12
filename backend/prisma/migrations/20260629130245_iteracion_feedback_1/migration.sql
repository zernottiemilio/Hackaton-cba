-- CreateEnum
CREATE TYPE "CapacidadUso" AS ENUM ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'desconocida');

-- AlterTable
ALTER TABLE "campanias" ALTER COLUMN "tipo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "establecimientos" ADD COLUMN     "capacidad_uso" "CapacidadUso";

-- AlterTable
ALTER TABLE "labores" ADD COLUMN     "datos" JSONB,
ADD COLUMN     "densidad_sem_ha" DECIMAL(12,4),
ADD COLUMN     "variedad_id" TEXT;

-- AlterTable
ALTER TABLE "lotes_campania" ADD COLUMN     "tipo" "TipoCampania";

-- BACKFILL: cada lote_campania hereda el tipo de su campaña.
UPDATE "lotes_campania" lc
SET "tipo" = c."tipo"
FROM "campanias" c
WHERE lc."campania_id" = c."id" AND lc."tipo" IS NULL;

-- CreateIndex
CREATE INDEX "labores_variedad_id_idx" ON "labores"("variedad_id");

-- AddForeignKey
ALTER TABLE "labores" ADD CONSTRAINT "labores_variedad_id_fkey" FOREIGN KEY ("variedad_id") REFERENCES "variedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
