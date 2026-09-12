import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const tipoEnum = z.enum(['seguimiento', 'prescripcion', 'control_plaga', 'general']);
const urgenciaEnum = z.enum(['baja', 'media', 'alta']);

export const crearMonitoreoSchema = z.object({
  loteCampaniaId: z.string().uuid(),
  tipo: tipoEnum.default('seguimiento'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha YYYY-MM-DD'),
  observaciones: z.string().trim().min(1, 'Observaciones requeridas'),
  prescripcion: z.string().trim().optional(),
  urgencia: urgenciaEnum.default('baja'),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
});
export class CrearMonitoreoDto extends createZodDto(crearMonitoreoSchema) {}

export const actualizarMonitoreoSchema = crearMonitoreoSchema
  .partial()
  .omit({ loteCampaniaId: true });
export class ActualizarMonitoreoDto extends createZodDto(actualizarMonitoreoSchema) {}
