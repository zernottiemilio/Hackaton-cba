import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const crearConversacionSchema = z.object({
  titulo: z.string().trim().min(1).max(120).optional(),
});
export class CrearConversacionDto extends createZodDto(crearConversacionSchema) {}

export const enviarMensajeSchema = z.object({
  contenido: z.string().trim().min(1, 'No puede estar vacío').max(8000, 'Mensaje demasiado largo'),
});
export class EnviarMensajeDto extends createZodDto(enviarMensajeSchema) {}

export const renombrarConversacionSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
});
export class RenombrarConversacionDto extends createZodDto(renombrarConversacionSchema) {}
