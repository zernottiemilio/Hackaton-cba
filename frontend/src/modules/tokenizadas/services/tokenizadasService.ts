import { apiClient } from '@/lib/apiClient';
import type {
  Tokenizacion,
  PublicarDemoResult,
  ProductorPublico,
  Reserva,
  ConfirmacionCompra,
  ReclamoResult,
  LiberarFondosResult,
  ComisionConfig,
  LiquidarPayload,
  LiquidarResult,
  PortfolioResponse,
  WalletInfo,
  ModoTokenizacion,
  FuentePrecio,
  EstadoOnChain,
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
  /** ISO 8601 con hora. Es el sale_end on-chain. */
  fondeoDesde: string;
  fondeoHasta: string;
  /** ISO 8601. settlement_date on-chain, tiene que ser posterior a fondeoHasta. Si falta, backend usa fondeoHasta + 90d. */
  fechaLiquidacionEstimada?: string;
  /** min_tons on-chain: piso de toneladas vendidas para poder liberar fondos. Default 1. */
  toneladasMinimas?: number;
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

/**
 * Prisma serializa `Decimal` como string en la respuesta HTTP. Los tipos de
 * frontend los declaran como `number` porque así se consumen — pero cualquier
 * `.toFixed()` o aritmética directa sobre strings los rompe con
 * `t.toFixed is not a function`. Normalizamos en el borde: convertimos los
 * campos numéricos conocidos a `number` antes de devolver al caller.
 *
 * Si aparece un `.toFixed` sobre un campo nuevo del backend y falla, agregarlo
 * a `TOKENIZACION_NUMERIC_FIELDS` o `TENENCIA_NUMERIC_FIELDS`.
 */
const TOKENIZACION_NUMERIC_FIELDS = [
  'porcentaje',
  'toneladasFijas',
  'toneladasOfrecidas',
  'tokensEmitidos',
  'tokensVendidos',
  'precioReferenciaUsdTn',
  'descuentoPct',
  'precioTokenUsd',
  'precioPisoUsd',
  'montoObjetivoUsd',
  'montoRecaudadoUsd',
  'sobrecolateralPct',
  'precioLiquidacionUsdTn',
  'toneladasMinimas',
  'toneladasEntregadas',
  'payoutPorTokenUsd',
] as const;

const TENENCIA_NUMERIC_FIELDS = [
  'tokens',
  'precioCompraUsd',
  'montoTotalUsd',
  'usdcRecibido',
] as const;

function toNumberOrKeep(v: unknown): unknown {
  if (v === null || v === undefined || v === '') return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}

function normalizarTokenizacion<T>(t: T): T {
  if (t === null || t === undefined) return t;
  const clone: Record<string, unknown> = { ...(t as Record<string, unknown>) };
  for (const k of TOKENIZACION_NUMERIC_FIELDS) {
    if (k in clone) clone[k] = toNumberOrKeep(clone[k]);
  }
  // Tenencias anidadas (portfolio + admin/liquidacion).
  if (Array.isArray(clone.tenencias)) {
    clone.tenencias = (clone.tenencias as Record<string, unknown>[]).map((ten) => {
      const c: Record<string, unknown> = { ...ten };
      for (const k of TENENCIA_NUMERIC_FIELDS) {
        if (k in c) c[k] = toNumberOrKeep(c[k]);
      }
      return c;
    });
  }
  return clone as T;
}

function normalizarLista<T>(list: T[]): T[] {
  return list.map((x) => normalizarTokenizacion(x));
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
    return normalizarTokenizacion(data);
  },

  /**
   * Enviar a revisión. Con AUTO_APROBAR_CAMPANAS (modo demo) el backend la
   * aprueba y publica en Solana en el mismo paso: vuelve `estado: 'abierta'`
   * y la signature de create_campaign en `publicacion`.
   */
  async enviarARevision(id: string): Promise<{
    ok: boolean;
    estado: string;
    autoAprobada?: boolean;
    publicacion?: { txSignature: string };
  }> {
    const { data } = await apiClient.post(`/tokenizadas/${id}/enviar-revision`);
    return data;
  },

  async misCampanas(): Promise<Tokenizacion[]> {
    const { data } = await apiClient.get('/tokenizadas/mis-campanas');
    return normalizarLista(data);
  },

  /**
   * release_funds: vacía el vault hacia la wallet del productor. Solo si
   * tokensVendidos >= toneladasMinimas y la campaña está abierta.
   * Contrato acordado en HARVEST.md (VAL-12).
   */
  /** Campaña demo en un click (crea + aprueba + create_campaign on-chain). */
  async publicarDemo(): Promise<PublicarDemoResult> {
    const { data } = await apiClient.post('/tokenizadas/demo/publicar');
    return { ...data, precioTokenUsd: Number(data.precioTokenUsd) };
  },

  async liberarFondos(id: string): Promise<LiberarFondosResult> {
    const { data } = await apiClient.post(`/tokenizadas/${id}/liberar-fondos`);
    return data;
  },

  // ─── Inversor / Marketplace (público) ──────────────────────────
  async marketplace(filtros: FiltrosMarketplace = {}): Promise<Tokenizacion[]> {
    const { data } = await apiClient.get('/tokenizadas/marketplace', { params: filtros });
    return normalizarLista(data);
  },

  /** Reputación pública de los productores. Alimenta la columna "Productor" del marketplace. */
  async listarProductores(): Promise<ProductorPublico[]> {
    const { data } = await apiClient.get('/tokenizadas/productores');
    return (data as ProductorPublico[]).map((p) => ({
      ...p,
      rating: Number(p.rating),
      metricas: {
        campaniasActivas: Number(p.metricas?.campaniasActivas ?? 0),
        campaniasLiquidadas: Number(p.metricas?.campaniasLiquidadas ?? 0),
        liquidadasPositivas: Number(p.metricas?.liquidadasPositivas ?? 0),
        toneladasBajoAdmin: Number(p.metricas?.toneladasBajoAdmin ?? 0),
        usdRecaudadoTotal: Number(p.metricas?.usdRecaudadoTotal ?? 0),
      },
    }));
  },

  async detalleMarketplace(id: string): Promise<Tokenizacion> {
    const { data } = await apiClient.get(`/tokenizadas/marketplace/${id}`);
    return normalizarTokenizacion(data);
  },

  /**
   * Estado on-chain: lo que el jurado verifica clickeando al explorer.
   * Contrato en HARVEST.md (VAL-18). Público, refresca cada 10s en la UI.
   */
  async estadoOnChain(id: string): Promise<EstadoOnChain> {
    const { data } = await apiClient.get(`/tokenizadas/${id}/on-chain`);
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
    // Portfolio shape: { tenencias: [...] }. Cada tenencia tiene tokenizacion anidada.
    if (Array.isArray(data?.tenencias)) {
      data.tenencias = data.tenencias.map((ten: Record<string, unknown>) => {
        const c: Record<string, unknown> = { ...ten };
        for (const k of TENENCIA_NUMERIC_FIELDS) {
          if (k in c) c[k] = toNumberOrKeep(c[k]);
        }
        if (c.tokenizacion) c.tokenizacion = normalizarTokenizacion(c.tokenizacion as Record<string, unknown>);
        return c;
      });
    }
    return data;
  },

  async reclamar(payload: { tenenciaId: string; inversorWallet: string }): Promise<ReclamoResult> {
    const { data } = await apiClient.post('/tokenizadas/reclamar', payload);
    return data;
  },

  // ─── Admin ─────────────────────────────────────────────────────
  async colaRevision(): Promise<Tokenizacion[]> {
    const { data } = await apiClient.get('/tokenizadas/admin/revision');
    return normalizarLista(data);
  },

  async revisar(id: string, payload: { decision: 'aprobar' | 'rechazar'; motivoRechazo?: string }): Promise<RevisionResult> {
    const { data } = await apiClient.post(`/tokenizadas/admin/${id}/revisar`, payload);
    return data;
  },

  /** Campañas `fondeada` (pendientes de liquidar) y `liquidada` (historial). Contrato en HARVEST.md (VAL-12). */
  async colaLiquidacion(): Promise<Tokenizacion[]> {
    const { data } = await apiClient.get('/tokenizadas/admin/liquidacion');
    return normalizarLista(data);
  },

  /**
   * settle: el acopio (fee-payer del backend) deposita toneladasEntregadas × precio
   * en el vault y el programa fija payout_per_token. Contrato en HARVEST.md (VAL-12).
   */
  async liquidar(id: string, payload: LiquidarPayload): Promise<LiquidarResult> {
    const { data } = await apiClient.post(`/tokenizadas/${id}/liquidar`, payload);
    return data;
  },

  /** Porcentaje vigente y tesorería. Público. */
  async comisionesConfig(): Promise<ComisionConfig> {
    const { data } = await apiClient.get('/tokenizadas/comisiones/config');
    return data;
  },

  /** Auditoría de comisiones de plataforma (1,5%) — panel del admin. */
  async listarComisiones(filtros?: FiltrosComisiones): Promise<ComisionesResponse> {
    const { data } = await apiClient.get('/tokenizadas/admin/comisiones', { params: filtros });
    return data;
  },
};

