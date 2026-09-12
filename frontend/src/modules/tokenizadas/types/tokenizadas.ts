/**
 * Tipos del módulo Campañas Tokenizadas. Deriva de los modelos Prisma
 * (backend/prisma/schema.prisma) pero adaptado a lo que consume el front.
 */

export type ContextoTokenizacion = 'productor' | 'inversor' | 'acopio' | 'admin_plataforma';

export type EstadoCampanaToken =
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
export type FuentePrecio = 'pizarra_rosario' | 'matba_futuro' | 'manual';
export type EstadoTenencia = 'activa' | 'liquidada' | 'en_disputa';
export type SemaforoAfectacion = 'verde' | 'amarillo' | 'rojo';

export interface WalletInfo {
  address: string;
  balanceSol: number;
  balanceUsdc: number;
  network: 'mainnet-beta' | 'devnet' | 'mock';
}

export interface CampoResumen {
  id: string;
  nombre: string;
  partido: string | null;
  provincia: string | null;
  superficieTotalHa: number | null;
  geometria: any | null;
  /** Coordenadas del establecimiento. Fallback del mapa cuando falta la geometría. */
  latitud?: number | string | null;
  longitud?: number | string | null;
  fotos: string[];
}

export interface CultivoResumen {
  id: string;
  nombre: string;
}

export interface ProductorResumen {
  id: string;
  nombre: string;
  createdAt?: string;
}

export interface CampaniaTokenizada {
  id: string;
  nombre: string;
  cicloAgricola: string | null;
  hectareasAfectadas: number | null;
  fechaSiembraEstimada: string | null;
  fechaCosechaEstimada: string | null;
  rindeEstimadoTnHa: number | null;
  rindeRealTnHa: number | null;
  estadoToken: EstadoCampanaToken | null;
  establecimiento: CampoResumen | null;
  cultivo: CultivoResumen | null;
}

export interface Tokenizacion {
  id: string;
  campaniaId: string;
  productorId: string;
  modo: ModoTokenizacion;
  porcentaje: number | null;
  toneladasFijas: number | null;
  toneladasOfrecidas: number;
  tokensEmitidos: number;
  tokensVendidos: number;

  fuentePrecio: FuentePrecio;
  precioReferenciaUsdTn: number;
  descuentoPct: number;
  precioTokenUsd: number;
  precioDinamico: boolean;
  precioPisoUsd: number | null;

  fondeoDesde: string;
  fondeoHasta: string;
  montoObjetivoUsd: number;
  montoRecaudadoUsd: number;

  tieneSeguroGranizo: boolean;
  tieneSeguroParametrico: boolean;
  tieneAvalSgr: boolean;
  sobrecolateralPct: number;

  mintAddress: string | null;
  vaultAddress: string | null;
  txSignaturePublicacion: string | null;

  aprobadaEn: string | null;
  rechazadaEn: string | null;
  motivoRechazo: string | null;

  precioLiquidacionUsdTn: number | null;
  /**
   * Fecha objetivo de liquidación (settlement_date on-chain). Antes de esta
   * fecha el programa rechaza settle. Null = el backend usó fondeoHasta + 90d.
   */
  fechaLiquidacionEstimada: string | null;
  /** Timestamp real del settle. Null hasta que el admin liquida. */
  liquidadaEn: string | null;
  /**
   * Mínimo de toneladas vendidas para que el productor pueda liberar fondos
   * (min_tons on-chain). Lo agrega el backend en VAL-11; hasta entonces el
   * programa usa 1 y el campo puede venir ausente.
   */
  toneladasMinimas?: number | null;
  /** Signature de release_funds. La persiste el backend en VAL-12. */
  txSignatureLiberacion?: string | null;
  /** Resultado de settle. Los persiste el backend en VAL-12. */
  toneladasEntregadas?: number | null;
  payoutPorTokenUsd?: number | null;
  txSignatureLiquidacion?: string | null;

  createdAt: string;
  campania: CampaniaTokenizada;
  productor: ProductorResumen;
  disponibilidad?: {
    tokensEmitidos: number;
    tokensVendidos: number;
    tokensReservados: number;
    tokensDisponibles: number;
  };
}

