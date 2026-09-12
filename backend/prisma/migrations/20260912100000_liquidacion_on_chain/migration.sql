-- Campos para exponer release_funds y settle como pasos propios (VAL-12).
-- fecha_liquidacion y precio_liquidacion_usd_tn ya existían.

ALTER TABLE "tokenizaciones_campana"
  ADD COLUMN "tx_signature_liberacion" TEXT,
  ADD COLUMN "fondos_liberados_en" TIMESTAMP(3),
  ADD COLUMN "toneladas_entregadas" DECIMAL(12,4),
  ADD COLUMN "payout_por_token_usd" DECIMAL(14,6),
  ADD COLUMN "tx_signature_liquidacion" TEXT,
  ADD COLUMN "liquidada_en" TIMESTAMP(3);
