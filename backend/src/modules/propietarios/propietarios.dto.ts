import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const crearPropietarioSchema = z.object({
  nombre: z.string().trim().min(1, 'Nombre requerido'),
  email: z.string().email('Email inválido').toLowerCase().trim(),
  /** Password inicial. Si no se manda, el backend genera una aleatoria
   *  y la devuelve UNA SOLA VEZ en la respuesta para que el ingeniero
   *  la copie y se la pase al propietario. */
  password: z.string().min(6, 'Mínimo 6 caracteres').optional(),
});
export class CrearPropietarioDto extends createZodDto(crearPropietarioSchema) {}

export const cambiarPasswordPropietarioSchema = z.object({
  /** Nueva password. Si no se manda, se genera una aleatoria. */
  password: z.string().min(6).optional(),
});
export class CambiarPasswordPropietarioDto extends createZodDto(cambiarPasswordPropietarioSchema) {}
