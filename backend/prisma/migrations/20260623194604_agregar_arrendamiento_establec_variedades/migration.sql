-- AlterTable
ALTER TABLE "establecimientos" ADD COLUMN     "arrendamiento_unidad" "UnidadArrendamiento",
ADD COLUMN     "arrendamiento_valor" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "lotes_campania" ADD COLUMN     "variedad_id" TEXT;

-- CreateTable
CREATE TABLE "variedades" (
    "id" TEXT NOT NULL,
    "cultivo_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variedades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variedades_cultivo_id_idx" ON "variedades"("cultivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "variedades_cultivo_id_nombre_key" ON "variedades"("cultivo_id", "nombre");

-- AddForeignKey
ALTER TABLE "variedades" ADD CONSTRAINT "variedades_cultivo_id_fkey" FOREIGN KEY ("cultivo_id") REFERENCES "cultivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_campania" ADD CONSTRAINT "lotes_campania_variedad_id_fkey" FOREIGN KEY ("variedad_id") REFERENCES "variedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
