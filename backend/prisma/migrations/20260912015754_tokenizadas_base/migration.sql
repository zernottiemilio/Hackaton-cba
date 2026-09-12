-- CreateEnum
CREATE TYPE "RolTokenizacion" AS ENUM ('productor', 'inversor', 'acopio', 'admin_plataforma');

-- CreateEnum
CREATE TYPE "EstadoCampanaToken" AS ENUM ('borrador', 'en_revision', 'rechazada', 'abierta', 'fondeada', 'en_curso', 'en_cosecha', 'liquidada', 'cancelada');

-- CreateEnum
CREATE TYPE "ModoTokenizacionTipo" AS ENUM ('porcentual', 'fijo');

-- CreateEnum
CREATE TYPE "FuentePrecio" AS ENUM ('pizarra_rosario', 'matba_futuro', 'manual');

-- CreateEnum
CREATE TYPE "EstadoTenencia" AS ENUM ('activa', 'liquidada', 'en_disputa');

-- CreateEnum
CREATE TYPE "NivelIntegracion" AS ENUM ('manual', 'portal', 'api', 'arca_delegado');

-- CreateEnum
CREATE TYPE "SisaEstado" AS ENUM ('uno', 'dos', 'tres', 'cuatro');

-- CreateEnum
CREATE TYPE "EstadoAfectacion" AS ENUM ('vigente', 'cumplida', 'incumplida', 'en_disputa');

-- CreateEnum
CREATE TYPE "SemaforoAfectacion" AS ENUM ('verde', 'amarillo', 'rojo');

-- CreateEnum
CREATE TYPE "EstadoConciliacion" AS ENUM ('pendiente', 'conciliado', 'desvio', 'huerfano');

-- CreateEnum
CREATE TYPE "MotivoLiberacion" AS ENUM ('excedente', 'campana_liquidada', 'autorizacion_admin');

-- CreateEnum
CREATE TYPE "OrigenCargaMovimiento" AS ENUM ('acopio', 'admin', 'api');

-- AlterTable
ALTER TABLE "campanias" ADD COLUMN     "ciclo_agricola" TEXT,
ADD COLUMN     "cultivo_id" TEXT,
ADD COLUMN     "establecimiento_id" TEXT,
ADD COLUMN     "estado_token" "EstadoCampanaToken",
ADD COLUMN     "fecha_cosecha_estimada" DATE,
ADD COLUMN     "fecha_siembra_estimada" DATE,
ADD COLUMN     "hectareas_afectadas" DECIMAL(12,4),
ADD COLUMN     "rinde_estimado_tn_ha" DECIMAL(10,4),
ADD COLUMN     "rinde_real_tn_ha" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "establecimientos" ADD COLUMN     "acopio_habitual_id" TEXT,
ADD COLUMN     "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "geometria" JSONB,
ADD COLUMN     "partido" TEXT,
ADD COLUMN     "provincia" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "acopio_id" TEXT,
ADD COLUMN     "contextos_tokenizacion" "RolTokenizacion"[] DEFAULT ARRAY[]::"RolTokenizacion"[],
ADD COLUMN     "wallet_address" TEXT;

