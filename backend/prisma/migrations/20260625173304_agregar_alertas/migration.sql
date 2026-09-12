-- CreateEnum
CREATE TYPE "SeveridadAlerta" AS ENUM ('info', 'warning', 'critica');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('clima', 'agua', 'plaga', 'vencimiento', 'general');

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "tipo" "TipoAlerta" NOT NULL DEFAULT 'general',
    "severidad" "SeveridadAlerta" NOT NULL DEFAULT 'info',
    "titulo" TEXT NOT NULL,
    "detalle" TEXT,
    "contexto" JSONB,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alertas_cuenta_id_leida_idx" ON "alertas"("cuenta_id", "leida");

-- CreateIndex
CREATE INDEX "alertas_usuario_id_idx" ON "alertas"("usuario_id");

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
