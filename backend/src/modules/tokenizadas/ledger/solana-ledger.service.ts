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
  LiberarFondosResult,
  LiquidarInput,
  LiquidarResult,
  ReclamarInput,
  ReclamarResult,
  ReservaResult,
  ReservarTokensInput,
  WalletConectada,
} from './ledger.interface';
import { MockLedgerService } from './mock-ledger.service';
import { AnchorProgramService } from './solana/anchor-program.service';
import { microUsdcToUsd, usdToMicroUsdc } from './solana/micro-usdc.util';
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
    const minTons = new BN(
      t.toneladasMinimas.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString(),
    );
    const pricePerTon = new BN(usdToMicroUsdc(t.precioTokenUsd).toString());

    const saleEnd = new BN(Math.floor(t.fondeoHasta.getTime() / 1000));
    // Si el productor no fijó fecha objetivo, fallback a fondeoHasta + 90 días.
    const settlementSecs = t.fechaLiquidacionEstimada
      ? Math.floor(t.fechaLiquidacionEstimada.getTime() / 1000)
      : Math.floor(t.fondeoHasta.getTime() / 1000) + 90 * 24 * 60 * 60;
    const settlementDate = new BN(settlementSecs);

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

  /**
   * release_funds. Firma el productor con su keypair custodial. El programa
   * valida Open y tons_sold >= min_tons; el monto se lee del saldo real del
   * vault antes de la tx (si alguien mandó USDC de más, va al productor).
   */
  async liberarFondos(tokenizacionId: string): Promise<LiberarFondosResult> {
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
      include: { productor: true },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');
    if (!t.mintAddress || !t.vaultAddress || !t.productor.walletAddress) {
      throw new BadRequestException('La campaña no está publicada on-chain');
    }
    // Idempotencia: si ya se liberó, devolvemos lo guardado.
    if (t.txSignatureLiberacion) {
      return { txSignature: t.txSignatureLiberacion, montoUsd: t.montoRecaudadoUsd.toNumber() };
    }

    const { campaignPda, vaultAta } = this.derivarCuentas(t.id, t.productor.walletAddress, t.vaultAddress);
    const estado = await this.leerStatus(campaignPda);
    if (estado !== 'open') {
      throw new BadRequestException(`La campaña on-chain está en estado ${estado}, no se puede liberar`);
    }

    const producerKp = await this.custodian.getOrCreateKeypair(t.productorId);
    // La ATA de USDC del productor la crea ensureFunded al conectar la wallet.
    // Si por algún motivo no existe, la creamos con saldo 0 para que la CPI no falle.
    const producerUsdc = await this.custodian.ensureUsdcBalance(producerKp.publicKey, 0n);

    const vaultBalance = await this.conn.connection.getTokenAccountBalance(vaultAta);
    const montoUsd = vaultBalance.value.uiAmount ?? 0;

    this.logger.log(
      `release_funds: tokenizacion=${t.id} producer=${producerKp.publicKey.toBase58()} vault=${montoUsd} USDC`,
    );

    const txSignature = await this.anchor
      .programAs(producerKp)
      .methods.releaseFunds()
      .accountsPartial({
        producer: producerKp.publicKey,
        campaign: campaignPda,
        vault: vaultAta,
        producerUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    await this.conn.confirmTx(txSignature);

    this.logger.log(`Fondos liberados: tokenizacion=${t.id} tx=${txSignature}`);
    return { txSignature, montoUsd };
  }

  /**
   * settle. Firma el acopio, que en la demo es el fee-payer de la plataforma.
   * Como el fee-payer es la mint authority del USDC de prueba, se acuña el
   * depósito antes de la CPI: es la simulación de "el acopio pagó el grano".
   * El payout se lee de la cuenta Campaign después de la tx: es lo que el
   * programa calculó, no lo que nosotros creemos.
   */
  async liquidar(input: LiquidarInput): Promise<LiquidarResult> {
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: input.tokenizacionId },
      include: { productor: true },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');
    if (!t.mintAddress || !t.vaultAddress || !t.productor.walletAddress) {
      throw new BadRequestException('La campaña no está publicada on-chain');
    }
    if (t.txSignatureLiquidacion && t.payoutPorTokenUsd) {
      return {
        txSignature: t.txSignatureLiquidacion,
        payoutPorTokenUsd: t.payoutPorTokenUsd.toNumber(),
        depositoUsd: new Decimal(t.toneladasEntregadas ?? 0).mul(t.precioLiquidacionUsdTn ?? 0).toNumber(),
      };
    }

    const { campaignPda, vaultAta } = this.derivarCuentas(t.id, t.productor.walletAddress, t.vaultAddress);
    const estado = await this.leerStatus(campaignPda);
    if (estado !== 'funded') {
      throw new BadRequestException(
        `La campaña on-chain está en estado ${estado}. Para liquidar, el productor tiene que liberar los fondos primero`,
      );
    }

    const tonsDelivered = new BN(Math.floor(input.toneladasEntregadas));
    const settlementPriceMicro = new BN(usdToMicroUsdc(new Decimal(input.precioLiquidacionUsdTn)).toString());
    const depositoMicro = BigInt(tonsDelivered.mul(settlementPriceMicro).toString());

    const acopioKp = this.custodian.feePayer;
    const acopioUsdc = await this.custodian.ensureUsdcBalance(acopioKp.publicKey, depositoMicro);

    this.logger.log(
      `settle: tokenizacion=${t.id} tonsDelivered=${tonsDelivered} priceMicro=${settlementPriceMicro} deposito=${depositoMicro}`,
    );

    const program = this.anchor.programAs(acopioKp);
    const txSignature = await program.methods
      .settle(tonsDelivered, settlementPriceMicro)
      .accountsPartial({
        acopio: acopioKp.publicKey,
        campaign: campaignPda,
        vault: vaultAta,
        acopioUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    await this.conn.confirmTx(txSignature);

    const account = await program.account.campaign.fetch(campaignPda);
    const payoutMicro = new Decimal((account.payoutPerToken as BN).toString());

    this.logger.log(`Campaña liquidada: tokenizacion=${t.id} payoutMicro=${payoutMicro} tx=${txSignature}`);
    return {
      txSignature,
      payoutPorTokenUsd: microUsdcToUsd(BigInt(payoutMicro.toString())),
      depositoUsd: microUsdcToUsd(depositoMicro),
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
    if (!t.mintAddress || !t.vaultAddress || !t.productor.walletAddress) {
      throw new BadRequestException('La campaña no está publicada on-chain');
    }

    const { campaignPda, vaultAta } = this.derivarCuentas(t.id, t.productor.walletAddress, t.vaultAddress);
    const tokenMintPda = new PublicKey(t.mintAddress);
    const usdcMint = this.custodian.usdcMint;

    // redeem exige Settled. Ya no se auto-dispara release_funds ni settle:
    // son pasos propios (liberarFondos / liquidar) que firman el productor y
    // el acopio de forma visible.
    const estado = await this.leerStatus(campaignPda);
    if (estado !== 'settled') {
      throw new BadRequestException(
        `La campaña todavía no liquidó (estado on-chain: ${estado}). Cuando el acopio liquide vas a poder cobrar`,
      );
    }
    const payoutPorToken = t.payoutPorTokenUsd ?? t.precioLiquidacionUsdTn;
    if (!payoutPorToken) {
      throw new BadRequestException('La campaña no tiene payout registrado');
    }

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
    const usdcRecibido = new Decimal(tokensQuemados).mul(payoutPorToken);

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
        minTons: t.toneladasMinimas.toNumber(),
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
    let settlementDateMs: number | null = t.fechaLiquidacionEstimada?.getTime() ?? null;
    let minTons = t.toneladasMinimas.toNumber();

    try {
      const program = this.anchor.programAs(this.custodian.feePayer);
      const account = await program.account.campaign.fetch(campaignPda);

      tonsSold = Number((account.tonsSold as BN).toString());
      const onChainMinTons = Number((account.minTons as BN).toString());
      if (onChainMinTons > 0) minTons = onChainMinTons;

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
        if (micro > 0) settlementPriceUsd = microUsdcToUsd(micro);
      }

      const payoutBn = account.payoutPerToken as BN | undefined;
      if (payoutBn) {
        const micro = Number(payoutBn.toString());
        if (micro > 0) payoutPerTokenUsd = microUsdcToUsd(micro);
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

  // ─── Helpers ─────────────────────────────────────────────────

  /** Deriva la PDA de la campaña y el vault a partir de lo persistido. */
  private derivarCuentas(
    tokenizacionId: string,
    productorWallet: string,
    vaultAddress: string,
  ): { campaignPda: PublicKey; vaultAta: PublicKey } {
    const producerPubkey = new PublicKey(productorWallet);
    const { le } = this.campaignIdFromUuid(tokenizacionId);
    const [campaignPda] = this.anchor.campaignPda(producerPubkey, le);
    return { campaignPda, vaultAta: new PublicKey(vaultAddress) };
  }

  /** Estado on-chain de la campaña. Anchor serializa el enum como `{ open: {} }`. */
  private async leerStatus(campaignPda: PublicKey): Promise<'draft' | 'open' | 'funded' | 'settled' | 'failed'> {
    const program = this.anchor.programAs(this.custodian.feePayer);
    const account = await program.account.campaign.fetch(campaignPda);
    const status = account.status as Record<string, unknown>;
    const clave = Object.keys(status)[0] as 'draft' | 'open' | 'funded' | 'settled' | 'failed' | undefined;
    if (!clave) throw new BadRequestException('No pude leer el estado on-chain de la campaña');
    return clave;
  }

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
