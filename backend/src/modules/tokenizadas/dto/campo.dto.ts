import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * DTO para crear un campo desde el flujo del productor en el módulo tokenizadas.
 * El campo se persiste en la tabla `establecimientos` (extendida con
 * `partido`, `provincia`, `geometria`, `fotos`, `acopio_habitual_id`).
 */
const geoJsonPolygon = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

export const CrearCampoSchema = z.object({
  nombre: z.string().min(2).max(120),
  partido: z.string().min(2).max(80),
  provincia: z.string().min(2).max(80),
  /** Superficie en hectáreas. Se puede calcular con @turf/area o ingresar a mano. */
  superficieHa: z.number().positive(),
  /** Polígono GeoJSON del lote. */
  geometria: geoJsonPolygon,
  tenencia: z.enum(['propio', 'arrendado', 'mixto']).default('propio'),
  acopioHabitualId: z.string().uuid().optional(),
  fotos: z.array(z.string().url().or(z.string().startsWith('/uploads/'))).default([]),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
});
export class CrearCampoDto extends createZodDto(CrearCampoSchema) {}

export const ActualizarCampoSchema = CrearCampoSchema.partial();
export class ActualizarCampoDto extends createZodDto(ActualizarCampoSchema) {}
