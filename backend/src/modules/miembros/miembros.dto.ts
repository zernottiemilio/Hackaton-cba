import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { MODULO_IDS } from '../../common/constants/modulos';

const rolSchema = z.enum(['ingeniero', 'propietario', 'operador']);
const modulosSchema = z.array(z.enum(MODULO_IDS)).default([]);

export const invitarMiembroSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  nombre: z.string().trim().min(1, 'Nombre requerido'),
  rol: rolSchema,
  modulosPermitidos: modulosSchema,
});
export class InvitarMiembroDto extends createZodDto(invitarMiembroSchema) {}

export const actualizarMiembroSchema = z.object({
  rol: rolSchema.optional(),
  modulosPermitidos: modulosSchema.optional(),
});
export class ActualizarMiembroDto extends createZodDto(actualizarMiembroSchema) {}
