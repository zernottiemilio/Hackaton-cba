import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const tipoAlertaSchema = z.enum([
  'clima', 'agua', 'plaga', 'vencimiento', 'general',
]);
export const severidadSchema = z.enum(['info', 'warning', 'critica']);

export const crearAlertaSchema = z.object({
  tipo: tipoAlertaSchema.default('general'),
  severidad: severidadSchema.default('info'),
  titulo: z.string().trim().min(1, 'Título requerido').max(200),
  detalle: z.string().trim().optional(),
  /** Si está presente, la alerta es dirigida a un usuario específico de la cuenta. */
  usuarioId: z.string().uuid().optional(),
  /** Contexto libre con IDs para drilldown (loteCampaniaId, monitoreoId, etc.). */
  contexto: z.record(z.string(), z.unknown()).optional(),
});
export class CrearAlertaDto extends createZodDto(crearAlertaSchema) {}
