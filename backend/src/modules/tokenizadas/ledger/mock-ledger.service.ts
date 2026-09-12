import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  LedgerService,
  WalletConectada,
  PublicarCampanaInput,
  PublicarCampanaResult,
  ReservarTokensInput,
  ReservaResult,
  ConfirmarCompraResult,
  ReclamarInput,
  ReclamarResult,
  DisponibilidadResult,
} from './ledger.interface';

/**
 * Implementación mock del LedgerService. Persiste todo en Postgres, agrega
 * delays artificiales para simular latencia de firma on-chain, y genera
 * direcciones fake con el formato base58 de Solana.
 *
 * Cuando el equipo blockchain termine el programa Solana, se implementa
 * SolanaLedgerService y se cambia el provider en el módulo — nada más.
 */
@Injectable()
export class MockLedgerService extends LedgerService {
  private readonly logger = new Logger(MockLedgerService.name);
  /** TTL de una reserva de tokens: 10 minutos (§8.3 del hackaton.md). */
  private readonly RESERVA_TTL_MS = 10 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async conectarWallet(usuarioId: string): Promise<WalletConectada> {
    await this.delay(300, 800);

    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // Si el usuario ya tenía wallet conectada, la devolvemos con balance mock actualizado.
    // Si no, generamos una address y la persistimos.
    let address = usuario.walletAddress;
    if (!address) {
      address = this.generarAddressSolana();
      await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { walletAddress: address },
      });
      this.logger.log(`Wallet conectada por primera vez: ${usuarioId} → ${address}`);
    }

    return {
      address,
      // Balance mock: entre 0.5 y 5 SOL, entre 100 y 50k USDC.
      balanceSol: this.aleatorio(0.5, 5, 2),
      balanceUsdc: this.aleatorio(100, 50000, 2),
      network: 'mock',
    };
  }

  async publicarCampana(input: PublicarCampanaInput): Promise<PublicarCampanaResult> {
    await this.delay(1500, 3500); // firma on-chain típica: 1.5–3.5s

    const mintAddress = this.generarAddressSolana();
    const vaultAddress = this.generarAddressSolana();
    const txSignature = this.generarTxSignature();

    await this.prisma.tokenizacionCampana.update({
      where: { id: input.tokenizacionId },
      data: {
        mintAddress,
        vaultAddress,
        txSignaturePublicacion: txSignature,
      },
    });

    this.logger.log(
      `Campaña publicada on-chain: tokenizacion=${input.tokenizacionId} mint=${mintAddress} tx=${txSignature}`,
    );

    return { txSignature, mintAddress, vaultAddress };
  }

  async reservarTokens(input: ReservarTokensInput): Promise<ReservaResult> {
    await this.delay(200, 500);

    const tokenizacion = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: input.tokenizacionId },
    });
    if (!tokenizacion) throw new NotFoundException('Tokenización no encontrada');

    const inversor = await this.prisma.usuario.findFirst({
      where: { walletAddress: input.inversorWallet },
    });
    if (!inversor) throw new BadRequestException('Wallet no vinculada a un usuario');

    const disponibilidad = await this.obtenerDisponibilidad(input.tokenizacionId);
    if (input.cantidad > disponibilidad.tokensDisponibles) {
      throw new BadRequestException(
        `Sobreventa: pediste ${input.cantidad}, disponibles ${disponibilidad.tokensDisponibles}`,
      );
    }

    const expiraEn = new Date(Date.now() + this.RESERVA_TTL_MS);
    const reserva = await this.prisma.reservaToken.create({
      data: {
        tokenizacionId: input.tokenizacionId,
        inversorId: inversor.id,
        walletAddress: input.inversorWallet,
        tokens: new Decimal(input.cantidad),
        precioUsdSnapshot: tokenizacion.precioTokenUsd,
        expiraEn,
      },
    });

    return {
      reservaId: reserva.id,
      expiraEn,
      precioUsdSnapshot: tokenizacion.precioTokenUsd.toNumber(),
    };
  }

  async confirmarCompra(reservaId: string): Promise<ConfirmarCompraResult> {
    await this.delay(1200, 2800);

    const reserva = await this.prisma.reservaToken.findUnique({
      where: { id: reservaId },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    if (reserva.confirmada) throw new BadRequestException('Reserva ya confirmada');
    if (reserva.cancelada) throw new BadRequestException('Reserva cancelada');
    if (reserva.expiraEn < new Date()) throw new BadRequestException('Reserva expirada');

    const tokens = reserva.tokens.toNumber();
    const precioCompraUsd = reserva.precioUsdSnapshot.toNumber();
    const montoTotalUsdc = new Decimal(tokens).mul(precioCompraUsd);
    const txSignature = this.generarTxSignature();

    const tenencia = await this.prisma.$transaction(async (tx) => {
      const nuevaTenencia = await tx.tenenciaToken.create({
        data: {
          tokenizacionId: reserva.tokenizacionId,
          inversorId: reserva.inversorId,
          walletAddress: reserva.walletAddress,
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

      return nuevaTenencia;
    });

    this.logger.log(
      `Compra confirmada: tenencia=${tenencia.id} tokens=${tokens} usdc=${montoTotalUsdc.toString()} tx=${txSignature}`,
    );

    return {
      txSignature,
      tenenciaId: tenencia.id,
      tokens,
      precioCompraUsd,
      montoTotalUsdc: montoTotalUsdc.toNumber(),
    };
  }

  async reclamar(input: ReclamarInput): Promise<ReclamarResult> {
    await this.delay(1500, 3500);

    const tenencia = await this.prisma.tenenciaToken.findUnique({
      where: { id: input.tenenciaId },
      include: { tokenizacion: true },
    });
    if (!tenencia) throw new NotFoundException('Tenencia no encontrada');
    if (tenencia.walletAddress !== input.inversorWallet) {
      throw new BadRequestException('La wallet no corresponde a esta tenencia');
    }
    if (tenencia.estado !== 'activa') {
      throw new BadRequestException(`Tenencia en estado ${tenencia.estado}, no reclamable`);
    }
    if (!tenencia.tokenizacion.precioLiquidacionUsdTn) {
      throw new BadRequestException('La campaña todavía no liquidó');
    }

    const tokens = tenencia.tokens.toNumber();
    // 1 token = 1 tonelada. USDC a recibir = tokens × precio de liquidación.
    const usdcRecibido = new Decimal(tokens).mul(tenencia.tokenizacion.precioLiquidacionUsdTn);
    const txSignature = this.generarTxSignature();

    await this.prisma.tenenciaToken.update({
      where: { id: input.tenenciaId },
      data: {
        estado: 'liquidada',
        txSignatureCobro: txSignature,
        usdcRecibido,
        fechaCobro: new Date(),
      },
    });

    this.logger.log(
      `Cobro atómico (quema + payout): tenencia=${tenencia.id} tokens=${tokens} usdc=${usdcRecibido.toString()} tx=${txSignature}`,
    );

    return {
      txSignature,
      tokensQuemados: tokens,
      usdcRecibido: usdcRecibido.toNumber(),
    };
  }

  async obtenerDisponibilidad(tokenizacionId: string): Promise<DisponibilidadResult> {
    const tokenizacion = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
    });
    if (!tokenizacion) throw new NotFoundException('Tokenización no encontrada');

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
    const emitidos = tokenizacion.tokensEmitidos.toNumber();
    const vendidos = tokenizacion.tokensVendidos.toNumber();
    const disponibles = emitidos - vendidos - reservados;

    return {
      tokensEmitidos: emitidos,
      tokensVendidos: vendidos,
      tokensReservados: reservados,
      tokensDisponibles: Math.max(0, disponibles),
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /** Delay aleatorio entre min y max ms — simula latencia de red on-chain. */
  private async delay(minMs: number, maxMs: number): Promise<void> {
    const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Genera una address base58 fake de 44 chars, formato Solana. */
  private generarAddressSolana(): string {
    const alfabeto = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let addr = '';
    for (let i = 0; i < 44; i++) {
      addr += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    }
    return addr;
  }

  /** Firma de transacción fake — 88 chars base58 en Solana real. */
  private generarTxSignature(): string {
    return this.generarAddressSolana() + this.generarAddressSolana();
  }

  private aleatorio(min: number, max: number, decimales = 2): number {
    const raw = min + Math.random() * (max - min);
    return Math.round(raw * 10 ** decimales) / 10 ** decimales;
  }
}
