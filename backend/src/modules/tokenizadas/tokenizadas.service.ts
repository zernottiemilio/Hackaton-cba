import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger/ledger.interface';
import { CrearTokenizacionDto, RevisarTokenizacionDto, ListarMarketplaceDto } from './dto/tokenizacion.dto';

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
    const where: any = {
      campania: { estadoToken: 'abierta' },
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

  async crearReserva(tokenizacionId: string, cantidad: number, inversorWallet: string) {
    return this.ledger.reservarTokens({ tokenizacionId, cantidad, inversorWallet });
  }

  async confirmarCompra(reservaId: string) {
    return this.ledger.confirmarCompra(reservaId);
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
