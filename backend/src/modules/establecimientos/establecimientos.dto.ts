import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const tenenciaSchema = z.enum(['propio', 'arrendado', 'mixto']);

export const crearEstablecimientoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  ubicacion: z.string().trim().optional(),
  latitud: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitud: z.coerce.number().min(-180).max(180).optional().nullable(),
  tenencia: tenenciaSchema.default('propio'),
  superficieTotalHa: z.coerce.number().positive('Debe ser > 0').optional(),
});
export class CrearEstablecimientoDto extends createZodDto(crearEstablecimientoSchema) {}

export const actualizarEstablecimientoSchema = crearEstablecimientoSchema.partial();
export class ActualizarEstablecimientoDto extends createZodDto(actualizarEstablecimientoSchema) {}
