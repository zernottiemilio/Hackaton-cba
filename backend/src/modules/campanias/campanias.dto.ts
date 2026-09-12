import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const tipoCampaniaSchema = z.enum(['fina', 'gruesa']);

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

export const crearCampaniaSchema = z
  .object({
    /** Año calendario. Si no viene, lo derivamos de fechaInicio. */
    anio: z.coerce.number().int().min(2000).max(2100).optional(),
    /** Fina (invierno) o gruesa (verano). */
    temporada: tipoCampaniaSchema.optional(),
    nombre: z.string().trim().min(1, 'El nombre es requerido'),
    /** LEGACY: alias de temporada para compat. */
    tipo: tipoCampaniaSchema.optional(),
    fechaInicio: fechaIso,
    fechaFin: fechaIso.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.fechaFin && d.fechaFin < d.fechaInicio) {
      ctx.addIssue({
        code: 'custom',
        message: 'fechaFin debe ser >= fechaInicio',
        path: ['fechaFin'],
      });
    }
  });
export class CrearCampaniaDto extends createZodDto(crearCampaniaSchema) {}

export const actualizarCampaniaSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  temporada: tipoCampaniaSchema.nullable().optional(),
  nombre: z.string().trim().min(1).optional(),
  tipo: tipoCampaniaSchema.nullable().optional(),
  fechaInicio: fechaIso.optional(),
  fechaFin: fechaIso.nullable().optional(),
});
export class ActualizarCampaniaDto extends createZodDto(actualizarCampaniaSchema) {}
