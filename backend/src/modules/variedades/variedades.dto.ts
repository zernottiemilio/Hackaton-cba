import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const crearVariedadSchema = z.object({
  cultivoId: z.string().uuid(),
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(120),
});
export class CrearVariedadDto extends createZodDto(crearVariedadSchema) {}

export const actualizarVariedadSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
});
export class ActualizarVariedadDto extends createZodDto(actualizarVariedadSchema) {}

export const listarVariedadesSchema = z.object({
  cultivoId: z.string().uuid().optional(),
});
export type ListarVariedadesQuery = z.infer<typeof listarVariedadesSchema>;
