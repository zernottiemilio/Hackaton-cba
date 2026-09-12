import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

export const crearLoteCampaniaSchema = z.object({
  loteId: z.string().uuid('loteId inválido'),
  campaniaId: z.string().uuid('campaniaId inválido'),
  cultivoId: z.string().uuid('cultivoId inválido'),
  superficieSembradaHa: z.coerce.number().positive('Debe ser > 0').max(100000, 'Superficie inusualmente alta'),
  fechaSiembra: fechaIso.optional(),
  rindeEstimadoQqHa: z.coerce
    .number()
    .nonnegative()
    .max(1000, 'Rinde inusualmente alto — recordá que la unidad es qq/ha')
    .optional(),
  precioGranoUsdTn: z.coerce
    .number()
    .positive()
    .max(5000, 'Precio inusualmente alto — la unidad es USD por TONELADA, no por quintal')
    .optional(),
});
export class CrearLoteCampaniaDto extends createZodDto(crearLoteCampaniaSchema) {}

export const actualizarLoteCampaniaSchema = z.object({
  cultivoId: z.string().uuid().optional(),
  superficieSembradaHa: z.coerce.number().positive().max(100000).optional(),
  fechaSiembra: fechaIso.nullable().optional(),
  rindeEstimadoQqHa: z.coerce
    .number()
    .nonnegative()
    .max(1000, 'Rinde inusualmente alto — la unidad es qq/ha')
    .nullable()
    .optional(),
  rindeRealQqHa: z.coerce
    .number()
    .nonnegative()
    .max(1000, 'Rinde inusualmente alto — la unidad es qq/ha')
    .nullable()
    .optional(),
  precioGranoUsdTn: z.coerce
    .number()
    .positive()
    .max(5000, 'Precio inusualmente alto — la unidad es USD por tonelada')
    .nullable()
    .optional(),
  fechaCosecha: fechaIso.nullable().optional(),
});
export class ActualizarLoteCampaniaDto extends createZodDto(actualizarLoteCampaniaSchema) {}

export const listarLotesCampaniaSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  campaniaId: z.string().uuid().optional(),
  loteId: z.string().uuid().optional(),
  cultivoId: z.string().uuid().optional(),
  activo: z.coerce.boolean().optional(),
});
export type ListarLotesCampaniaQuery = z.infer<typeof listarLotesCampaniaSchema>;
