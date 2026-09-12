import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const planSchema = z.enum(['basico', 'pro', 'enterprise', 'custom']);

export const setearSuscripcionSchema = z.object({
  plan: planSchema,
  precioMensualUsd: z.coerce.number().nonnegative(),
  diaVencimiento: z.coerce.number().int().min(1).max(28).default(10),
  activa: z.boolean().default(true),
  notaInterna: z.string().trim().optional(),
});
export class SetearSuscripcionDto extends createZodDto(setearSuscripcionSchema) {}

const conceptoSchema = z.object({
  descripcion: z.string().trim().min(1),
  cantidad: z.coerce.number().positive().default(1),
  precioUnitarioUsd: z.coerce.number().nonnegative(),
});

export const generarFacturaSchema = z.object({
  cuentaId: z.string().uuid(),
  periodoMes: z.coerce.number().int().min(1).max(12),
  periodoAnio: z.coerce.number().int().min(2024).max(2100),
  vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  /// Si no se pasan conceptos, se autocompletan con la suscripción de la cuenta.
  conceptos: z.array(conceptoSchema).optional(),
  impuestosUsd: z.coerce.number().nonnegative().default(0),
  notaInterna: z.string().trim().optional(),
  enviarEmail: z.boolean().default(true),
});
export class GenerarFacturaDto extends createZodDto(generarFacturaSchema) {}

export const marcarPagadaSchema = z.object({
  metodoPago: z.string().trim().min(1, 'Indicá el método de pago (transferencia, mp, etc.)'),
  pagadaEn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export class MarcarPagadaDto extends createZodDto(marcarPagadaSchema) {}
