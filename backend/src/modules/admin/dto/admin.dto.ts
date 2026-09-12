import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// Stubs — todavía sin implementación real. Los schemas quedan listos
// para cuando definamos endpoints concretos.

export const crearCuentaSchema = z.object({
  nombreCuenta: z.string().trim().min(1, 'Nombre de la cuenta requerido'),
  emailContacto: z.string().email('Email inválido').toLowerCase().trim().optional(),
  telefono: z.string().trim().optional(),
  // Primer ingeniero a invitar (opcional — la cuenta puede crearse vacía).
  ingenieroEmail: z.string().email('Email inválido').toLowerCase().trim().optional(),
  ingenieroNombre: z.string().trim().min(1).optional(),
});
export class CrearCuentaDto extends createZodDto(crearCuentaSchema) {}

export const invitarUsuarioSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  nombre: z.string().trim().min(1, 'Nombre requerido'),
  cuentaId: z.string().uuid('cuentaId inválido'),
  rol: z.enum(['ingeniero', 'propietario', 'operador']),
});
export class InvitarUsuarioDto extends createZodDto(invitarUsuarioSchema) {}

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  email: z.string().email('Email inválido').toLowerCase().trim().optional(),
  rolGlobal: z.enum(['superadmin', 'ingeniero', 'propietario']).optional(),
});
export class ActualizarUsuarioDto extends createZodDto(actualizarUsuarioSchema) {}

export const actualizarCuentaSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  emailContacto: z.string().email('Email inválido').toLowerCase().trim().optional().or(z.literal('')),
  telefono: z.string().trim().optional().or(z.literal('')),
});
export class ActualizarCuentaDto extends createZodDto(actualizarCuentaSchema) {}

export const actualizarMembresiaSchema = z.object({
  rol: z.enum(['ingeniero', 'propietario', 'operador']),
});
export class ActualizarMembresiaDto extends createZodDto(actualizarMembresiaSchema) {}
