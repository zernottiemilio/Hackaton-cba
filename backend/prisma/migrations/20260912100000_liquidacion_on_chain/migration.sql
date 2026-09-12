-- Campos para exponer release_funds y settle como pasos propios (VAL-12).
-- precio_liquidacion_usd_tn ya existía; liquidada_en la creó VAL-11 renombrando
-- fecha_liquidacion; fecha_liquidacion_estimada y toneladas_minimas son de VAL-11.

ALTER TABLE "tokenizaciones_campana"
  ADD COLUMN "tx_signature_liberacion" TEXT,
  ADD COLUMN "fondos_liberados_en" TIMESTAMP(3),
  ADD COLUMN "toneladas_entregadas" DECIMAL(12,4),
  ADD COLUMN "payout_por_token_usd" DECIMAL(14,6),
  ADD COLUMN "tx_signature_liquidacion" TEXT;
