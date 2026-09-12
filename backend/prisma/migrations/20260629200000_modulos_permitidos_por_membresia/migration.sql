-- AlterTable
ALTER TABLE "usuarios_cuentas"
  ADD COLUMN "modulos_permitidos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
