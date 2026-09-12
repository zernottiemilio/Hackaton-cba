import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const tipoInsumoSchema = z.enum([
  'semilla',
  'fertilizante',
  'herbicida',
  'insecticida',
  'fungicida',
  'otro',
]);
export const formaPagoSchema = z.enum(['contado', 'canje', 'financiado']);

export const crearInsumoAplicadoSchema = z.object({
  loteCampaniaId: z.string().uuid('loteCampaniaId inválido'),
  /** FK opcional al catálogo de insumos. Si presente, descuenta stock. */
  insumoId: z.string().uuid().optional().nullable(),
  tipo: tipoInsumoSchema,
  producto: z.string().trim().min(1, 'producto requerido'),
  cantidad: z.coerce.number().positive('cantidad debe ser > 0'),
  unidad: z.string().trim().min(1, 'unidad requerida'),
  costoTotalUsd: z.coerce.number().nonnegative('costo debe ser >= 0'),
  formaPago: formaPagoSchema.optional(),
});
export class CrearInsumoAplicadoDto extends createZodDto(crearInsumoAplicadoSchema) {}

export const actualizarInsumoAplicadoSchema = z.object({
  insumoId: z.string().uuid().optional().nullable(),
  tipo: tipoInsumoSchema.optional(),
  producto: z.string().trim().min(1).optional(),
  cantidad: z.coerce.number().positive().optional(),
  unidad: z.string().trim().min(1).optional(),
  costoTotalUsd: z.coerce.number().nonnegative().optional(),
  formaPago: formaPagoSchema.nullable().optional(),
});
export class ActualizarInsumoAplicadoDto extends createZodDto(actualizarInsumoAplicadoSchema) {}

export const listarInsumosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  loteCampaniaId: z.string().uuid().optional(),
  tipo: tipoInsumoSchema.optional(),
  activo: z.coerce.boolean().optional(),
});
export type ListarInsumosQuery = z.infer<typeof listarInsumosSchema>;
