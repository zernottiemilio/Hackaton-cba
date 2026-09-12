-- Comisión de plataforma (1,5%) — auditoría inmutable de cada cobro
-- que Harvest.fi le retiene a compradores y vendedores en el flujo de
-- tokenización. Se inserta en la misma transacción que la operación que la
-- origina (confirmarCompra / liberarFondos).

-- CreateEnum
CREATE TYPE "TipoComisionPlataforma" AS ENUM ('compra_inversor', 'cobro_productor');

-- CreateTable
CREATE TABLE "comisiones_plataforma" (
    "id" TEXT NOT NULL,
    "tokenizacion_id" TEXT NOT NULL,
    "tenencia_id" TEXT,
    "tipo" "TipoComisionPlataforma" NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "wallet_address" TEXT,
    "monto_bruto_usd" DECIMAL(14,4) NOT NULL,
    "porcentaje" DECIMAL(5,4) NOT NULL,
    "monto_comision_usd" DECIMAL(14,4) NOT NULL,
    "monto_neto_usd" DECIMAL(14,4) NOT NULL,
    "tx_referencia" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comisiones_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comisiones_plataforma_tokenizacion_id_idx" ON "comisiones_plataforma"("tokenizacion_id");

-- CreateIndex
CREATE INDEX "comisiones_plataforma_usuario_id_idx" ON "comisiones_plataforma"("usuario_id");

-- CreateIndex
CREATE INDEX "comisiones_plataforma_tipo_created_at_idx" ON "comisiones_plataforma"("tipo", "created_at");

-- AddForeignKey
ALTER TABLE "comisiones_plataforma" ADD CONSTRAINT "comisiones_plataforma_tokenizacion_id_fkey" FOREIGN KEY ("tokenizacion_id") REFERENCES "tokenizaciones_campana"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones_plataforma" ADD CONSTRAINT "comisiones_plataforma_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
