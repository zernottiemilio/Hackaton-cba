import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const modoTokenizacion = z.enum(['porcentual', 'fijo']);
const fuentePrecio = z.enum(['pizarra_rosario', 'matba_futuro', 'manual']);
const estadoCampanaToken = z.enum([
  'borrador',
  'en_revision',
  'rechazada',
  'abierta',
  'fondeada',
  'en_curso',
  'en_cosecha',
  'liquidada',
  'cancelada',
]);

/** Payload del wizard de tokenización (pasos 1 + 2 + 3 + 4). */
export const CrearTokenizacionSchema = z.object({
  // Campania: puede referenciar una existente o crear una nueva inline.
  campaniaId: z.string().uuid().optional(),
  campaniaNueva: z
    .object({
      nombre: z.string().min(3),
      establecimientoId: z.string().uuid(),
      cultivoId: z.string().uuid(),
      cicloAgricola: z.string().min(4), // "2026/27"
      hectareasAfectadas: z.number().positive(),
      fechaSiembraEstimada: z.string().datetime().or(z.string().date()),
      fechaCosechaEstimada: z.string().datetime().or(z.string().date()),
      rindeEstimadoTnHa: z.number().positive(),
    })
    .optional(),

  // Modo (paso 2)
  modo: modoTokenizacion,
  porcentaje: z.number().min(0).max(100).optional(),
  toneladasFijas: z.number().positive().optional(),

  // Cotización (paso 3)
  fuentePrecio,
  precioReferenciaUsdTn: z.number().positive(),
  descuentoPct: z.number().min(0).max(20).default(0),
  precioDinamico: z.boolean().default(false),
  precioPisoUsd: z.number().positive().optional(),

  // Ventana de fondeo (paso 3)
  fondeoDesde: z.string().datetime().or(z.string().date()),
  fondeoHasta: z.string().datetime().or(z.string().date()),
  /// Fecha objetivo para settle on-chain. Si no se pasa, publicarCampana()
  /// usa fondeoHasta + 90 días. Para el ensayo/demo se puede mandar
  /// `now + 60s` en formato ISO 8601.
  fechaLiquidacionEstimada: z.string().datetime().optional(),
  /// Piso de toneladas para que release_funds sea legal. Default 1.
  toneladasMinimas: z.number().positive().optional(),

  // Garantías (paso 4)
  tieneSeguroGranizo: z.boolean().default(false),
  tieneSeguroParametrico: z.boolean().default(false),
  tieneAvalSgr: z.boolean().default(false),
  sobrecolateralPct: z.number().min(0).max(100).default(0),
})
  .refine(
    (data) => data.campaniaId || data.campaniaNueva,
    'Debe indicar campaniaId o campaniaNueva',
  )
  .refine(
    (data) => (data.modo === 'porcentual' ? data.porcentaje !== undefined : true),
    'Modo porcentual requiere porcentaje',
  )
  .refine(
    (data) => (data.modo === 'fijo' ? data.toneladasFijas !== undefined : true),
    'Modo fijo requiere toneladasFijas',
  );

export class CrearTokenizacionDto extends createZodDto(CrearTokenizacionSchema) {}

/** Publicar (enviar a revisión) — el productor firma la tx on-chain. */
export const PublicarTokenizacionSchema = z.object({
  productorWallet: z.string().min(32).max(64),
});
export class PublicarTokenizacionDto extends createZodDto(PublicarTokenizacionSchema) {}

/** Aprobación o rechazo por parte del ADMIN. */
export const RevisarTokenizacionSchema = z.object({
  decision: z.enum(['aprobar', 'rechazar']),
  motivoRechazo: z.string().min(3).optional(),
});
export class RevisarTokenizacionDto extends createZodDto(RevisarTokenizacionSchema) {}

/** Compra de tokens por parte del inversor. */
export const CrearReservaSchema = z.object({
  tokenizacionId: z.string().uuid(),
  cantidad: z.number().positive(),
  inversorWallet: z.string().min(32).max(64),
});
export class CrearReservaDto extends createZodDto(CrearReservaSchema) {}

export const ConfirmarCompraSchema = z.object({
  reservaId: z.string().uuid(),
});
export class ConfirmarCompraDto extends createZodDto(ConfirmarCompraSchema) {}

/** Reclamo de USDC al liquidar la campaña. */
export const ReclamarSchema = z.object({
  tenenciaId: z.string().uuid(),
  inversorWallet: z.string().min(32).max(64),
});
export class ReclamarDto extends createZodDto(ReclamarSchema) {}

/** Liquidación (settle) por parte del ADMIN en nombre del acopio. */
export const LiquidarTokenizacionSchema = z.object({
  /** tons_delivered: entero, 1 token = 1 tonelada. Puede ser menor a lo vendido. */
  toneladasEntregadas: z.number().int().positive(),
  /** settlement_price en USD por tonelada. */
  precioLiquidacionUsdTn: z.number().positive(),
});
export class LiquidarTokenizacionDto extends createZodDto(LiquidarTokenizacionSchema) {}

/** Filtros del marketplace de campañas abiertas. */
export const ListarMarketplaceSchema = z.object({
  cultivo: z.string().optional(),
  provincia: z.string().optional(),
  modo: modoTokenizacion.optional(),
  precioMin: z.coerce.number().optional(),
  precioMax: z.coerce.number().optional(),
  descuentoMin: z.coerce.number().optional(),
  soloConGarantias: z.coerce.boolean().optional(),
  orden: z.enum(['cierra_pronto', 'mayor_descuento', 'menor_riesgo', 'recientes']).default('cierra_pronto'),
});
export class ListarMarketplaceDto extends createZodDto(ListarMarketplaceSchema) {}

export { estadoCampanaToken };