export interface Tenencia {
  id: string;
  tokenizacionId: string;
  inversorId: string;
  walletAddress: string;
  tokens: number;
  precioCompraUsd: number;
  montoTotalUsd: number;
  estado: EstadoTenencia;
  txSignatureCompra: string | null;
  txSignatureCobro: string | null;
  usdcRecibido: number | null;
  fechaCobro: string | null;
  createdAt: string;
  tokenizacion: Tokenizacion;
}

export interface ResumenPortfolio {
  invertidoUsd: number;
  valorActualUsd: number;
  retornoNoRealizado: number;
  retornoPct: number;
  cantidadTenencias: number;
}

export interface PortfolioResponse {
  tenencias: Tenencia[];
  resumen: ResumenPortfolio;
}

export interface Reserva {
  reservaId: string;
  expiraEn: string;
  precioUsdSnapshot: number;
}

export interface ConfirmacionCompra {
  txSignature: string;
  tenenciaId: string;
  tokens: number;
  precioCompraUsd: number;
  montoTotalUsdc: number;
  comision?: DesgloseComision;
}

/** Comisión de plataforma aplicada a una operación. */
export interface DesgloseComision {
  montoBrutoUsd: number;
  porcentaje: number;
  montoComisionUsd: number;
  montoNetoUsd: number;
  /** Signature de la transferencia SPL a la tesorería. Null si falló o en mock viejo. */
  txComision?: string | null;
  tesoreria?: string;
}

/** `GET /tokenizadas/comisiones/config` */
export interface ComisionConfig {
  porcentaje: number;
  tesoreria: string;
}

/** Respuesta de `POST /tokenizadas/:id/liberar-fondos` (release_funds). */
export interface LiberarFondosResult {
  txSignature: string;
  /** USDC que salió del vault hacia la wallet del productor (bruto). */
  montoUsd: number;
  comision?: DesgloseComision;
}

/** Body de `POST /tokenizadas/:id/liquidar` (settle). */
export interface LiquidarPayload {
  toneladasEntregadas: number;
  precioLiquidacionUsdTn: number;
}

/** Respuesta de `POST /tokenizadas/:id/liquidar`. */
export interface LiquidarResult {
  txSignature: string;
  /** USDC que cobra cada token al redimir: depositoUsd / tokensVendidos, división entera en micro-USDC. */
  payoutPorTokenUsd: number;
  /** USDC que el acopio depositó en el vault: toneladasEntregadas × precio. */
  depositoUsd: number;
}

export interface ReclamoResult {
  txSignature: string;
  tokensQuemados: number;
  usdcRecibido: number;
}

/**
 * Estado on-chain agregado que devuelve `GET /tokenizadas/:id/on-chain`.
 * Contrato definido en HARVEST.md (VAL-18). Refresca cada 10s en el panel.
 */
export interface EstadoOnChain {
  onChain: boolean;
  status: 'draft' | 'open' | 'funded' | 'settled' | 'refunded';
  tonsOffered: number;
  tonsSold: number;
  minTons: number;
  pricePerTonUsd: number;
  settlementDate: string | null;
  tonsDelivered: number | null;
  settlementPriceUsd: number | null;
  payoutPerTokenUsd: number | null;
  vaultBalanceUsd: number;
  addresses: {
    campaign: string | null;
    tokenMint: string | null;
    vault: string | null;
    producer: string | null;
    acopio: string | null;
  };
  explorer: {
    campaign: string | null;
    tokenMint: string | null;
    vault: string | null;
  };
}

// ─── Datos técnicos externos (mock) ─────────────────────────────

export interface DatosClima {
  precipitacionMensualMm: { mes: string; mm: number; promedioHistorico: number }[];
  temperaturaMediaC: { mes: string; c: number }[];
  deficitHidricoAcumMm: number;
}

export interface DatosSuelo {
  textura: string;
  materiaOrganicaPct: number;
  ph: number;
  capacidadRetencionMm: number;
  fuente: string;
}

export interface SerieNdvi {
  fecha: string;
  valor: number;
  valorTipico?: number;
}

export interface SeriePrecio {
  fecha: string;
  usd: number;
}

/** Respuesta de `POST /tokenizadas/demo/publicar`: campaña creada y publicada on-chain en un click. */
export interface PublicarDemoResult {
  id: string;
  nombre: string;
  toneladasOfrecidas: number;
  precioTokenUsd: number;
  toneladasMinimas: number;
  fondeoHasta: string;
  fechaLiquidacionEstimada: string;
  txSignature: string;
}
