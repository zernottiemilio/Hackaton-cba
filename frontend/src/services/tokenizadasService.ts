import { apiClient } from '@/lib/apiClient';

// ─── Tipos parciales del backend (los shapes completos viven en el server) ───

export type EstadoCampana =
  | 'borrador'
  | 'en_revision'
  | 'rechazada'
  | 'abierta'
  | 'fondeada'
  | 'en_curso'
  | 'en_cosecha'
  | 'liquidada'
  | 'cancelada';

export type ModoTokenizacion = 'porcentual' | 'fijo';

export interface TokenizacionCampanaResumen {
  id: string;
  productorId: string;
  campaniaId: string;
  modo: ModoTokenizacion;
  porcentaje: number | null;
  toneladasFijas: number | null;
  precioTokenUsd: string;              // Decimal serializado
  descuentoPct: string;
  fondeoDesde: string;
  fondeoHasta: string;
  tieneSeguroGranizo: boolean;
  tieneSeguroParametrico: boolean;
  tieneAvalSgr: boolean;
  campania: {
    id: string;
    nombre: string;
    estadoToken: EstadoCampana;
    hectareasAfectadas: string;
    rindeEstimadoTnHa: string;
    cultivo?: { id: string; nombre: string } | null;
    establecimiento?: {
      id: string;
      nombre: string;
      provincia?: string | null;
      localidad?: string | null;
    } | null;
  };
  productor: { id: string; nombre: string };
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

export interface DetalleMarketplace extends TokenizacionCampanaResumen {
  disponibilidad: {
    tokensTotales: number;
    tokensReservados: number;
    tokensVendidos: number;
    tokensDisponibles: number;
    pctFondeado: number;
  };
}

export type EstadoTenencia = 'activa' | 'reclamada' | 'reembolsada';

export interface Tenencia {
  id: string;
  tokens: string;
  montoTotalUsd: string;
  estado: EstadoTenencia;
  walletAddress: string;
  createdAt: string;
  tokenizacion: TokenizacionCampanaResumen & {
    precioLiquidacionUsdTn?: string | null;
  };
}

export interface PortfolioInversor {
  tenencias: Tenencia[];
  resumen: {
    invertidoUsd: number;
    valorActualUsd: number;
    retornoNoRealizado: number;
    retornoPct: number;
    cantidadTenencias: number;
  };
}

export interface WalletMockResponse {
  address: string;
  balanceSol: number;
  balanceUsdc: number;
}

// ─── Service ────────────────────────────────────────────────────────

export const tokenizadasService = {
  // Marketplace (público)
  async listarMarketplace(filtros: FiltrosMarketplace = {}) {
    const res = await apiClient.get<TokenizacionCampanaResumen[]>('/tokenizadas/marketplace', {
      params: filtros,
    });
    return res.data;
  },

  async detalleMarketplace(tokenizacionId: string) {
    const res = await apiClient.get<DetalleMarketplace>(`/tokenizadas/marketplace/${tokenizacionId}`);
    return res.data;
  },

  // Productor
  async misCampanas() {
    const res = await apiClient.get<TokenizacionCampanaResumen[]>('/tokenizadas/mis-campanas');
    return res.data;
  },

  // Inversor
  async portfolio() {
    const res = await apiClient.get<PortfolioInversor>('/tokenizadas/portfolio');
    return res.data;
  },

  async reservar(payload: { tokenizacionId: string; cantidad: number; inversorWallet: string }) {
    const res = await apiClient.post('/tokenizadas/reservas', payload);
    return res.data;
  },

  async confirmarCompra(reservaId: string) {
    const res = await apiClient.post('/tokenizadas/reservas/confirmar', { reservaId });
    return res.data;
  },

  async reclamar(payload: { tenenciaId: string; inversorWallet: string }) {
    const res = await apiClient.post('/tokenizadas/reclamar', payload);
    return res.data;
  },

  // Wallet (mock por ahora)
  async conectarWallet() {
    const res = await apiClient.post<WalletMockResponse>('/tokenizadas/wallet/conectar', {});
    return res.data;
  },

  // Catálogos
  async listarCultivos() {
    const res = await apiClient.get<Array<{ id: string; nombre: string }>>('/tokenizadas/cultivos');
    return res.data;
  },

  async listarAcopios() {
    const res = await apiClient.get<
      Array<{ id: string; nombre: string; localidad: string | null; provincia: string | null }>
    >('/tokenizadas/acopios');
    return res.data;
  },

  // Admin
  async colaRevision() {
    const res = await apiClient.get<TokenizacionCampanaResumen[]>('/tokenizadas/admin/revision');
    return res.data;
  },
};
