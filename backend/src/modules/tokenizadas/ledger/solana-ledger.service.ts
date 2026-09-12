import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import Decimal from 'decimal.js';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  ConfirmarCompraResult,
  DisponibilidadResult,
  EstadoOnChainResult,
  LedgerService,
  PublicarCampanaInput,
  PublicarCampanaResult,
  ReclamarInput,
  ReclamarResult,
  ReservaResult,
  ReservarTokensInput,
  WalletConectada,
} from './ledger.interface';
import { MockLedgerService } from './mock-ledger.service';
import { AnchorProgramService } from './solana/anchor-program.service';
import { SolanaConnectionService } from './solana/solana-connection.service';
import { WalletCustodianService } from './solana/wallet-custodian.service';

/**
 * Implementación real del ledger contra el programa Anchor AgroToken en devnet.
 *
 * Los métodos que aún no están implementados delegan al MockLedgerService.
 * La delegación desaparece cuando cada método real está listo.
 */
@Injectable()
export class SolanaLedgerService extends LedgerService {
  private readonly logger = new Logger(SolanaLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly custodian: WalletCustodianService,
    private readonly anchor: AnchorProgramService,
    private readonly conn: SolanaConnectionService,
    private readonly mock: MockLedgerService,
  ) {
    super();
  }

  async conectarWallet(usuarioId: string): Promise<WalletConectada> {
    const kp = await this.custodian.getOrCreateKeypair(usuarioId);
    await this.custodian.ensureFunded(usuarioId, kp);
    const balances = await this.custodian.getBalances(kp.publicKey);
    return {
      address: kp.publicKey.toBase58(),
      balanceSol: balances.sol,
      balanceUsdc: balances.usdc,
      network: 'devnet',
    };
  }

  async publicarCampana(input: PublicarCampanaInput): Promise<PublicarCampanaResult> {
    // Traemos el registro completo para derivar los args del programa.
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: input.tokenizacionId },
      include: {
        campania: { include: { cultivo: true } },
        productor: true,
      },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');
    if (!t.productor.walletAddress) {
      throw new BadRequestException('El productor no conectó su wallet');
    }

    // Idempotencia: si ya se publicó, devolvemos lo guardado.
    if (t.mintAddress && t.vaultAddress && t.txSignaturePublicacion) {
      return {
        txSignature: t.txSignaturePublicacion,
        mintAddress: t.mintAddress,
        vaultAddress: t.vaultAddress,
      };
    }

    const producerKp = await this.custodian.getOrCreateKeypair(t.productorId);

    // Args del programa
    const { id: campaignIdBig, le: campaignIdLe } = this.campaignIdFromUuid(t.id);
    const [campaignPda] = this.anchor.campaignPda(producerKp.publicKey, campaignIdLe);
    const [tokenMintPda] = this.anchor.mintPda(campaignPda);
    const usdcMint = this.custodian.usdcMint;
    const vaultAta = this.anchor.ata(usdcMint, campaignPda, true);

    const tonsOffered = new BN(t.toneladasOfrecidas.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString());
    // MVP: sin campo min_tons en BD, usamos 1 (mínimo posible) para no bloquear
    // release_funds en la demo si no se vende todo. Ajustar cuando la UI del
    // productor tenga el campo.
    const minTons = new BN(1);
    // precio en micro-USDC (6 decimales).
    const pricePerTon = new BN(
      t.precioTokenUsd.mul(new Decimal(1_000_000)).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString(),
    );

    const saleEnd = new BN(Math.floor(t.fondeoHasta.getTime() / 1000));
    const settlementDate = new BN(Math.floor(t.fondeoHasta.getTime() / 1000) + 90 * 24 * 60 * 60);

    const crop = this.padBytes(t.campania?.cultivo?.nombre ?? 'generico', 16);
    const season = this.padBytes(
      (t.campania?.anio ? String(t.campania.anio) : '2026').slice(0, 8),
      8,
    );

    // Acopio placeholder: fee-payer del backend. En prod real acá va la wallet
    // del acopio verificado que la tokenización eligió.
    const acopio = this.custodian.feePayer.publicKey;

    const program = this.anchor.programAs(producerKp);

