import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const tenenciaSchema = z.enum(['propio', 'arrendado', 'mixto']);
export const unidadArrendamientoSchema = z.enum(['qq_ha', 'usd_ha', 'pct_produccion']);

export const crearLoteSchema = z
  .object({
    establecimientoId: z.string().uuid('establecimientoId inválido'),
    nombre: z.string().trim().min(1, 'El nombre es requerido'),
    superficieHa: z.coerce.number().positive('La superficie debe ser > 0'),
    tenencia: tenenciaSchema.optional(),
    arrendamientoValor: z.coerce.number().nonnegative().optional(),
    arrendamientoUnidad: unidadArrendamientoSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tenencia === 'arrendado') {
      if (data.arrendamientoValor === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'arrendamientoValor requerido si tenencia=arrendado',
          path: ['arrendamientoValor'],
        });
      }
      if (!data.arrendamientoUnidad) {
        ctx.addIssue({
          code: 'custom',
          message: 'arrendamientoUnidad requerido si tenencia=arrendado',
          path: ['arrendamientoUnidad'],
        });
      }
    }
  });
export class CrearLoteDto extends createZodDto(crearLoteSchema) {}

export const actualizarLoteSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  superficieHa: z.coerce.number().positive().optional(),
  tenencia: tenenciaSchema.optional(),
  arrendamientoValor: z.coerce.number().nonnegative().nullable().optional(),
  arrendamientoUnidad: unidadArrendamientoSchema.nullable().optional(),
});
export class ActualizarLoteDto extends createZodDto(actualizarLoteSchema) {}

export const listarLotesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  establecimientoId: z.string().uuid().optional(),
  activo: z.coerce.boolean().optional(),
});
export type ListarLotesQuery = z.infer<typeof listarLotesSchema>;
