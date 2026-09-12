-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "rol_plataforma" "RolTokenizacion";

-- Backfill: para los usuarios que ya venían con `contextos_tokenizacion` desde la
-- migración anterior, el `rol_plataforma` toma el primer contexto declarado.
-- Los usuarios sin contexto (superadmin, ingenieros del MVP) quedan en NULL y se
-- resuelve en el seed / al primer login.
UPDATE "usuarios"
SET "rol_plataforma" = "contextos_tokenizacion"[1]
WHERE cardinality("contextos_tokenizacion") > 0
  AND "rol_plataforma" IS NULL;

