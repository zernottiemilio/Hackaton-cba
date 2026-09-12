import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const tenenciaSchema = z.enum(['propio', 'arrendado', 'mixto']);
export const unidadArrendamientoSchema = z.enum(['qq_ha', 'usd_ha', 'pct_produccion']);
export const capacidadUsoSchema = z.enum([
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'desconocida',
]);

export const crearEstablecimientoSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es requerido'),
    ubicacion: z.string().trim().optional(),
    latitud: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitud: z.coerce.number().min(-180).max(180).optional().nullable(),
    tenencia: tenenciaSchema.default('propio'),
    arrendamientoValor: z.coerce.number().nonnegative().optional().nullable(),
    arrendamientoUnidad: unidadArrendamientoSchema.optional().nullable(),
    superficieTotalHa: z.coerce.number().positive('Debe ser > 0').optional(),
    capacidadUso: capacidadUsoSchema.optional().nullable(),
  })
  .superRefine((d, ctx) => {
    if (d.tenencia === 'arrendado' || d.tenencia === 'mixto') {
      if (d.arrendamientoValor === undefined || d.arrendamientoValor === null) {
        ctx.addIssue({
          code: 'custom',
          message: 'arrendamientoValor requerido cuando hay arrendamiento',
          path: ['arrendamientoValor'],
        });
      }
      if (!d.arrendamientoUnidad) {
        ctx.addIssue({
          code: 'custom',
          message: 'arrendamientoUnidad requerida cuando hay arrendamiento',
          path: ['arrendamientoUnidad'],
        });
      }
    }
  });
export class CrearEstablecimientoDto extends createZodDto(crearEstablecimientoSchema) {}

export const actualizarEstablecimientoSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  ubicacion: z.string().trim().nullable().optional(),
  latitud: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitud: z.coerce.number().min(-180).max(180).nullable().optional(),
  tenencia: tenenciaSchema.optional(),
  arrendamientoValor: z.coerce.number().nonnegative().nullable().optional(),
  arrendamientoUnidad: unidadArrendamientoSchema.nullable().optional(),
  superficieTotalHa: z.coerce.number().positive().nullable().optional(),
  capacidadUso: capacidadUsoSchema.nullable().optional(),
});
export class ActualizarEstablecimientoDto extends createZodDto(actualizarEstablecimientoSchema) {}