-- CreateTable
CREATE TABLE "acopios" (
    "id" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "sisa_estado" "SisaEstado" NOT NULL DEFAULT 'uno',
    "sisa_ultima_verificacion" TIMESTAMP(3),
    "convenio_marco_firmado" BOOLEAN NOT NULL DEFAULT false,
    "convenio_url" TEXT,
    "nivel_integracion" "NivelIntegracion" NOT NULL DEFAULT 'manual',
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acopios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantas" (
    "id" TEXT NOT NULL,
    "acopio_id" TEXT NOT NULL,
    "numero_planta_sisa" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "localidad" TEXT,
    "provincia" TEXT,
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "capacidad_tn" DECIMAL(14,4),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokenizaciones_campana" (
    "id" TEXT NOT NULL,
    "campania_id" TEXT NOT NULL,
    "productor_id" TEXT NOT NULL,
    "modo" "ModoTokenizacionTipo" NOT NULL,
    "porcentaje" DECIMAL(5,2),
    "toneladas_fijas" DECIMAL(12,4),
    "toneladas_ofrecidas" DECIMAL(12,4) NOT NULL,
    "tokens_emitidos" DECIMAL(12,4) NOT NULL,
    "tokens_vendidos" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "fuente_precio" "FuentePrecio" NOT NULL DEFAULT 'manual',
    "precio_referencia_usd_tn" DECIMAL(14,4) NOT NULL,
    "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "precio_token_usd" DECIMAL(14,4) NOT NULL,
    "precio_dinamico" BOOLEAN NOT NULL DEFAULT false,
    "precio_piso_usd" DECIMAL(14,4),
    "fondeo_desde" DATE NOT NULL,
    "fondeo_hasta" DATE NOT NULL,
    "monto_objetivo_usd" DECIMAL(14,2) NOT NULL,
    "monto_recaudado_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tiene_seguro_granizo" BOOLEAN NOT NULL DEFAULT false,
    "tiene_seguro_parametrico" BOOLEAN NOT NULL DEFAULT false,
    "tiene_aval_sgr" BOOLEAN NOT NULL DEFAULT false,
    "sobrecolateral_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "mint_address" TEXT,
    "vault_address" TEXT,
    "tx_signature_publicacion" TEXT,
    "aprobada_en" TIMESTAMP(3),
    "aprobada_por" TEXT,
    "rechazada_en" TIMESTAMP(3),
    "motivo_rechazo" TEXT,
    "precio_liquidacion_usd_tn" DECIMAL(14,4),
    "fecha_liquidacion" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokenizaciones_campana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenencias_token" (
    "id" TEXT NOT NULL,
    "tokenizacion_id" TEXT NOT NULL,
    "inversor_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "tokens" DECIMAL(12,4) NOT NULL,
    "precio_compra_usd" DECIMAL(14,4) NOT NULL,
    "monto_total_usd" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoTenencia" NOT NULL DEFAULT 'activa',
    "tx_signature_compra" TEXT,
    "tx_signature_cobro" TEXT,
    "usdc_recibido" DECIMAL(14,2),
    "fecha_cobro" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenencias_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_token" (
    "id" TEXT NOT NULL,
    "tokenizacion_id" TEXT NOT NULL,
    "inversor_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "tokens" DECIMAL(12,4) NOT NULL,
    "precio_usd_snapshot" DECIMAL(14,4) NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "confirmada" BOOLEAN NOT NULL DEFAULT false,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "afectaciones_grano" (
    "id" TEXT NOT NULL,
    "campania_id" TEXT NOT NULL,
    "acopio_id" TEXT NOT NULL,
    "planta_id" TEXT NOT NULL,
    "toneladas_comprometidas" DECIMAL(14,4) NOT NULL,
    "toneladas_recibidas" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "toneladas_liberadas" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "estado" "EstadoAfectacion" NOT NULL DEFAULT 'vigente',
    "cesion_notificada" BOOLEAN NOT NULL DEFAULT false,
    "fecha_notificacion" TIMESTAMP(3),
    "semaforo" "SemaforoAfectacion" NOT NULL DEFAULT 'verde',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "afectaciones_grano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_grano" (
    "id" TEXT NOT NULL,
    "afectacion_id" TEXT,
    "ctg" TEXT NOT NULL,
    "cpe_numero" TEXT NOT NULL,
    "fecha_emision" DATE NOT NULL,
    "origen_cuit" TEXT NOT NULL,
    "destino_cuit" TEXT NOT NULL,
    "destino_planta_sisa" TEXT,
    "toneladas_declaradas" DECIMAL(14,4) NOT NULL,
    "toneladas_pesadas" DECIMAL(14,4),
    "humedad_pct" DECIMAL(5,2),
    "merma_tn" DECIMAL(10,4),
    "estado_conciliacion" "EstadoConciliacion" NOT NULL DEFAULT 'pendiente',
    "origen_carga" "OrigenCargaMovimiento" NOT NULL DEFAULT 'acopio',
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimientos_grano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificaciones_deposito" (
    "id" TEXT NOT NULL,
    "afectacion_id" TEXT NOT NULL,
    "movimiento_id" TEXT NOT NULL,
    "numero_comprobante" TEXT NOT NULL,
    "toneladas" DECIMAL(14,4) NOT NULL,
    "fecha" DATE NOT NULL,
    "archivo_url" TEXT NOT NULL,
    "cargada_por" "OrigenCargaMovimiento" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificaciones_deposito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liberaciones" (
    "id" TEXT NOT NULL,
    "afectacion_id" TEXT NOT NULL,
    "toneladas" DECIMAL(14,4) NOT NULL,
    "motivo" "MotivoLiberacion" NOT NULL,
    "autorizada_por" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liberaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acopios_cuit_key" ON "acopios"("cuit");

-- CreateIndex
CREATE INDEX "acopios_cuit_idx" ON "acopios"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "plantas_numero_planta_sisa_key" ON "plantas"("numero_planta_sisa");

-- CreateIndex
CREATE INDEX "plantas_acopio_id_idx" ON "plantas"("acopio_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokenizaciones_campana_campania_id_key" ON "tokenizaciones_campana"("campania_id");

-- CreateIndex
CREATE INDEX "tokenizaciones_campana_productor_id_idx" ON "tokenizaciones_campana"("productor_id");

-- CreateIndex
CREATE INDEX "tenencias_token_tokenizacion_id_idx" ON "tenencias_token"("tokenizacion_id");

-- CreateIndex
CREATE INDEX "tenencias_token_inversor_id_idx" ON "tenencias_token"("inversor_id");

-- CreateIndex
CREATE INDEX "tenencias_token_wallet_address_idx" ON "tenencias_token"("wallet_address");

-- CreateIndex
CREATE INDEX "reservas_token_tokenizacion_id_expira_en_idx" ON "reservas_token"("tokenizacion_id", "expira_en");

-- CreateIndex
CREATE INDEX "reservas_token_inversor_id_idx" ON "reservas_token"("inversor_id");

-- CreateIndex
CREATE INDEX "afectaciones_grano_campania_id_idx" ON "afectaciones_grano"("campania_id");

-- CreateIndex
CREATE INDEX "afectaciones_grano_acopio_id_idx" ON "afectaciones_grano"("acopio_id");

-- CreateIndex
CREATE INDEX "afectaciones_grano_planta_id_idx" ON "afectaciones_grano"("planta_id");

-- CreateIndex
CREATE INDEX "afectaciones_grano_semaforo_idx" ON "afectaciones_grano"("semaforo");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_grano_ctg_key" ON "movimientos_grano"("ctg");

-- CreateIndex
CREATE INDEX "movimientos_grano_afectacion_id_idx" ON "movimientos_grano"("afectacion_id");

-- CreateIndex
CREATE INDEX "movimientos_grano_ctg_idx" ON "movimientos_grano"("ctg");

-- CreateIndex
CREATE INDEX "movimientos_grano_estado_conciliacion_idx" ON "movimientos_grano"("estado_conciliacion");

-- CreateIndex
CREATE UNIQUE INDEX "certificaciones_deposito_numero_comprobante_key" ON "certificaciones_deposito"("numero_comprobante");

-- CreateIndex
CREATE INDEX "certificaciones_deposito_afectacion_id_idx" ON "certificaciones_deposito"("afectacion_id");

-- CreateIndex
CREATE INDEX "liberaciones_afectacion_id_idx" ON "liberaciones"("afectacion_id");

-- CreateIndex
CREATE INDEX "campanias_establecimiento_id_idx" ON "campanias"("establecimiento_id");

-- CreateIndex
CREATE INDEX "campanias_estado_token_idx" ON "campanias"("estado_token");

-- CreateIndex
CREATE INDEX "establecimientos_acopio_habitual_id_idx" ON "establecimientos"("acopio_habitual_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_wallet_address_key" ON "usuarios"("wallet_address");

-- CreateIndex
CREATE INDEX "usuarios_wallet_address_idx" ON "usuarios"("wallet_address");

-- CreateIndex
CREATE INDEX "usuarios_acopio_id_idx" ON "usuarios"("acopio_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_acopio_id_fkey" FOREIGN KEY ("acopio_id") REFERENCES "acopios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establecimientos" ADD CONSTRAINT "establecimientos_acopio_habitual_id_fkey" FOREIGN KEY ("acopio_habitual_id") REFERENCES "acopios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanias" ADD CONSTRAINT "campanias_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanias" ADD CONSTRAINT "campanias_cultivo_id_fkey" FOREIGN KEY ("cultivo_id") REFERENCES "cultivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantas" ADD CONSTRAINT "plantas_acopio_id_fkey" FOREIGN KEY ("acopio_id") REFERENCES "acopios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokenizaciones_campana" ADD CONSTRAINT "tokenizaciones_campana_campania_id_fkey" FOREIGN KEY ("campania_id") REFERENCES "campanias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokenizaciones_campana" ADD CONSTRAINT "tokenizaciones_campana_productor_id_fkey" FOREIGN KEY ("productor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenencias_token" ADD CONSTRAINT "tenencias_token_tokenizacion_id_fkey" FOREIGN KEY ("tokenizacion_id") REFERENCES "tokenizaciones_campana"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenencias_token" ADD CONSTRAINT "tenencias_token_inversor_id_fkey" FOREIGN KEY ("inversor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afectaciones_grano" ADD CONSTRAINT "afectaciones_grano_campania_id_fkey" FOREIGN KEY ("campania_id") REFERENCES "campanias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afectaciones_grano" ADD CONSTRAINT "afectaciones_grano_acopio_id_fkey" FOREIGN KEY ("acopio_id") REFERENCES "acopios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afectaciones_grano" ADD CONSTRAINT "afectaciones_grano_planta_id_fkey" FOREIGN KEY ("planta_id") REFERENCES "plantas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_grano" ADD CONSTRAINT "movimientos_grano_afectacion_id_fkey" FOREIGN KEY ("afectacion_id") REFERENCES "afectaciones_grano"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificaciones_deposito" ADD CONSTRAINT "certificaciones_deposito_afectacion_id_fkey" FOREIGN KEY ("afectacion_id") REFERENCES "afectaciones_grano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificaciones_deposito" ADD CONSTRAINT "certificaciones_deposito_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos_grano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liberaciones" ADD CONSTRAINT "liberaciones_afectacion_id_fkey" FOREIGN KEY ("afectacion_id") REFERENCES "afectaciones_grano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

