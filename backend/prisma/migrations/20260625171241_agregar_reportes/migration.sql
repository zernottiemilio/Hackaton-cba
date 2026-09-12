-- CreateEnum
CREATE TYPE "TipoReporte" AS ENUM ('lote_campania', 'campania', 'establecimiento');

-- CreateTable
CREATE TABLE "reportes" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "tipo" "TipoReporte" NOT NULL,
    "titulo" TEXT NOT NULL,
    "parametros" JSONB NOT NULL,
    "datos_snapshot" JSONB NOT NULL,
    "token_publico" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reportes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios_reporte" (
    "id" TEXT NOT NULL,
    "reporte_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_reporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reportes_token_publico_key" ON "reportes"("token_publico");

-- CreateIndex
CREATE INDEX "reportes_cuenta_id_idx" ON "reportes"("cuenta_id");

-- CreateIndex
CREATE INDEX "reportes_token_publico_idx" ON "reportes"("token_publico");

-- CreateIndex
CREATE INDEX "comentarios_reporte_reporte_id_idx" ON "comentarios_reporte"("reporte_id");

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_reporte" ADD CONSTRAINT "comentarios_reporte_reporte_id_fkey" FOREIGN KEY ("reporte_id") REFERENCES "reportes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_reporte" ADD CONSTRAINT "comentarios_reporte_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
