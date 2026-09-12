import { apiClient } from '@/lib/apiClient';
import type { Tokenizacion } from '../types/tokenizadas';

export interface RatingMetricas {
  campaniasActivas: number;
  campaniasLiquidadas: number;
  liquidadasPositivas: number;
  toneladasBajoAdmin: number;
  usdRecaudadoTotal: number;
}

export interface ProductorResumen {
  id: string;
  nombre: string;
  email: string;
  walletAddress: string | null;
  createdAt: string;
  rating: number;
  metricas: RatingMetricas;
  cultivos: string[];
  provincia: string | null;
  campaniasActivas: Tokenizacion[];
}

export interface HitoOnChain {
  fecha: string;
  tipo: 'publicacion' | 'compra' | 'cambio_precio' | 'liquidacion' | 'aprobacion';
  descripcion: string;
  monto?: number;
}

export interface ProductorDetalle extends ProductorResumen {
  tokenizaciones: Tokenizacion[];
  trazabilidad: Record<string, { fecha: string; usdTn: number }[]>;
  eventos: { tokenizacionId: string; hitos: HitoOnChain[] }[];
}

export const productoresApi = {
  async listar(): Promise<ProductorResumen[]> {
    const { data } = await apiClient.get('/tokenizadas/productores');
    return data;
  },
  async detalle(id: string): Promise<ProductorDetalle> {
    const { data } = await apiClient.get(`/tokenizadas/productores/${id}`);
    return data;
  },
};