// ─── Comisiones ─────────────────────────────────────────────────

export type TipoComision = 'compra_inversor' | 'cobro_productor';

export interface FiltrosComisiones {
  tipo?: TipoComision;
  desde?: string;
  hasta?: string;
}

export interface ComisionItem {
  id: string;
  tokenizacionId: string;
  tenenciaId: string | null;
  tipo: TipoComision;
  usuarioId: string;
  walletAddress: string | null;
  montoBrutoUsd: string;
  porcentaje: string;
  montoComisionUsd: string;
  montoNetoUsd: string;
  txReferencia: string | null;
  /** Transferencia SPL de la comisión a la tesorería. Null si falló o venía del mock viejo. */
  txComision: string | null;
  tesoreriaAddress: string | null;
  createdAt: string;
  usuario: { id: string; nombre: string; email: string };
  tokenizacion: {
    id: string;
    campania: {
      id: string;
      nombre: string;
      cultivo?: { nombre: string } | null;
      establecimiento?: { nombre: string; provincia?: string | null } | null;
    };
  };
}

export interface ComisionesResumen {
  tasaVigentePct: number;
  total: { operaciones: number; montoBrutoUsd: number; montoComisionUsd: number; montoNetoUsd: number };
  compraInversor: { operaciones: number; montoBrutoUsd: number; montoComisionUsd: number };
  cobroProductor: { operaciones: number; montoBrutoUsd: number; montoComisionUsd: number };
}

export interface ComisionesResponse {
  items: ComisionItem[];
  resumen: ComisionesResumen;
}
