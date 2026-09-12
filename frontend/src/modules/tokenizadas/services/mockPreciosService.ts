/**
 * @deprecated El mock de precios se reemplazó por consumo real vía backend
 * (`preciosService`), que a su vez consume granos.ar (BCR Rosario /
 * Consiagro). Este archivo re-exporta los tipos y la función de
 * normalización para no cascadear renames en los ~10 componentes que la
 * usan. `mockPreciosLive` ya no existe: los hooks `usePreciosLive`,
 * `usePrecioLive` y `useHistoriaPrecios` ahora hablan con el endpoint real.
 */

export { normalizarCultivo, type Cultivo, type PrecioTick } from './preciosService';
