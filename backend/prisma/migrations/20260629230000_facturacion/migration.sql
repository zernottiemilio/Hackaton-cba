-- CreateEnum
CREATE TYPE "PlanFacturacion" AS ENUM ('basico', 'pro', 'enterprise', 'custom');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('pendiente', 'pagada', 'vencida', 'anulada');

-- CreateTable
CREATE TABLE "suscripciones_cuenta" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "plan" "PlanFacturacion" NOT NULL DEFAULT 'basico',
    "precio_mensual_usd" DECIMAL(12,2) NOT NULL,
    "dia_vencimiento" INTEGER NOT NULL DEFAULT 10,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "nota_interna" TEXT,
    "iniciada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripciones_cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_cuenta_cuenta_id_key" ON "suscripciones_cuenta"("cuenta_id");

-- AddForeignKey
ALTER TABLE "suscripciones_cuenta" ADD CONSTRAINT "suscripciones_cuenta_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "periodo_mes" INTEGER NOT NULL,
    "periodo_anio" INTEGER NOT NULL,
    "conceptos" JSONB NOT NULL,
    "subtotal_usd" DECIMAL(14,2) NOT NULL,
    "impuestos_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_usd" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'pendiente',
    "emitida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vencimiento" DATE NOT NULL,
    "pagada_en" TIMESTAMP(3),
    "metodo_pago" TEXT,
    "nota_interna" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facturas_numero_key" ON "facturas"("numero");

-- CreateIndex
CREATE INDEX "facturas_estado_idx" ON "facturas"("estado");

-- CreateIndex
CREATE INDEX "facturas_cuenta_id_idx" ON "facturas"("cuenta_id");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_cuenta_id_periodo_mes_periodo_anio_key" ON "facturas"("cuenta_id", "periodo_mes", "periodo_anio");

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
