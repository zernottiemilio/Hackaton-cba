-- Renombramos el `fecha_liquidacion` viejo a `liquidada_en` (era el timestamp
-- de ejecución del settle, no la fecha objetivo — cambio semántico + naming
-- consistente con aprobada_en/rechazada_en).
ALTER TABLE "tokenizaciones_campana"
  RENAME COLUMN "fecha_liquidacion" TO "liquidada_en";

-- Nuevos campos VAL-11: fecha objetivo de settle + piso de toneladas.
ALTER TABLE "tokenizaciones_campana"
  ADD COLUMN "fecha_liquidacion_estimada" TIMESTAMP(3),
  ADD COLUMN "toneladas_minimas" DECIMAL(12,4) NOT NULL DEFAULT 1;
