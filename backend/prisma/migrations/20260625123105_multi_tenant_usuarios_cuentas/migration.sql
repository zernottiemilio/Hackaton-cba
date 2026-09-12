-- CreateEnum
CREATE TYPE "RolGlobal" AS ENUM ('superadmin', 'ingeniero', 'propietario');

-- CreateEnum
CREATE TYPE "RolEnCuenta" AS ENUM ('ingeniero', 'propietario', 'operador');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "rol_global" "RolGlobal" NOT NULL DEFAULT 'ingeniero';

-- CreateTable
CREATE TABLE "usuarios_cuentas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "rol" "RolEnCuenta" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usuarios_cuentas_usuario_id_idx" ON "usuarios_cuentas"("usuario_id");

-- CreateIndex
CREATE INDEX "usuarios_cuentas_cuenta_id_idx" ON "usuarios_cuentas"("cuenta_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cuentas_usuario_id_cuenta_id_key" ON "usuarios_cuentas"("usuario_id", "cuenta_id");

-- AddForeignKey
ALTER TABLE "usuarios_cuentas" ADD CONSTRAINT "usuarios_cuentas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_cuentas" ADD CONSTRAINT "usuarios_cuentas_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BACKFILL: cada usuario existente se vuelve "ingeniero" de su cuenta actual.
-- Idempotente vía ON CONFLICT DO NOTHING — si la migración se re-corre no duplica.
INSERT INTO "usuarios_cuentas" ("id", "usuario_id", "cuenta_id", "rol", "activo", "created_at")
SELECT
    gen_random_uuid()::text,
    u.id,
    u.cuenta_id,
    'ingeniero'::"RolEnCuenta",
    TRUE,
    NOW()
FROM "usuarios" u
WHERE u.activo = TRUE
ON CONFLICT ("usuario_id", "cuenta_id") DO NOTHING;
