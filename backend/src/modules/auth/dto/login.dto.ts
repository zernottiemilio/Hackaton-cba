import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export class LoginDto extends createZodDto(loginSchema) {}

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken requerido'),
});

export class RefreshDto extends createZodDto(refreshSchema) {}

export const registroSchema = z.object({
  // Cuenta
  nombreCuenta: z.string().trim().min(1, 'Nombre de la cuenta requerido'),
  emailContacto: z.string().email('Email de contacto inválido').toLowerCase().trim().optional(),
  telefono: z.string().trim().optional(),
  // Usuario inicial
  email: z.string().email('Email inválido').toLowerCase().trim(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  nombre: z.string().trim().min(1, 'Nombre del usuario requerido'),
});
export class RegistroDto extends createZodDto(registroSchema) {}

export const actualizarPerfilSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  email: z.string().email().toLowerCase().trim().optional(),
});
export class ActualizarPerfilDto extends createZodDto(actualizarPerfilSchema) {}

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, 'Contraseña actual requerida'),
  passwordNueva: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
});
export class CambiarPasswordDto extends createZodDto(cambiarPasswordSchema) {}

export const activarSchema = z.object({
  token: z.string().min(10, 'Token inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});
export class ActivarDto extends createZodDto(activarSchema) {}
