-- AlterTable
ALTER TABLE "campanias" ADD COLUMN     "anio" INTEGER,
ADD COLUMN     "temporada" "TipoCampania";

-- BACKFILL: temporada hereda de tipo (legacy); anio se deriva de fechaInicio
-- (para gruesa que cruza el año, usamos el año de siembra como ancla).
UPDATE "campanias"
SET "temporada" = "tipo"
WHERE "temporada" IS NULL AND "tipo" IS NOT NULL;

UPDATE "campanias"
SET "anio" = EXTRACT(YEAR FROM "fecha_inicio")::INTEGER
WHERE "anio" IS NULL;

-- CreateIndex
CREATE INDEX "campanias_cuenta_id_anio_temporada_idx" ON "campanias"("cuenta_id", "anio", "temporada");
