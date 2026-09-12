import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const tipoCampaniaSchema = z.enum(['fina', 'gruesa']);

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

export const crearCampaniaSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es requerido'),
    tipo: tipoCampaniaSchema,
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
  nombre: z.string().trim().min(1).optional(),
  tipo: tipoCampaniaSchema.optional(),
  fechaInicio: fechaIso.optional(),
  fechaFin: fechaIso.nullable().optional(),
});
export class ActualizarCampaniaDto extends createZodDto(actualizarCampaniaSchema) {}
