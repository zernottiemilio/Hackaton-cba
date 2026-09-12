-- La comisión de plataforma deja de ser solo un asiento contable: se transfiere
-- en USDC a la tesorería y se guarda la signature de esa transferencia.

ALTER TABLE "comisiones_plataforma"
  ADD COLUMN "tx_comision" TEXT,
  ADD COLUMN "tesoreria_address" TEXT;
