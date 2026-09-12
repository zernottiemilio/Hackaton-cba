-- fondeo_desde / fondeo_hasta pasan de DATE a TIMESTAMP(3).
-- fondeo_hasta es el sale_end on-chain: el programa exige now < sale_end < settlement_date
-- e invest solo antes de sale_end. Con DATE (medianoche) era imposible crear, vender y
-- liquidar en la misma sesión. Los valores existentes quedan a las 00:00 de su día.

ALTER TABLE "tokenizaciones_campana"
  ALTER COLUMN "fondeo_desde" TYPE TIMESTAMP(3),
  ALTER COLUMN "fondeo_hasta" TYPE TIMESTAMP(3);
