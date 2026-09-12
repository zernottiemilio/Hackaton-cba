import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  historicoAPrecios,
  pizarraATicks,
  preciosApi,
  type Cultivo,
  type PrecioTick,
} from '../services/preciosService';

/**
 * Suscripción a precios reales de pizarra Rosario (BCR / Consiagro).
 * Vía backend, que cachea granos.ar in-memory por 5min.
 *
 * Antes esto era un random walk in-memory que corría cada 3-5s. Ahora
 * refetch cada 5min con React Query — la ganancia visual del ticker
 * cambiando cada 3s no valía la pena si el número era mentira.
 */

const STALE_MS = 5 * 60 * 1000;

export function usePreciosLive(): PrecioTick[] {
  const { data } = useQuery({
    queryKey: ['precios', 'pizarra'],
    queryFn: preciosApi.pizarra,
    staleTime: STALE_MS,
    refetchInterval: STALE_MS,
  });
  return useMemo(() => (data ? pizarraATicks(data) : []), [data]);
}

/** Sólo un cultivo. */
export function usePrecioLive(cultivo: Cultivo): PrecioTick {
  const todos = usePreciosLive();
  return useMemo(
    () =>
      todos.find((t) => t.cultivo === cultivo) ?? {
        cultivo,
        usdTn: 0,
        cambio24hPct: 0,
        ts: Date.now(),
      },
    [todos, cultivo],
  );
}

/**
 * Serie histórica para sparklines. `cantidad` es el número de días.
 * Cache 1h (el histórico diario cambia una vez por día).
 */
export function useHistoriaPrecios(cultivo: Cultivo, cantidad = 30): PrecioTick[] {
  const { data } = useQuery({
    queryKey: ['precios', 'historico', cantidad],
    queryFn: () => preciosApi.historico(cantidad),
    staleTime: 60 * 60 * 1000,
  });
  return useMemo(() => (data ? historicoAPrecios(data, cultivo) : []), [data, cultivo]);
}

/**
 * Meta de atribución (para mostrar "Datos: granos.ar · BCR Rosario" en
 * los widgets de precio). Reusa la query existente.
 */
export function usePreciosAtribucion(): string | null {
  const { data } = useQuery({
    queryKey: ['precios', 'pizarra'],
    queryFn: preciosApi.pizarra,
    staleTime: STALE_MS,
  });
  return data?.meta.atribucion ?? null;
}
