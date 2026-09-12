/**
 * Contrato con la capa on-chain. En esta fase hay una única implementación:
 * MockLedgerService (persistencia en Postgres + delays artificiales para
 * simular latencia de red). Cuando el equipo blockchain termine el programa
 * Solana, se cambia la implementación y no se toca una sola pantalla.
 *
 * Convención de retornos: cualquier método que emita una tx on-chain
 * devuelve `txSignature` (base58 en producción real, uuid en mock).
 */

export interface WalletConectada {
  address: string;
  balanceSol: number;
  balanceUsdc: number;
  network: 'mainnet-beta' | 'devnet' | 'mock';
}

export interface PublicarCampanaInput {
  tokenizacionId: string;
  toneladasOfrecidas: number;
  precioTokenUsd: number;
  productorWallet: string;
}

export interface PublicarCampanaResult {
  txSignature: string;
  mintAddress: string;
  vaultAddress: string;
}

export interface ReservarTokensInput {
  tokenizacionId: string;
  cantidad: number;
  inversorWallet: string;
}

export interface ReservaResult {
  reservaId: string;
  expiraEn: Date;
  precioUsdSnapshot: number;
}

export interface ConfirmarCompraResult {
  txSignature: string;
  tenenciaId: string;
  tokens: number;
  precioCompraUsd: number;
  montoTotalUsdc: number;
}

export interface ReclamarInput {
  tenenciaId: string;
  inversorWallet: string;
}

export interface ReclamarResult {
  txSignature: string;
  tokensQuemados: number;
  usdcRecibido: number;
}

/** release_funds: el vault se vacía hacia la wallet del productor. */
export interface LiberarFondosResult {
  txSignature: string;
  /** USDC que salió del vault. Se lee del saldo real del vault, no se calcula. */
  montoUsd: number;
}

/** settle: el acopio deposita lo que pagó por el grano entregado. */
export interface LiquidarInput {
  tokenizacionId: string;
  /** tons_delivered. Puede ser menor a lo vendido (sequía). Entero. */
  toneladasEntregadas: number;
  /** settlement_price en USD por tonelada. */
  precioLiquidacionUsdTn: number;
}

export interface LiquidarResult {
  txSignature: string;
  /** payout_per_token en USD: deposito / tokensVendidos, división entera en micro-USDC. */
  payoutPorTokenUsd: number;
  /** USDC que entraron al vault: toneladasEntregadas × precio. */
  depositoUsd: number;
}

/** Comisión de plataforma: transferencia SPL de USDC del pagador a la tesorería. */
export interface TransferirComisionInput {
  tokenizacionId: string;
  /** Usuario cuya wallet custodial paga (inversor en compra, productor en cobro). */
  pagadorUsuarioId: string;
  montoUsd: number;
  concepto: 'compra_inversor' | 'cobro_productor';
}

export interface TransferirComisionResult {
  txSignature: string;
  /** Address de la tesorería que recibió la comisión. */
  tesoreria: string;
}

export interface DisponibilidadResult {
  tokensEmitidos: number;
  tokensVendidos: number;
  tokensReservados: number;
  tokensDisponibles: number;
}

/**
 * Estado on-chain de una tokenización, listo para pintar en la UI.
 * Contrato acordado en HARVEST.md (VAL-18). El shape es idéntico al de
 * la cuenta `Campaign` del programa AgroToken; los `explorer.*` son URLs
 * completas listas para abrir, o null si el address no existe todavía.
 */
export interface EstadoOnChainResult {
  onChain: boolean;
  /// Estado on-chain: 'draft' antes de publicar; después mirror del status
  /// de la cuenta Campaign (Open, Funded, Settled, Refunded).
  status: 'draft' | 'open' | 'funded' | 'settled' | 'refunded';
  tonsOffered: number;
  tonsSold: number;
  minTons: number;
  pricePerTonUsd: number;
  /// Fecha en que se puede liquidar (fondeoHasta + margen). ISO string.
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

export abstract class LedgerService {
  /** Simula el flujo de "conectar wallet Phantom". Devuelve una wallet mock persistida. */
  abstract conectarWallet(usuarioId: string): Promise<WalletConectada>;

  /** Publica la campaña on-chain: crea Mint SPL + Vault PDA + registra params. */
  abstract publicarCampana(input: PublicarCampanaInput): Promise<PublicarCampanaResult>;

  /** Reserva temporal (TTL 10 min) para evitar sobreventa entre paso 1 y 2 del sheet de compra. */
  abstract reservarTokens(input: ReservarTokensInput): Promise<ReservaResult>;

  /** Confirma la reserva: transfiere USDC del inversor al vault y le entrega los tokens. */
  abstract confirmarCompra(reservaId: string): Promise<ConfirmarCompraResult>;

  /**
   * release_funds. Firma el productor. Solo con la campaña Open y
   * tons_sold >= min_tons. Vacía el vault completo hacia el productor.
   */
  abstract liberarFondos(tokenizacionId: string): Promise<LiberarFondosResult>;

  /**
   * settle. Firma el acopio (fee-payer de la plataforma). Solo con la campaña
   * Funded y now >= settlement_date. Deposita en el vault y fija payout_per_token.
   */
  abstract liquidar(input: LiquidarInput): Promise<LiquidarResult>;

  /** redeem. Solo con la campaña Settled: quema los tokens del inversor y le transfiere USDC del vault. */
  abstract reclamar(input: ReclamarInput): Promise<ReclamarResult>;

  /**
   * Cobra la comisión de plataforma: USDC de la wallet custodial del pagador
   * a la tesorería. Es una transferencia SPL común, no pasa por el programa.
   * La comisión queda verificable en el explorer con su propia signature.
   */
  abstract transferirComision(input: TransferirComisionInput): Promise<TransferirComisionResult>;

  /** Address pública de la tesorería de la plataforma (para mostrarla en la UI). */
  abstract tesoreriaAddress(): string;

  /** Disponibilidad actual de tokens para una tokenización. */
  abstract obtenerDisponibilidad(tokenizacionId: string): Promise<DisponibilidadResult>;

  /** Estado on-chain listo para pintar (con URLs al explorer). Público. */
  abstract obtenerEstadoOnChain(tokenizacionId: string): Promise<EstadoOnChainResult>;
}
