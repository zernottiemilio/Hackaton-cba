import { apiClient } from '@/lib/apiClient';
import type {
  Tokenizacion,
  Reserva,
  ConfirmacionCompra,
  ReclamoResult,
  LiberarFondosResult,
  LiquidarPayload,
  LiquidarResult,
  PortfolioResponse,
  WalletInfo,
  ModoTokenizacion,
  FuentePrecio,
} from '../types/tokenizadas';

export interface CrearTokenizacionPayload {
  campaniaId?: string;
  campaniaNueva?: {
    nombre: string;
    establecimientoId: string;
    cultivoId: string;
    cicloAgricola: string;
    hectareasAfectadas: number;
    fechaSiembraEstimada: string;
    fechaCosechaEstimada: string;
    rindeEstimadoTnHa: number;
  };
  modo: ModoTokenizacion;
  porcentaje?: number;
  toneladasFijas?: number;
  fuentePrecio: FuentePrecio;
  precioReferenciaUsdTn: number;
  descuentoPct: number;
  precioDinamico: boolean;
  precioPisoUsd?: number;
  fondeoDesde: string;
  fondeoHasta: string;
  tieneSeguroGranizo: boolean;
  tieneSeguroParametrico: boolean;
  tieneAvalSgr: boolean;
  sobrecolateralPct: number;
}

/**
 * Respuesta de `POST admin/:id/revisar`. Al aprobar, el backend publica la
 * campaña on-chain (create_campaign) y devuelve la signature real en `publicacion`.
 * Al rechazar no hay transacción.
 */
export interface RevisionResult {
  ok: boolean;
  estado: 'abierta' | 'rechazada';
  publicacion?: {
    txSignature: string;
    mintAddress: string;
    vaultAddress: string;
  };
}

export interface FiltrosMarketplace {
  cultivo?: string;
  provincia?: string;
  modo?: ModoTokenizacion;
  precioMin?: number;
  precioMax?: number;
  descuentoMin?: number;
  soloConGarantias?: boolean;
  orden?: 'cierra_pronto' | 'mayor_descuento' | 'menor_riesgo' | 'recientes';
}

export const tokenizadasApi = {
  // ─── Wallet ────────────────────────────────────────────────────
  async conectarWallet(): Promise<WalletInfo> {
    const { data } = await apiClient.post('/tokenizadas/wallet/conectar');
    return data;
  },

  // ─── Productor ─────────────────────────────────────────────────
  async crear(payload: CrearTokenizacionPayload): Promise<Tokenizacion> {
    const { data } = await apiClient.post('/tokenizadas', payload);
    return data;
  },

  async enviarARevision(id: string) {
    const { data } = await apiClient.post(`/tokenizadas/${id}/enviar-revision`);
    return data;
  },

  async misCampanas(): Promise<Tokenizacion[]> {
    const { data } = await apiClient.get('/tokenizadas/mis-campanas');
    return data;
  },

  /**
   * release_funds: vacía el vault hacia la wallet del productor. Solo si
   * tokensVendidos >= toneladasMinimas y la campaña está abierta.
   * Contrato acordado en HARVEST.md (VAL-12).
   */
  async liberarFondos(id: string): Promise<LiberarFondosResult> {
    const { data } = await apiClient.post(`/tokenizadas/${id}/liberar-fondos`);
    return data;
  },

  // ─── Inversor / Marketplace (público) ──────────────────────────
  async marketplace(filtros: FiltrosMarketplace = {}): Promise<Tokenizacion[]> {
    const { data } = await apiClient.get('/tokenizadas/marketplace', { params: filtros });
    return data;
  },

  async detalleMarketplace(id: string): Promise<Tokenizacion> {
    const { data } = await apiClient.get(`/tokenizadas/marketplace/${id}`);
    return data;
  },

  async reservar(payload: { tokenizacionId: string; cantidad: number; inversorWallet: string }): Promise<Reserva> {
    const { data } = await apiClient.post('/tokenizadas/reservas', payload);
    return data;
  },

  async confirmarCompra(reservaId: string): Promise<ConfirmacionCompra> {
    const { data } = await apiClient.post('/tokenizadas/reservas/confirmar', { reservaId });
    return data;
  },

  async portfolio(): Promise<PortfolioResponse> {
    const { data } = await apiClient.get('/tokenizadas/portfolio');
    return data;
  },

  async reclamar(payload: { tenenciaId: string; inversorWallet: string }): Promise<ReclamoResult> {
    const { data } = await apiClient.post('/tokenizadas/reclamar', payload);
    return data;
  },

  // ─── Admin ─────────────────────────────────────────────────────
  async colaRevision(): Promise<Tokenizacion[]> {
    const { data } = await apiClient.get('/tokenizadas/admin/revision');
    return data;
  },

  async revisar(id: string, payload: { decision: 'aprobar' | 'rechazar'; motivoRechazo?: string }): Promise<RevisionResult> {
    const { data } = await apiClient.post(`/tokenizadas/admin/${id}/revisar`, payload);
    return data;
  },

  /** Campañas `fondeada` (pendientes de liquidar) y `liquidada` (historial). Contrato en HARVEST.md (VAL-12). */
  async colaLiquidacion(): Promise<Tokenizacion[]> {
    const { data } = await apiClient.get('/tokenizadas/admin/liquidacion');
    return data;
  },

  /**
   * settle: el acopio (fee-payer del backend) deposita toneladasEntregadas × precio
   * en el vault y el programa fija payout_per_token. Contrato en HARVEST.md (VAL-12).
   */
  async liquidar(id: string, payload: LiquidarPayload): Promise<LiquidarResult> {
    const { data } = await apiClient.post(`/tokenizadas/${id}/liquidar`, payload);
    return data;
  },
};
