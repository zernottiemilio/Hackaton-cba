import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * Precios reales de la pizarra Rosario (BCR / Consiagro), consumidos vía
 * granos.ar API pública. El servicio cachea in-memory con dos TTLs distintos
 * porque el volumen y frecuencia de cambio son diferentes:
 *
 *   - Pizarra actual: cambia varias veces por rueda, cache 5 minutos.
 *   - Histórico diario: cambia una vez por día, cache 1 hora.
 *
 * Si el upstream falla, devolvemos el último valor cacheado aunque haya
 * expirado — la UI prefiere un dato ligeramente viejo a un error 500.
 *
 * Atribución obligatoria de granos.ar: la respuesta incluye `atribucion` y
 * el frontend la muestra en el pie de los widgets de precio.
 */

const BASE_URL = 'https://granosar.lfcaucino.workers.dev/api/v1';
const TTL_PIZARRA_MS = 5 * 60 * 1000;
const TTL_HISTORICO_MS = 60 * 60 * 1000;

export interface PizarraActual {
  fecha: string;
  tipo_cambio_bna_divisas: number;
  granos: Record<
    'soja' | 'maiz' | 'trigo' | 'sorgo' | 'girasol',
    {
      ars_tn: number;
      usd_tn: number;
      variacion_pct_vs_rueda_anterior: number;
    }
  >;
  fuente_precios: string;
}

export interface PizarraHistorico {
  serie: {
    fecha: string;
    soja: number | null;
    maiz: number | null;
    trigo: number | null;
    girasol: number | null;
    sorgo: number | null;
  }[];
}

interface PizarraResponse {
  meta: {
    atribucion: string;
    fuente: string;
    version: string;
    generado_en: string;
  };
  data: PizarraActual | PizarraHistorico;
}

interface CacheEntry<T> {
  data: T;
  meta: PizarraResponse['meta'];
  expira: number;
}

@Injectable()
export class PreciosService {
  private readonly logger = new Logger(PreciosService.name);
  private cachePizarra: CacheEntry<PizarraActual> | null = null;
  private cacheHistorico: Map<number, CacheEntry<PizarraHistorico>> = new Map();

  async pizarraActual(): Promise<{ data: PizarraActual; meta: PizarraResponse['meta']; cache: boolean }> {
    const now = Date.now();
    if (this.cachePizarra && this.cachePizarra.expira > now) {
      return { data: this.cachePizarra.data, meta: this.cachePizarra.meta, cache: true };
    }
    try {
      const res = await this.fetchJson<PizarraResponse>(`${BASE_URL}/pizarra`);
      this.cachePizarra = {
        data: res.data as PizarraActual,
        meta: res.meta,
        expira: now + TTL_PIZARRA_MS,
      };
      return { data: this.cachePizarra.data, meta: this.cachePizarra.meta, cache: false };
    } catch (err) {
      this.logger.warn(`granos.ar pizarra falló: ${(err as Error).message}`);
      if (this.cachePizarra) {
        // Devolvemos el cache viejo con warning.
        return { data: this.cachePizarra.data, meta: this.cachePizarra.meta, cache: true };
      }
      throw new ServiceUnavailableException('No pude leer precios de pizarra');
    }
  }

  async pizarraHistorico(dias: number): Promise<{ data: PizarraHistorico; meta: PizarraResponse['meta']; cache: boolean }> {
    const diasClamp = Math.min(Math.max(1, Math.floor(dias)), 365);
    const now = Date.now();
    const cached = this.cacheHistorico.get(diasClamp);
    if (cached && cached.expira > now) {
      return { data: cached.data, meta: cached.meta, cache: true };
    }
    try {
      const res = await this.fetchJson<PizarraResponse>(
        `${BASE_URL}/pizarra/historico?dias=${diasClamp}`,
      );
      const entry = {
        data: res.data as PizarraHistorico,
        meta: res.meta,
        expira: now + TTL_HISTORICO_MS,
      };
      this.cacheHistorico.set(diasClamp, entry);
      return { data: entry.data, meta: entry.meta, cache: false };
    } catch (err) {
      this.logger.warn(`granos.ar histórico(${diasClamp}) falló: ${(err as Error).message}`);
      if (cached) {
        return { data: cached.data, meta: cached.meta, cache: true };
      }
      throw new ServiceUnavailableException('No pude leer histórico de precios');
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          // granos.ar acepta atribución explícita opcional; ayuda a que nos
          // identifiquen como consumer en su tracking.
          'User-Agent': 'harvest.fi (https://harvest.fi)',
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(t);
    }
  }
}
