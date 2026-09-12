import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const tipoComision = z.enum(['compra_inversor', 'cobro_productor']);

/** Filtros del listado de auditoría de comisiones (admin_plataforma). */
export const ListarComisionesSchema = z.object({
  tipo: tipoComision.optional(),
  desde: z.string().datetime().or(z.string().date()).optional(),
  hasta: z.string().datetime().or(z.string().date()).optional(),
});
export class ListarComisionesDto extends createZodDto(ListarComisionesSchema) {}
