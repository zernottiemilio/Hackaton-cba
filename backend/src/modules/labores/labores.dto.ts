import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const tipoLaborSchema = z.enum(['siembra', 'pulverizacion', 'fertilizacion', 'cosecha', 'otra']);
export const ejecutorSchema = z.enum(['propio', 'contratista']);
export const formaPagoSchema = z.enum(['contado', 'canje', 'financiado']);

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

export const crearLaborSchema = z.object({
  loteCampaniaId: z.string().uuid('loteCampaniaId inválido'),
  tipo: tipoLaborSchema,
  fecha: fechaIso,
  ejecutor: ejecutorSchema.default('contratista'),
  costoTotalUsd: z.coerce.number().nonnegative().optional(),
  formaPago: formaPagoSchema.optional(),
  nota: z.string().trim().optional(),
});
export class CrearLaborDto extends createZodDto(crearLaborSchema) {}

export const actualizarLaborSchema = z.object({
  tipo: tipoLaborSchema.optional(),
  fecha: fechaIso.optional(),
  ejecutor: ejecutorSchema.optional(),
  costoTotalUsd: z.coerce.number().nonnegative().nullable().optional(),
  formaPago: formaPagoSchema.nullable().optional(),
  nota: z.string().trim().nullable().optional(),
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
