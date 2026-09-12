import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

// Regex permisivo 8-4-4-4-12 hex: acepta UUIDs del seed (versión 0) que el
// validador nativo `.uuid()` de Zod rechaza. Mismo criterio que tokenizadas
// (fix 8d333a2).
const uuidLike = () =>
  z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Formato UUID inválido',
    );

export const registrarLluviaSchema = z.object({
  fecha: fechaIso,
  mm: z.coerce.number().nonnegative('Debe ser >= 0'),
  establecimientoId: uuidLike().optional().nullable(),
  nota: z.string().trim().optional(),
});
export class RegistrarLluviaDto extends createZodDto(registrarLluviaSchema) {}

export const actualizarLluviaSchema = z.object({
  mm: z.coerce.number().nonnegative().optional(),
  nota: z.string().trim().nullable().optional(),
});
export class ActualizarLluviaDto extends createZodDto(actualizarLluviaSchema) {}

export const listarLluviasSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  establecimientoId: uuidLike().optional(),
});
export type ListarLluviasQuery = z.infer<typeof listarLluviasSchema>;

export const sincronizarSchema = z.object({
  /** Días hacia atrás a sincronizar. Default 30, max 365. */
  dias: z.coerce.number().int().min(1).max(365).default(30),
});
export type SincronizarBody = z.infer<typeof sincronizarSchema>;
