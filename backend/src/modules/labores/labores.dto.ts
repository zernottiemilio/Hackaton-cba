import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const tipoLaborSchema = z.enum(['siembra', 'pulverizacion', 'fertilizacion', 'cosecha', 'otra']);
export const ejecutorSchema = z.enum(['propio', 'contratista']);
export const formaPagoSchema = z.enum(['contado', 'canje', 'financiado']);

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

/**
 * Datos específicos por tipo de labor. Schema flexible para soportar
 * inputs distintos sin inflar columnas:
 *  - siembra: { espaciamientoCm, profundidadCm }
 *  - pulverizacion/fertilizacion: { producto, dosis, viento, temperatura, modoAplicacion }
 *  - cosecha: { humedadPct, mermaPct }
 */
const datosLaborSchema = z.record(z.string(), z.unknown()).optional().nullable();

export const crearLaborSchema = z.object({
  loteCampaniaId: z.string().uuid('loteCampaniaId inválido'),
  tipo: tipoLaborSchema,
  fecha: fechaIso,
  ejecutor: ejecutorSchema.default('contratista'),
  costoTotalUsd: z.coerce.number().nonnegative().optional(),
  formaPago: formaPagoSchema.optional(),
  nota: z.string().trim().optional(),
  /** Para siembra: densidad en sem/ha. */
  densidadSemHa: z.coerce.number().positive().optional().nullable(),
  /** Para siembra: variedad usada (puede diferir de la del LoteCampania). */
  variedadId: z.string().uuid().optional().nullable(),
  /** Resto de los datos específicos por tipo. */
  datos: datosLaborSchema,
});
export class CrearLaborDto extends createZodDto(crearLaborSchema) {}

export const actualizarLaborSchema = z.object({
  tipo: tipoLaborSchema.optional(),
  fecha: fechaIso.optional(),
  ejecutor: ejecutorSchema.optional(),
  costoTotalUsd: z.coerce.number().nonnegative().nullable().optional(),
  formaPago: formaPagoSchema.nullable().optional(),
  nota: z.string().trim().nullable().optional(),
  densidadSemHa: z.coerce.number().positive().nullable().optional(),
  variedadId: z.string().uuid().nullable().optional(),
  datos: datosLaborSchema,
});
export class ActualizarLaborDto extends createZodDto(actualizarLaborSchema) {}

export const listarLaboresSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  loteCampaniaId: z.string().uuid().optional(),
  tipo: tipoLaborSchema.optional(),
  activo: z.coerce.boolean().optional(),
});
export type ListarLaboresQuery = z.infer<typeof listarLaboresSchema>;
