-- CreateEnum
CREATE TYPE "TipoMonitoreo" AS ENUM ('seguimiento', 'prescripcion', 'control_plaga', 'general');

-- CreateEnum
CREATE TYPE "Urgencia" AS ENUM ('baja', 'media', 'alta');

-- CreateTable
CREATE TABLE "monitoreos" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "lote_campania_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "tipo" "TipoMonitoreo" NOT NULL DEFAULT 'seguimiento',
    "fecha" DATE NOT NULL,
    "observaciones" TEXT NOT NULL,
    "prescripcion" TEXT,
    "urgencia" "Urgencia" NOT NULL DEFAULT 'baja',
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoreos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_monitoreo" (
    "id" TEXT NOT NULL,
    "monitoreo_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_monitoreo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitoreos_cuenta_id_idx" ON "monitoreos"("cuenta_id");

-- CreateIndex
CREATE INDEX "monitoreos_lote_campania_id_idx" ON "monitoreos"("lote_campania_id");

-- CreateIndex
CREATE INDEX "monitoreos_autor_id_idx" ON "monitoreos"("autor_id");

-- CreateIndex
CREATE INDEX "fotos_monitoreo_monitoreo_id_idx" ON "fotos_monitoreo"("monitoreo_id");

-- AddForeignKey
ALTER TABLE "monitoreos" ADD CONSTRAINT "monitoreos_lote_campania_id_fkey" FOREIGN KEY ("lote_campania_id") REFERENCES "lotes_campania"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoreos" ADD CONSTRAINT "monitoreos_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_monitoreo" ADD CONSTRAINT "fotos_monitoreo_monitoreo_id_fkey" FOREIGN KEY ("monitoreo_id") REFERENCES "monitoreos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