    this.logger.log(
      `create_campaign: tokenizacion=${t.id} campaignId=${campaignIdBig} producer=${producerKp.publicKey.toBase58()}`,
    );

    const txSignature = await program.methods
      .createCampaign(
        new BN(campaignIdBig.toString()),
        Array.from(crop),
        Array.from(season),
        tonsOffered,
        minTons,
        pricePerTon,
        saleEnd,
        settlementDate,
        acopio,
      )
      .accountsPartial({
        producer: producerKp.publicKey,
        campaign: campaignPda,
        tokenMint: tokenMintPda,
        usdcMint,
        vault: vaultAta,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    await this.conn.confirmTx(txSignature);

    const mintAddress = tokenMintPda.toBase58();
    const vaultAddress = vaultAta.toBase58();
    await this.prisma.tokenizacionCampana.update({
      where: { id: t.id },
      data: {
        mintAddress,
        vaultAddress,
        txSignaturePublicacion: txSignature,
      },
    });

    this.logger.log(
      `Campaña publicada on-chain: tokenizacion=${t.id} mint=${mintAddress} tx=${txSignature}`,
    );

    return { txSignature, mintAddress, vaultAddress };
  }

  reservarTokens(input: ReservarTokensInput): Promise<ReservaResult> {
    // La reserva off-chain (TTL 10 min) sigue viviendo en Postgres.
    return this.mock.reservarTokens(input);
  }

  async confirmarCompra(reservaId: string): Promise<ConfirmarCompraResult> {
    const reserva = await this.prisma.reservaToken.findUnique({
      where: { id: reservaId },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    if (reserva.confirmada) throw new BadRequestException('Reserva ya confirmada');
    if (reserva.cancelada) throw new BadRequestException('Reserva cancelada');
    if (reserva.expiraEn < new Date()) throw new BadRequestException('Reserva expirada');

    const t = await this.prisma.tokenizacionCampana.findUniqueOrThrow({
      where: { id: reserva.tokenizacionId },
      include: { productor: true },
    });
    if (!t.mintAddress || !t.vaultAddress) {
      throw new BadRequestException('La campaña no fue publicada on-chain');
    }
    if (!t.productor.walletAddress) {
      throw new BadRequestException('El productor no tiene wallet');
    }

    const producerPubkey = new PublicKey(t.productor.walletAddress);
    const { le: campaignIdLe } = this.campaignIdFromUuid(t.id);
    const [campaignPda] = this.anchor.campaignPda(producerPubkey, campaignIdLe);
    const tokenMintPda = new PublicKey(t.mintAddress);
    const vaultAta = new PublicKey(t.vaultAddress);
    const usdcMint = this.custodian.usdcMint;

    const investorKp = await this.custodian.getOrCreateKeypair(reserva.inversorId);
    const investorUsdcAta = this.anchor.ata(usdcMint, investorKp.publicKey);
    const investorTokenAta = this.anchor.ata(tokenMintPda, investorKp.publicKey);

    const tons = Number(
      reserva.tokens.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString(),
    );
    const tonsBn = new BN(tons);

    const program = this.anchor.programAs(investorKp);

    this.logger.log(
      `invest: reserva=${reservaId} inversor=${investorKp.publicKey.toBase58()} tons=${tons}`,
    );

    const txSignature = await program.methods
      .invest(tonsBn)
      .accountsPartial({
        investor: investorKp.publicKey,
        campaign: campaignPda,
        tokenMint: tokenMintPda,
        vault: vaultAta,
        investorUsdc: investorUsdcAta,
        investorToken: investorTokenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    await this.conn.confirmTx(txSignature);

    // Idempotencia: si la BD ya tenía la tenencia por esta signature, no dupliques.
    const existente = await this.prisma.tenenciaToken.findFirst({
      where: { txSignatureCompra: txSignature },
    });
    if (existente) {
      return {
        txSignature,
        tenenciaId: existente.id,
        tokens: existente.tokens.toNumber(),
        precioCompraUsd: existente.precioCompraUsd.toNumber(),
        montoTotalUsdc: existente.montoTotalUsd.toNumber(),
      };
    }

    const precioCompraUsd = reserva.precioUsdSnapshot.toNumber();
    const montoTotalUsdc = new Decimal(tons).mul(precioCompraUsd);

    const tenencia = await this.prisma.$transaction(async (tx) => {
      const nueva = await tx.tenenciaToken.create({
        data: {
          tokenizacionId: reserva.tokenizacionId,
          inversorId: reserva.inversorId,
          walletAddress: investorKp.publicKey.toBase58(),
          tokens: reserva.tokens,
          precioCompraUsd: reserva.precioUsdSnapshot,
          montoTotalUsd: montoTotalUsdc,
          txSignatureCompra: txSignature,
        },
      });
      await tx.tokenizacionCampana.update({
        where: { id: reserva.tokenizacionId },
        data: {
          tokensVendidos: { increment: reserva.tokens },
          montoRecaudadoUsd: { increment: montoTotalUsdc },
        },
      });
      await tx.reservaToken.update({
        where: { id: reservaId },
        data: { confirmada: true },
      });
      return nueva;
    });

    this.logger.log(`Compra on-chain confirmada: tenencia=${tenencia.id} tx=${txSignature}`);

    return {
      txSignature,
      tenenciaId: tenencia.id,
      tokens: tons,
      precioCompraUsd,
      montoTotalUsdc: montoTotalUsdc.toNumber(),
    };
  }

  async reclamar(input: ReclamarInput): Promise<ReclamarResult> {
    const tenencia = await this.prisma.tenenciaToken.findUnique({
      where: { id: input.tenenciaId },
      include: { tokenizacion: { include: { productor: true } } },
    });
    if (!tenencia) throw new NotFoundException('Tenencia no encontrada');
    if (tenencia.estado !== 'activa') {
      throw new BadRequestException(`Tenencia en estado ${tenencia.estado}, no reclamable`);
    }
    const t = tenencia.tokenizacion;
    if (!t.precioLiquidacionUsdTn) {
      throw new BadRequestException('La campaña todavía no liquidó');
    }
    if (!t.mintAddress || !t.vaultAddress || !t.productor.walletAddress) {
      throw new BadRequestException('La campaña no está publicada on-chain');
    }

    const producerPubkey = new PublicKey(t.productor.walletAddress);
    const { le: campaignIdLe } = this.campaignIdFromUuid(t.id);
    const [campaignPda] = this.anchor.campaignPda(producerPubkey, campaignIdLe);
    const tokenMintPda = new PublicKey(t.mintAddress);
    const vaultAta = new PublicKey(t.vaultAddress);
    const usdcMint = this.custodian.usdcMint;

    // Antes de redimir, el programa requiere status = Settled. Si aún no lo
    // está, hacemos un "auto-flujo" que dispara release_funds + settle usando
    // wallets custodiales. En prod esto lo haría el keeper + el acopio;
    // acá lo colapsamos para que el inversor solo tenga que apretar reclamar.
    await this.ensureCampaignSettled(campaignPda, {
      producerKpUsuarioId: t.productorId,
      vaultAta,
      settlementPriceUsdTn: t.precioLiquidacionUsdTn.toNumber(),
      tokenizacionId: t.id,
    });

    const holderKp = await this.custodian.getOrCreateKeypair(tenencia.inversorId);
    const holderTokenAta = this.anchor.ata(tokenMintPda, holderKp.publicKey);
    const holderUsdcAta = this.anchor.ata(usdcMint, holderKp.publicKey);
    const amount = new BN(tenencia.tokens.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString());
    const program = this.anchor.programAs(holderKp);

    this.logger.log(
      `redeem: tenencia=${tenencia.id} holder=${holderKp.publicKey.toBase58()} amount=${amount.toString()}`,
    );

    const txSignature = await program.methods
      .redeem(amount)
      .accountsPartial({
        holder: holderKp.publicKey,
        campaign: campaignPda,
        tokenMint: tokenMintPda,
        vault: vaultAta,
        holderToken: holderTokenAta,
        holderUsdc: holderUsdcAta,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    await this.conn.confirmTx(txSignature);

    const tokensQuemados = Number(amount.toString());
    const usdcRecibido = new Decimal(tokensQuemados).mul(t.precioLiquidacionUsdTn);

    await this.prisma.tenenciaToken.update({
      where: { id: tenencia.id },
      data: {
        estado: 'liquidada',
        txSignatureCobro: txSignature,
        usdcRecibido,
        fechaCobro: new Date(),
      },
    });

    this.logger.log(`Reclamo confirmado: tenencia=${tenencia.id} tx=${txSignature}`);

    return {
      txSignature,
      tokensQuemados,
      usdcRecibido: usdcRecibido.toNumber(),
    };
  }

  async obtenerEstadoOnChain(tokenizacionId: string): Promise<EstadoOnChainResult> {
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
      include: { productor: true, campania: true },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');

    const cluster = this.detectarCluster();
    const producerWallet = t.productor.walletAddress;

    // Sin mint address todavía → todavía no se publicó.
    if (!t.mintAddress || !producerWallet) {
      return {
        onChain: false,
        status: 'draft',
        tonsOffered: t.toneladasOfrecidas.toNumber(),
        tonsSold: t.tokensVendidos.toNumber(),
        minTons: 1,
        pricePerTonUsd: t.precioTokenUsd.toNumber(),
        settlementDate: null,
        tonsDelivered: null,
        settlementPriceUsd: t.precioLiquidacionUsdTn?.toNumber() ?? null,
        payoutPerTokenUsd: null,
        vaultBalanceUsd: 0,
        addresses: {
          campaign: null,
          tokenMint: null,
          vault: null,
          producer: producerWallet,
          acopio: this.custodian.feePayer?.publicKey.toBase58() ?? null,
        },
        explorer: { campaign: null, tokenMint: null, vault: null },
      };
    }

    const producerPubkey = new PublicKey(producerWallet);
    const { le } = this.campaignIdFromUuid(t.id);
    const [campaignPda] = this.anchor.campaignPda(producerPubkey, le);
    const campaignAddress = campaignPda.toBase58();

    // Estos son los defaults si no podemos leer on-chain (BD como fallback).
    let status: EstadoOnChainResult['status'] = 'open';
    let tonsSold = t.tokensVendidos.toNumber();
    let tonsDelivered: number | null = null;
    let settlementPriceUsd: number | null = t.precioLiquidacionUsdTn?.toNumber() ?? null;
    let payoutPerTokenUsd: number | null = null;
    let settlementDateMs: number | null = null;
    let minTons = 1;

    try {
      const program = this.anchor.programAs(this.custodian.feePayer);
      const account = await program.account.campaign.fetch(campaignPda);

      tonsSold = Number((account.tonsSold as BN).toString());
      minTons = Number((account.minTons as BN).toString()) || 1;

      const acctStatus = account.status as Record<string, unknown>;
      if ('refunded' in acctStatus) status = 'refunded';
      else if ('settled' in acctStatus) status = 'settled';
      else if ('funded' in acctStatus) status = 'funded';
      else status = 'open';

      const settlementDateBn = account.settlementDate as BN | undefined;
      if (settlementDateBn) settlementDateMs = Number(settlementDateBn.toString()) * 1000;

      const tonsDeliveredBn = account.tonsDelivered as BN | undefined;
      if (tonsDeliveredBn) tonsDelivered = Number(tonsDeliveredBn.toString()) || null;

      const settlementPriceBn = account.settlementPrice as BN | undefined;
      if (settlementPriceBn) {
        const micro = Number(settlementPriceBn.toString());
        if (micro > 0) settlementPriceUsd = micro / 1_000_000;
      }

      const payoutBn = account.payoutPerToken as BN | undefined;
      if (payoutBn) {
        const micro = Number(payoutBn.toString());
        if (micro > 0) payoutPerTokenUsd = micro / 1_000_000;
      }
    } catch (err) {
      this.logger.warn(`No pude leer campaign PDA (${campaignAddress}): ${(err as Error).message}`);
    }

    // Payout se cae al settlement price cuando 1 token = 1 tonelada
    // (el programa lo calcula así con división entera de micro-USDC).
    if (payoutPerTokenUsd === null && status === 'settled' && settlementPriceUsd) {
      payoutPerTokenUsd = settlementPriceUsd;
    }

    // Balance del vault: lo leemos directo del ATA.
    let vaultBalanceUsd = 0;
    try {
      const vaultAta = new PublicKey(t.vaultAddress!);
      const bal = await this.conn.connection.getTokenAccountBalance(vaultAta);
      vaultBalanceUsd = bal.value.uiAmount ?? 0;
    } catch (err) {
      this.logger.warn(`No pude leer vault balance (${t.vaultAddress}): ${(err as Error).message}`);
    }

    return {
      onChain: true,
      status,
      tonsOffered: t.toneladasOfrecidas.toNumber(),
      tonsSold,
      minTons,
      pricePerTonUsd: t.precioTokenUsd.toNumber(),
      settlementDate: settlementDateMs ? new Date(settlementDateMs).toISOString() : null,
      tonsDelivered,
      settlementPriceUsd,
      payoutPerTokenUsd,
      vaultBalanceUsd,
      addresses: {
        campaign: campaignAddress,
        tokenMint: t.mintAddress,
        vault: t.vaultAddress,
        producer: producerWallet,
        acopio: this.custodian.feePayer?.publicKey.toBase58() ?? null,
      },
      explorer: {
        campaign: this.explorerUrl(campaignAddress, cluster),
        tokenMint: this.explorerUrl(t.mintAddress, cluster),
        vault: this.explorerUrl(t.vaultAddress, cluster),
      },
    };
  }

  /** Deriva el cluster del RPC endpoint. */
  private detectarCluster(): 'mainnet-beta' | 'devnet' | 'testnet' | 'custom' {
    const url = this.conn.connection?.rpcEndpoint ?? '';
    if (url.includes('devnet')) return 'devnet';
    if (url.includes('testnet')) return 'testnet';
    if (url.includes('mainnet')) return 'mainnet-beta';
    return 'custom';
  }

  /** URL al Solana Explorer para el cluster activo. Null si address está vacío. */
  private explorerUrl(address: string | null, cluster: 'mainnet-beta' | 'devnet' | 'testnet' | 'custom'): string | null {
    if (!address) return null;
    const base = `https://explorer.solana.com/address/${address}`;
    if (cluster === 'mainnet-beta') return base;
    if (cluster === 'custom') {
      const rpc = encodeURIComponent(this.conn.connection?.rpcEndpoint ?? '');
      return `${base}?cluster=custom&customUrl=${rpc}`;
    }
    return `${base}?cluster=${cluster}`;
  }

  async obtenerDisponibilidad(tokenizacionId: string): Promise<DisponibilidadResult> {
    // Reservas siguen siendo off-chain; para tokensVendidos, si la campaña ya
    // está publicada on-chain leemos del programa (fuente de verdad). Si no,
    // caemos al mock que lee la BD.
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
      include: { productor: true },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');

    const emitidos = t.tokensEmitidos.toNumber();

    let vendidos = t.tokensVendidos.toNumber();
    if (t.mintAddress && t.productor.walletAddress) {
      try {
        const producerPubkey = new PublicKey(t.productor.walletAddress);
        const { le } = this.campaignIdFromUuid(t.id);
        const [campaignPda] = this.anchor.campaignPda(producerPubkey, le);
        const program = this.anchor.programAs(this.custodian.feePayer);
        const account = await program.account.campaign.fetch(campaignPda);
        vendidos = Number((account.tonsSold as BN).toString());
      } catch (err) {
        this.logger.warn(`No pude leer campaign PDA on-chain, uso BD: ${(err as Error).message}`);
      }
    }

    const reservasVigentes = await this.prisma.reservaToken.aggregate({
      _sum: { tokens: true },
      where: {
        tokenizacionId,
        confirmada: false,
        cancelada: false,
        expiraEn: { gt: new Date() },
      },
    });
    const reservados = reservasVigentes._sum.tokens?.toNumber() ?? 0;
    const disponibles = Math.max(0, emitidos - vendidos - reservados);

    return {
      tokensEmitidos: emitidos,
      tokensVendidos: vendidos,
      tokensReservados: reservados,
      tokensDisponibles: disponibles,
    };
  }

  /**
   * Antes de un redeem, garantiza que la campaña on-chain esté en status
   * Settled. Si está Open dispara release_funds (firma el productor), si
   * está Funded dispara settle (firma el acopio = fee-payer).
   * Idempotente: chequea el status actual antes de cada CPI.
   */
  private async ensureCampaignSettled(
    campaignPda: PublicKey,
    ctx: {
      producerKpUsuarioId: string;
      vaultAta: PublicKey;
      settlementPriceUsdTn: number;
      tokenizacionId: string;
    },
  ): Promise<void> {
    const program = this.anchor.programAs(this.custodian.feePayer);
    let account = await program.account.campaign.fetch(campaignPda);

    if ('open' in account.status) {
      // Necesita release_funds primero. Solo funciona si tons_sold >= min_tons.
      const producerKp = await this.custodian.getOrCreateKeypair(ctx.producerKpUsuarioId);
      const producerUsdc = this.anchor.ata(this.custodian.usdcMint, producerKp.publicKey);

      // Nos aseguramos que la ATA del productor exista (para recibir USDC).
      // Si no existe, el token program falla; el mock nunca la crea.
      // Truco: la mintTo previa a nombre del producer ya la creó, y si no,
      // la instrucción release_funds falla, pero es más seguro no crearla acá
      // (el flujo del wallet-custodian ya crea ATA de USDC al conectar).

      this.logger.log(`Auto release_funds: campaign=${campaignPda.toBase58()}`);
      const releaseTx = await this.anchor
        .programAs(producerKp)
        .methods.releaseFunds()
        .accountsPartial({
          producer: producerKp.publicKey,
          campaign: campaignPda,
          vault: ctx.vaultAta,
          producerUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      await this.conn.confirmTx(releaseTx);
      account = await program.account.campaign.fetch(campaignPda);
    }

    if ('funded' in account.status) {
      // Settle firmado por el acopio (fee-payer). tons_delivered = tons_sold
      // (entrega completa por default para la demo). settlement_price viene
      // de precioLiquidacionUsdTn (USD/tn) → micro-USDC/tn.
      const acopioKp = this.custodian.feePayer;
      const acopioUsdc = this.anchor.ata(this.custodian.usdcMint, acopioKp.publicKey);
      const tonsSold = account.tonsSold as BN;
      const settlementPriceMicro = new BN(
        new Decimal(ctx.settlementPriceUsdTn).mul(1_000_000).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString(),
      );

      this.logger.log(
        `Auto settle: campaign=${campaignPda.toBase58()} tonsDelivered=${tonsSold} priceMicro=${settlementPriceMicro}`,
      );

      // settle valida now >= settlement_date. Si aún no llegó, error TooEarly.
      // Para el hackathon la fecha de fondeo_hasta + 90 días suele estar en el
      // futuro; documentamos que la primera vez que el productor liquida hay
      // que backdate-ar precio_liquidacion_usd_tn cuando sale_end ya pasó o
      // usar wallets nuevas con settlement_date corto.
      const settleTx = await this.anchor
        .programAs(acopioKp)
        .methods.settle(tonsSold, settlementPriceMicro)
        .accountsPartial({
          acopio: acopioKp.publicKey,
          campaign: campaignPda,
          vault: ctx.vaultAta,
          acopioUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      await this.conn.confirmTx(settleTx);
    }
    // Si ya está Settled, no hacemos nada.
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Deriva `campaign_id` (u64) del uuid de la tokenización.
   * Toma los primeros 16 hex chars (8 bytes = 64 bits) → cabe en un u64.
   * Colisiones prácticas: probabilidad despreciable con 128 bits del uuid.
   */
  private campaignIdFromUuid(uuid: string): { id: bigint; le: Buffer } {
    const hex = uuid.replace(/-/g, '').slice(0, 16);
    const id = BigInt(`0x${hex}`);
    const le = Buffer.alloc(8);
    le.writeBigUInt64LE(id);
    return { id, le };
  }

  /** Rellena a la derecha con ceros hasta `len` bytes. */
  private padBytes(s: string, len: number): Uint8Array {
    const buf = Buffer.alloc(len);
    buf.write(s.slice(0, len));
    return new Uint8Array(buf);
  }
}
