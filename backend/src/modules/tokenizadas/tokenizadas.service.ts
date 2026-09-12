import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger/ledger.interface';
import {
  CrearTokenizacionDto,
  RevisarTokenizacionDto,
  ListarMarketplaceDto,
  LiquidarTokenizacionDto,
} from './dto/tokenizacion.dto';
import { ListarComisionesDto } from './dto/comisiones.dto';
import { calcularComision, COMISION_PLATAFORMA_PCT } from './comisiones';

/**
 * Orquesta el flujo de tokenización: creación → revisión ADMIN → publicación
 * on-chain → compra → liquidación → reclamo.
 *
 * La lógica on-chain (mint, vault, transferencias) vive detrás de LedgerService.
 * Esta clase se encarga de la persistencia, validaciones de negocio y agregados.
 */
@Injectable()
export class TokenizadasService {
  private readonly logger = new Logger(TokenizadasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  // ─── Wallet ────────────────────────────────────────────────────

  async conectarWallet(usuarioId: string) {
    return this.ledger.conectarWallet(usuarioId);
  }

  // ─── Productor: crear tokenización ─────────────────────────────

  async crear(usuarioId: string, cuentaId: string, dto: CrearTokenizacionDto) {
    // Si viene campaniaNueva, la crea inline. Sino usa la campaniaId.
    let campaniaId = dto.campaniaId;
    if (!campaniaId && dto.campaniaNueva) {
      const nueva = await this.prisma.campania.create({
        data: {
          cuentaId,
          nombre: dto.campaniaNueva.nombre,
          establecimientoId: dto.campaniaNueva.establecimientoId,
          cultivoId: dto.campaniaNueva.cultivoId,
          cicloAgricola: dto.campaniaNueva.cicloAgricola,
          hectareasAfectadas: new Decimal(dto.campaniaNueva.hectareasAfectadas),
          fechaSiembraEstimada: new Date(dto.campaniaNueva.fechaSiembraEstimada),
          fechaCosechaEstimada: new Date(dto.campaniaNueva.fechaCosechaEstimada),
          rindeEstimadoTnHa: new Decimal(dto.campaniaNueva.rindeEstimadoTnHa),
          estadoToken: 'borrador',
          fechaInicio: new Date(dto.campaniaNueva.fechaSiembraEstimada),
          fechaFin: new Date(dto.campaniaNueva.fechaCosechaEstimada),
        },
      });
      campaniaId = nueva.id;
    }

    if (!campaniaId) throw new BadRequestException('Falta campaniaId o campaniaNueva');

    const campania = await this.prisma.campania.findUnique({
      where: { id: campaniaId },
      include: { establecimiento: true, cultivo: true },
    });
    if (!campania) throw new NotFoundException('Campaña no encontrada');
    if (campania.cuentaId !== cuentaId) throw new ForbiddenException('Campaña de otra cuenta');
    if (!campania.hectareasAfectadas || !campania.rindeEstimadoTnHa) {
      throw new BadRequestException('La campaña necesita hectáreas y rinde estimado para tokenizar');
    }

    // Producción estimada = ha × rinde.
    const produccionTn = new Decimal(campania.hectareasAfectadas).mul(campania.rindeEstimadoTnHa);

    // Toneladas ofrecidas según el modo.
    let toneladasOfrecidas: Decimal;
    if (dto.modo === 'porcentual') {
      toneladasOfrecidas = produccionTn.mul(dto.porcentaje!).div(100);
    } else {
      toneladasOfrecidas = new Decimal(dto.toneladasFijas!);
      if (toneladasOfrecidas.gt(produccionTn)) {
        throw new BadRequestException(
          `Las toneladas fijas (${toneladasOfrecidas}) superan la producción estimada (${produccionTn})`,
        );
      }
    }

    // Precio del token derivado.
    const precioTokenUsd = new Decimal(dto.precioReferenciaUsdTn).mul(
      new Decimal(1).sub(new Decimal(dto.descuentoPct).div(100)),
    );
    const montoObjetivoUsd = toneladasOfrecidas.mul(precioTokenUsd);

    // Upsert: si la campaña ya tenía tokenización, la actualizamos.
    const existente = await this.prisma.tokenizacionCampana.findUnique({ where: { campaniaId } });
    const data = {
      campaniaId,
      productorId: usuarioId,
      modo: dto.modo,
      porcentaje: dto.modo === 'porcentual' ? new Decimal(dto.porcentaje!) : null,
      toneladasFijas: dto.modo === 'fijo' ? new Decimal(dto.toneladasFijas!) : null,
      toneladasOfrecidas,
      tokensEmitidos: toneladasOfrecidas, // 1 token = 1 tonelada (o unidad fraccional en porcentual)
      fuentePrecio: dto.fuentePrecio,
      precioReferenciaUsdTn: new Decimal(dto.precioReferenciaUsdTn),
      descuentoPct: new Decimal(dto.descuentoPct),
      precioTokenUsd,
      precioDinamico: dto.precioDinamico,
      precioPisoUsd: dto.precioPisoUsd ? new Decimal(dto.precioPisoUsd) : null,
      fondeoDesde: new Date(dto.fondeoDesde),
      fondeoHasta: new Date(dto.fondeoHasta),
      fechaLiquidacionEstimada: dto.fechaLiquidacionEstimada
        ? new Date(dto.fechaLiquidacionEstimada)
        : null,
      toneladasMinimas:
        dto.toneladasMinimas !== undefined ? new Decimal(dto.toneladasMinimas) : new Decimal(1),
      montoObjetivoUsd,
      tieneSeguroGranizo: dto.tieneSeguroGranizo,
      tieneSeguroParametrico: dto.tieneSeguroParametrico,
      tieneAvalSgr: dto.tieneAvalSgr,
      sobrecolateralPct: new Decimal(dto.sobrecolateralPct),
    };

    const tokenizacion = existente
      ? await this.prisma.tokenizacionCampana.update({ where: { id: existente.id }, data })
      : await this.prisma.tokenizacionCampana.create({ data });

    // Sincronizar estado de la campaña al borrador.
    await this.prisma.campania.update({
      where: { id: campaniaId },
      data: { estadoToken: 'borrador' },
    });

    return tokenizacion;
  }

  // ─── Productor: enviar a revisión ──────────────────────────────

  async enviarARevision(tokenizacionId: string, usuarioId: string) {
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
      include: { campania: true },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');
    if (t.productorId !== usuarioId) throw new ForbiddenException();
    if (t.campania.estadoToken !== 'borrador' && t.campania.estadoToken !== 'rechazada') {
      throw new BadRequestException(`No se puede enviar a revisión en estado ${t.campania.estadoToken}`);
    }

    await this.prisma.campania.update({
      where: { id: t.campaniaId },
      data: { estadoToken: 'en_revision' },
    });

    return { ok: true, estado: 'en_revision' };
  }

  // ─── Admin: aprobar / rechazar ─────────────────────────────────

  async revisar(tokenizacionId: string, adminId: string, dto: RevisarTokenizacionDto) {
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
      include: { campania: true, productor: true },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');
    if (t.campania.estadoToken !== 'en_revision') {
      throw new BadRequestException('Solo se pueden revisar tokenizaciones en_revision');
    }

    if (dto.decision === 'rechazar') {
      if (!dto.motivoRechazo) throw new BadRequestException('Motivo de rechazo obligatorio');
      await this.prisma.$transaction([
        this.prisma.tokenizacionCampana.update({
          where: { id: tokenizacionId },
          data: {
            rechazadaEn: new Date(),
            motivoRechazo: dto.motivoRechazo,
          },
        }),
        this.prisma.campania.update({
          where: { id: t.campaniaId },
          data: { estadoToken: 'rechazada' },
        }),
      ]);
      return { ok: true, estado: 'rechazada' };
    }

    // Aprobación: dispara la publicación on-chain (mock por ahora).
    if (!t.productor.walletAddress) {
      throw new BadRequestException('El productor no conectó su wallet');
    }

    // Espejo de la regla del programa (now < sale_end < settlement_date).
    // Si llegamos tarde, create_campaign falla con InvalidDates y el front
    // ve un 500 sin explicación. Mejor decirlo antes y en castellano.
    const ahora = Date.now();
    if (t.fondeoHasta.getTime() <= ahora) {
      throw new BadRequestException(
        `La ventana de venta cerró el ${t.fondeoHasta.toISOString()}; ya no se puede publicar. Rechazala y creá una nueva con fechas futuras.`,
      );
    }
    if (t.fechaLiquidacionEstimada && t.fechaLiquidacionEstimada.getTime() <= t.fondeoHasta.getTime()) {
      throw new BadRequestException('La fecha de liquidación tiene que ser posterior al cierre de la venta');
    }

    const publicacion = await this.ledger.publicarCampana({
      tokenizacionId: t.id,
      toneladasOfrecidas: t.toneladasOfrecidas.toNumber(),
      precioTokenUsd: t.precioTokenUsd.toNumber(),
      productorWallet: t.productor.walletAddress,
    });

    await this.prisma.$transaction([
      this.prisma.tokenizacionCampana.update({
        where: { id: tokenizacionId },
        data: {
          aprobadaEn: new Date(),
          aprobadaPor: adminId,
        },
      }),
      this.prisma.campania.update({
        where: { id: t.campaniaId },
        data: { estadoToken: 'abierta' },
      }),
    ]);

    return { ok: true, estado: 'abierta', publicacion };
  }

  // ─── Inversor: marketplace ─────────────────────────────────────

  async listarMarketplace(filtros: ListarMarketplaceDto) {
    // Solo campañas donde todavía se puede invertir: el programa rechaza
    // `invest` después de sale_end, así que una "abierta" con la venta cerrada
    // solo sirve para que el inversor vea un error.
    const where: any = {
      campania: { estadoToken: 'abierta' },
      activo: true,
      fondeoHasta: { gt: new Date() },
    };

    if (filtros.modo) where.modo = filtros.modo;
    if (filtros.precioMin !== undefined) where.precioTokenUsd = { ...where.precioTokenUsd, gte: filtros.precioMin };
    if (filtros.precioMax !== undefined) where.precioTokenUsd = { ...where.precioTokenUsd, lte: filtros.precioMax };
    if (filtros.descuentoMin !== undefined) where.descuentoPct = { gte: filtros.descuentoMin };

    const orderBy: any = (() => {
      switch (filtros.orden) {
        case 'cierra_pronto':
          return { fondeoHasta: 'asc' };
        case 'mayor_descuento':
          return { descuentoPct: 'desc' };
        case 'menor_riesgo':
          return { modo: 'asc' }; // fijo < porcentual alfabéticamente
        case 'recientes':
        default:
          return { createdAt: 'desc' };
      }
    })();

    const items = await this.prisma.tokenizacionCampana.findMany({
      where,
      orderBy,
      include: {
        campania: { include: { establecimiento: true, cultivo: true } },
        productor: { select: { id: true, nombre: true } },
      },
      take: 100,
    });

    // Filtro por cultivo/provincia post-fetch (Prisma no permite filtros
    // profundos elegantes en la relación).
    return items.filter((t) => {
      if (filtros.cultivo && t.campania.cultivo?.nombre.toLowerCase() !== filtros.cultivo.toLowerCase()) {
        return false;
      }
      if (filtros.provincia && t.campania.establecimiento?.provincia?.toLowerCase() !== filtros.provincia.toLowerCase()) {
        return false;
      }
      if (filtros.soloConGarantias && !(t.tieneSeguroGranizo || t.tieneSeguroParametrico || t.tieneAvalSgr)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Estado on-chain listo para pintar. Endpoint público — el jurado tiene que
   * poder verificar cada número clickeando al explorer.
   * Contrato definido en HARVEST.md (VAL-18).
   */
  async obtenerEstadoOnChain(tokenizacionId: string) {
    return this.ledger.obtenerEstadoOnChain(tokenizacionId);
  }

  async detalleCampanaMarketplace(tokenizacionId: string) {
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
      include: {
        campania: {
          include: {
            establecimiento: { include: { acopioHabitual: true } },
            cultivo: true,
          },
        },
        productor: { select: { id: true, nombre: true, createdAt: true } },
        tenencias: { select: { id: true } },
      },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');
    const disponibilidad = await this.ledger.obtenerDisponibilidad(t.id);
    return { ...t, disponibilidad };
  }

  // ─── Inversor: compra ──────────────────────────────────────────

  /**
   * El programa Anchor rechaza `invest` con `SaleEnded` si `now > sale_end`.
   * Ese caso llegaba al frontend como 500 opaco. Validamos acá antes de firmar
   * para devolver 400 con un mensaje claro y no gastar rent en una tx que
   * la chain va a rechazar. Mismo criterio para `now < fondeoDesde` (no
   * dejamos comprar antes de que se abra la ventana) y estados que no sean
   * `abierta`.
   */
  private async assertFondeoAbierto(tokenizacionId: string): Promise<void> {
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
      select: {
        fondeoDesde: true,
        fondeoHasta: true,
        campania: { select: { estadoToken: true } },
      },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');
    if (t.campania.estadoToken !== 'abierta') {
      throw new BadRequestException(
        `La campaña no está abierta (estado actual: ${t.campania.estadoToken}).`,
      );
    }
    const now = new Date();
    if (now < t.fondeoDesde) {
      throw new BadRequestException(
        `La ventana de fondeo abre el ${t.fondeoDesde.toISOString()}.`,
      );
    }
    if (now >= t.fondeoHasta) {
      throw new BadRequestException(
        `La ventana de fondeo cerró el ${t.fondeoHasta.toISOString()}. Ya no se puede invertir en esta campaña.`,
      );
    }
  }

  async crearReserva(tokenizacionId: string, cantidad: number, inversorWallet: string) {
    await this.assertFondeoAbierto(tokenizacionId);
    return this.ledger.reservarTokens({ tokenizacionId, cantidad, inversorWallet });
  }

  async confirmarCompra(reservaId: string) {
    const reserva = await this.prisma.reservaToken.findUnique({
      where: { id: reservaId },
      select: { tokenizacionId: true },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    // Chequeo de nuevo por si la reserva se creó al filo del cierre y el
    // usuario tarda en confirmar. El programa on-chain valida lo mismo pero
    // devuelve 500; acá lo cortamos con 400 antes de firmar.
    await this.assertFondeoAbierto(reserva.tokenizacionId);
    const res = await this.ledger.confirmarCompra(reservaId);

    // La comisión se registra como asiento contable inmutable en la misma
    // ventana temporal que el commit del ledger. El vault ya recibió el
    // bruto — el 1,5% se contabiliza aparte para la auditoría del admin
    // (HARVEST.md deja el ledger on-chain intacto).
    try {
      const tenencia = await this.prisma.tenenciaToken.findUnique({
        where: { id: res.tenenciaId },
        select: {
          id: true,
          tokenizacionId: true,
          inversorId: true,
          walletAddress: true,
        },
      });
      if (tenencia) {
        const desglose = calcularComision(res.montoTotalUsdc);
        const asiento = await this.prisma.comisionPlataforma.create({
          data: {
            tokenizacionId: tenencia.tokenizacionId,
            tenenciaId: tenencia.id,
            tipo: 'compra_inversor',
            usuarioId: tenencia.inversorId,
            walletAddress: tenencia.walletAddress,
            montoBrutoUsd: new Decimal(desglose.montoBrutoUsd),
            porcentaje: new Decimal(desglose.porcentaje),
            montoComisionUsd: new Decimal(desglose.montoComisionUsd),
            montoNetoUsd: new Decimal(desglose.montoNetoUsd),
            txReferencia: res.txSignature,
          },
        });
        const cobro = await this.cobrarComision(asiento.id, {
          tokenizacionId: tenencia.tokenizacionId,
          pagadorUsuarioId: tenencia.inversorId,
          montoUsd: desglose.montoComisionUsd,
          concepto: 'compra_inversor',
        });
        return { ...res, comision: { ...desglose, ...cobro } };
      }
    } catch (err) {
      // Ledger ya committeó — no reventamos la compra si la auditoría falla,
      // solo dejamos el rastro para reprocesar manualmente.
      this.logger.error(
        `No se pudo registrar comisión de compra (reserva=${reservaId} tenencia=${res.tenenciaId}): ${err instanceof Error ? err.message : err}`,
      );
    }
    return res;
  }

  // ─── Inversor: portfolio ───────────────────────────────────────

  async portfolio(inversorId: string) {
    const tenencias = await this.prisma.tenenciaToken.findMany({
      where: { inversorId, activo: true },
      include: {
        tokenizacion: {
          include: {
            campania: { include: { establecimiento: true, cultivo: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Métricas agregadas.
    const invertidoUsd = tenencias.reduce((acc, t) => acc + t.montoTotalUsd.toNumber(), 0);
    const valorActualUsd = tenencias.reduce((acc, t) => {
      const precioActual = t.tokenizacion.precioTokenUsd.toNumber();
      return acc + t.tokens.toNumber() * precioActual;
    }, 0);
    const retornoNoRealizado = valorActualUsd - invertidoUsd;

    return {
      tenencias,
      resumen: {
        invertidoUsd,
        valorActualUsd,
        retornoNoRealizado,
        retornoPct: invertidoUsd > 0 ? (retornoNoRealizado / invertidoUsd) * 100 : 0,
        cantidadTenencias: tenencias.length,
      },
    };
  }

  async reclamar(tenenciaId: string, inversorWallet: string) {
    return this.ledger.reclamar({ tenenciaId, inversorWallet });
  }

  // ─── Productor: liberar fondos (release_funds) ─────────────────

  /**
   * Paso 4 de la demo. El productor cobra lo recaudado: el vault se vacía
   * hacia su wallet. Solo el dueño, solo con la campaña abierta. El mínimo de
   * toneladas lo valida el programa (MinNotReached).
   */
  async liberarFondos(tokenizacionId: string, productorId: string) {
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
      include: { campania: true },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');
    if (t.productorId !== productorId) throw new ForbiddenException('No sos el productor de esta campaña');
    if (t.campania.estadoToken !== 'abierta') {
      throw new BadRequestException(`No se pueden liberar fondos en estado ${t.campania.estadoToken}`);
    }
    if (t.tokensVendidos.lt(t.toneladasMinimas)) {
      throw new BadRequestException(
        `Faltan ${t.toneladasMinimas.sub(t.tokensVendidos)} tn para el mínimo (${t.tokensVendidos}/${t.toneladasMinimas}). El programa rechaza release_funds con MinNotReached`,
      );
    }

    const res = await this.ledger.liberarFondos(tokenizacionId);
    const desglose = calcularComision(res.montoUsd);

    const [, , asiento] = await this.prisma.$transaction([
      this.prisma.tokenizacionCampana.update({
        where: { id: tokenizacionId },
        data: { txSignatureLiberacion: res.txSignature, fondosLiberadosEn: new Date() },
      }),
      this.prisma.campania.update({
        where: { id: t.campaniaId },
        data: { estadoToken: 'fondeada' },
      }),
      this.prisma.comisionPlataforma.create({
        data: {
          tokenizacionId,
          tipo: 'cobro_productor',
          usuarioId: t.productorId,
          walletAddress: null,
          montoBrutoUsd: new Decimal(desglose.montoBrutoUsd),
          porcentaje: new Decimal(desglose.porcentaje),
          montoComisionUsd: new Decimal(desglose.montoComisionUsd),
          montoNetoUsd: new Decimal(desglose.montoNetoUsd),
          txReferencia: res.txSignature,
        },
      }),
    ]);

    // El vault ya se vació a la wallet del productor; de ahí sale la comisión.
    const cobro = await this.cobrarComision(asiento.id, {
      tokenizacionId,
      pagadorUsuarioId: t.productorId,
      montoUsd: desglose.montoComisionUsd,
      concepto: 'cobro_productor',
    });

    this.logger.log(
      `Fondos liberados: tokenizacion=${tokenizacionId} bruto=${res.montoUsd} comision=${desglose.montoComisionUsd} neto=${desglose.montoNetoUsd} tx=${res.txSignature} txComision=${cobro.txComision ?? 'pendiente'}`,
    );
    return { ...res, comision: { ...desglose, ...cobro } };
  }

  /**
   * Mueve la comisión a la tesorería y la deja registrada en el asiento. Si la
   * transferencia falla, la operación principal ya está confirmada: no se
   * revienta, queda `txComision = null` para reprocesar y se loguea.
   */
  private async cobrarComision(
    asientoId: string,
    input: { tokenizacionId: string; pagadorUsuarioId: string; montoUsd: number; concepto: 'compra_inversor' | 'cobro_productor' },
  ): Promise<{ txComision: string | null; tesoreria: string }> {
    const tesoreria = this.ledger.tesoreriaAddress();
    try {
      const r = await this.ledger.transferirComision(input);
      await this.prisma.comisionPlataforma.update({
        where: { id: asientoId },
        data: { txComision: r.txSignature, tesoreriaAddress: r.tesoreria },
      });
      return { txComision: r.txSignature, tesoreria: r.tesoreria };
    } catch (err) {
      this.logger.error(
        `Comisión ${input.concepto} registrada pero NO transferida (asiento=${asientoId}, monto=${input.montoUsd}): ${err instanceof Error ? err.message : err}`,
      );
      await this.prisma.comisionPlataforma
        .update({ where: { id: asientoId }, data: { tesoreriaAddress: tesoreria } })
        .catch(() => undefined);
      return { txComision: null, tesoreria };
    }
  }

  /** Porcentaje vigente y tesorería, para que el front muestre la comisión antes de operar. */
  comisionesConfig() {
    return { porcentaje: COMISION_PLATAFORMA_PCT, tesoreria: this.ledger.tesoreriaAddress() };
  }

  // ─── Admin: liquidar (settle) ──────────────────────────────────

  /** Campañas fondeadas (pendientes de liquidar) y liquidadas (historial). */
  async listarParaLiquidar() {
    return this.prisma.tokenizacionCampana.findMany({
      where: { campania: { estadoToken: { in: ['fondeada', 'liquidada'] } }, activo: true },
      include: {
        campania: { include: { establecimiento: true, cultivo: true } },
        productor: { select: { id: true, nombre: true, email: true, walletAddress: true } },
        tenencias: { select: { id: true, tokens: true, walletAddress: true, estado: true } },
      },
      orderBy: [{ liquidadaEn: 'asc' }, { fondosLiberadosEn: 'asc' }],
    });
  }

  /**
   * Paso 5 de la demo. El admin, en nombre del acopio, declara cuántas
   * toneladas se entregaron y a qué precio. El programa fija el payout por
   * token. Entregar menos de lo vendido reparte la merma pro rata (sequía).
   */
  async liquidar(tokenizacionId: string, adminId: string, dto: LiquidarTokenizacionDto) {
    const t = await this.prisma.tokenizacionCampana.findUnique({
      where: { id: tokenizacionId },
      include: { campania: true },
    });
    if (!t) throw new NotFoundException('Tokenización no encontrada');
    if (t.campania.estadoToken !== 'fondeada') {
      throw new BadRequestException(
        `Solo se liquida una campaña fondeada. Estado actual: ${t.campania.estadoToken}`,
      );
    }
    const vendidas = t.tokensVendidos.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber();
    if (dto.toneladasEntregadas > vendidas) {
      throw new BadRequestException(`No se pueden entregar más toneladas (${dto.toneladasEntregadas}) que las vendidas (${vendidas})`);
    }
    // settlement_date on-chain: sale de fechaLiquidacionEstimada (VAL-11) o,
    // si el productor no la fijó, de fondeoHasta + 90 días. Espejamos la regla
    // acá para no gastar una tx que el programa va a rechazar con TooEarly.
    const settlementMs = t.fechaLiquidacionEstimada
      ? t.fechaLiquidacionEstimada.getTime()
      : t.fondeoHasta.getTime() + 90 * 24 * 60 * 60 * 1000;
    if (settlementMs > Date.now()) {
      throw new BadRequestException(
        `La liquidación está programada para ${new Date(settlementMs).toISOString()}. El programa rechaza settle antes de esa fecha`,
      );
    }

    const res = await this.ledger.liquidar({
      tokenizacionId,
      toneladasEntregadas: dto.toneladasEntregadas,
      precioLiquidacionUsdTn: dto.precioLiquidacionUsdTn,
    });

    await this.prisma.$transaction([
      this.prisma.tokenizacionCampana.update({
        where: { id: tokenizacionId },
        data: {
          toneladasEntregadas: new Decimal(dto.toneladasEntregadas),
          precioLiquidacionUsdTn: new Decimal(dto.precioLiquidacionUsdTn),
          payoutPorTokenUsd: new Decimal(res.payoutPorTokenUsd),
          txSignatureLiquidacion: res.txSignature,
          liquidadaEn: new Date(),
        },
      }),
      this.prisma.campania.update({
        where: { id: t.campaniaId },
        data: { estadoToken: 'liquidada' },
      }),
    ]);

    this.logger.log(
      `Campaña liquidada por admin=${adminId}: tokenizacion=${tokenizacionId} entregadas=${dto.toneladasEntregadas} precio=${dto.precioLiquidacionUsdTn} payout=${res.payoutPorTokenUsd} tx=${res.txSignature}`,
    );
    return res;
  }

  // ─── Productor: sus campañas tokenizadas ───────────────────────

  async listarDelProductor(productorId: string) {
    return this.prisma.tokenizacionCampana.findMany({
      where: { productorId, activo: true },
      include: {
        campania: { include: { establecimiento: true, cultivo: true } },
        tenencias: {
          include: { inversor: { select: { id: true, nombre: true, walletAddress: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Admin: auditoría de comisiones ────────────────────────────

  /**
   * Listado detallado de comisiones cobradas por la plataforma + agregados
   * para el dashboard del admin. Filtros opcionales por tipo (compra/cobro)
   * y rango de fechas. El endpoint es la fuente única para el reporte
   * contable — cada fila conserva la tasa vigente al momento del cobro.
   */
  async listarComisiones(filtros: ListarComisionesDto) {
    const where: any = {};
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.desde || filtros.hasta) {
      where.createdAt = {};
      if (filtros.desde) where.createdAt.gte = new Date(filtros.desde);
      if (filtros.hasta) where.createdAt.lte = new Date(filtros.hasta);
    }

    const [items, totalGeneral, totalCompra, totalCobro] = await Promise.all([
      this.prisma.comisionPlataforma.findMany({
        where,
        include: {
          tokenizacion: {
            include: {
              campania: { include: { cultivo: true, establecimiento: true } },
            },
          },
          usuario: { select: { id: true, nombre: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.comisionPlataforma.aggregate({
        where,
        _sum: { montoBrutoUsd: true, montoComisionUsd: true, montoNetoUsd: true },
        _count: { _all: true },
      }),
      this.prisma.comisionPlataforma.aggregate({
        where: { ...where, tipo: 'compra_inversor' },
        _sum: { montoBrutoUsd: true, montoComisionUsd: true },
        _count: { _all: true },
      }),
      this.prisma.comisionPlataforma.aggregate({
        where: { ...where, tipo: 'cobro_productor' },
        _sum: { montoBrutoUsd: true, montoComisionUsd: true },
        _count: { _all: true },
      }),
    ]);

    const toNum = (v: Decimal | null | undefined) => (v ? v.toNumber() : 0);

    return {
      items,
      resumen: {
        tasaVigentePct: COMISION_PLATAFORMA_PCT,
        total: {
          operaciones: totalGeneral._count._all,
          montoBrutoUsd: toNum(totalGeneral._sum.montoBrutoUsd),
          montoComisionUsd: toNum(totalGeneral._sum.montoComisionUsd),
          montoNetoUsd: toNum(totalGeneral._sum.montoNetoUsd),
        },
        compraInversor: {
          operaciones: totalCompra._count._all,
          montoBrutoUsd: toNum(totalCompra._sum.montoBrutoUsd),
          montoComisionUsd: toNum(totalCompra._sum.montoComisionUsd),
        },
        cobroProductor: {
          operaciones: totalCobro._count._all,
          montoBrutoUsd: toNum(totalCobro._sum.montoBrutoUsd),
          montoComisionUsd: toNum(totalCobro._sum.montoComisionUsd),
        },
      },
    };
  }

  // ─── Admin: cola de revisión ───────────────────────────────────

  async listarEnRevision() {
    return this.prisma.tokenizacionCampana.findMany({
      where: { campania: { estadoToken: 'en_revision' } },
      include: {
        campania: { include: { establecimiento: true, cultivo: true } },
        productor: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
