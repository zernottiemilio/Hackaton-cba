import { apiClient } from '@/lib/apiClient';

/**
 * Precios reales de pizarra Rosario (BCR / Consiagro) consumidos desde
 * el backend, que a su vez los cachea desde granos.ar.
 *
 * Los tipos que exportamos (`Cultivo`, `PrecioTick`) mantienen la misma
 * shape que usaba el mock service — así los ~10 componentes que dibujan
 * sparklines / tickers / gráficos no cambian.
 */

export type Cultivo = 'soja' | 'maiz' | 'trigo' | 'girasol';

export interface PrecioTick {
  cultivo: Cultivo;
  usdTn: number;
  cambio24hPct: number;
  ts: number;
}

interface PizarraResponse {
  meta: { atribucion: string; fuente: string; generado_en: string };
  cache: boolean;
  data: {
    fecha: string;
    tipo_cambio_bna_divisas: number;
    granos: Record<
      Cultivo | 'sorgo',
      { ars_tn: number; usd_tn: number; variacion_pct_vs_rueda_anterior: number }
    >;
    fuente_precios: string;
  };
}

interface HistoricoResponse {
  meta: { atribucion: string; fuente: string; generado_en: string };
  cache: boolean;
  data: {
    serie: {
      fecha: string;
      soja: number | null;
      maiz: number | null;
      trigo: number | null;
      girasol: number | null;
      sorgo: number | null;
    }[];
  };
}

export const preciosApi = {
  async pizarra(): Promise<PizarraResponse> {
    const { data } = await apiClient.get<PizarraResponse>('/precios/pizarra');
    return data;
  },
  async historico(dias = 30): Promise<HistoricoResponse> {
    const { data } = await apiClient.get<HistoricoResponse>('/precios/pizarra/historico', {
      params: { dias },
    });
    return data;
  },
};

/** Convierte la respuesta actual a la lista de ticks que usan los componentes. */
export function pizarraATicks(r: PizarraResponse): PrecioTick[] {
  const ts = new Date(r.data.fecha).getTime();
  const cultivos: Cultivo[] = ['soja', 'maiz', 'trigo', 'girasol'];
  return cultivos.map((c) => ({
    cultivo: c,
    usdTn: r.data.granos[c].usd_tn,
    cambio24hPct: r.data.granos[c].variacion_pct_vs_rueda_anterior,
    ts,
  }));
}

/** Convierte la serie histórica al array de ticks para un cultivo. */
export function historicoAPrecios(r: HistoricoResponse, cultivo: Cultivo): PrecioTick[] {
  return r.data.serie
    .map((p) => {
      const usdTn = p[cultivo];
      if (usdTn === null || usdTn === undefined) return null;
      return {
        cultivo,
        usdTn,
        cambio24hPct: 0,
        ts: new Date(p.fecha).getTime(),
      } satisfies PrecioTick;
    })
    .filter((t): t is PrecioTick => t !== null);
}

/**
 * Normaliza el nombre del cultivo que viene del backend ("Soja", "Maíz",
 * "girasol", etc.) al tipo interno. Mantiene la firma que exportaba el
 * mock service.
 */
export function normalizarCultivo(nombre: string | null | undefined): Cultivo {
  if (!nombre) return 'soja';
  const limpio = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (limpio === 'soja' || limpio === 'maiz' || limpio === 'trigo' || limpio === 'girasol') {
    return limpio;
  }
  return 'soja';
}
