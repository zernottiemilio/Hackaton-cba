import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const crearConversacionSchema = z.object({
  titulo: z.string().trim().min(1).max(120).optional(),
});
export class CrearConversacionDto extends createZodDto(crearConversacionSchema) {}

export const renombrarConversacionSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
});
export class RenombrarConversacionDto extends createZodDto(renombrarConversacionSchema) {}
