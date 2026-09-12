import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const tipoInsumoSchema = z.enum([
  'semilla', 'fertilizante', 'herbicida', 'insecticida', 'fungicida', 'otro',
]);

export const crearInsumoSchema = z.object({
  nombre: z.string().trim().min(1, 'Nombre requerido').max(120),
  tipo: tipoInsumoSchema,
  unidad: z.string().trim().min(1, 'Unidad requerida').max(20),
  stockActual: z.coerce.number().nonnegative().default(0),
  stockMinimo: z.coerce.number().nonnegative().default(0),
  costoUnitarioUsd: z.coerce.number().nonnegative().optional().nullable(),
  proveedor: z.string().trim().max(120).optional().nullable(),
  nota: z.string().trim().max(2000).optional().nullable(),
});
export class CrearInsumoDto extends createZodDto(crearInsumoSchema) {}

export const actualizarInsumoSchema = crearInsumoSchema.partial();
export class ActualizarInsumoDto extends createZodDto(actualizarInsumoSchema) {}

/** Endpoint dedicado para sumar (o restar) stock por movimientos manuales. */
export const movimientoStockSchema = z.object({
  /** Positivo suma (entrada). Negativo descuenta (ajuste manual). */
  delta: z.coerce.number().refine((n) => n !== 0, 'No puede ser 0'),
  nota: z.string().trim().max(500).optional(),
});
export class MovimientoStockDto extends createZodDto(movimientoStockSchema) {}
