import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RolEnCuenta } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CalculosService } from '../calculos/calculos.service';
import type { UsuarioActual } from '../../common/types/usuario-actual';
import type { ComentarioReporteDto, CrearReporteDto } from './reportes.dto';

const ROLES_ESCRITURA: RolEnCuenta[] = [RolEnCuenta.ingeniero, RolEnCuenta.operador];

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculos: CalculosService,
  ) {}

  // ---------- LECTURA ----------

  async listarPorCuenta(cuentaId: string) {
    const items = await this.prisma.reporte.findMany({
      where: { cuentaId, activo: true },
      include: {
        autor: { select: { id: true, nombre: true } },
        _count: { select: { comentarios: { where: { activo: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      titulo: r.titulo,
      tokenPublico: r.tokenPublico,
      expiraEn: r.expiraEn,
      autor: r.autor,
      cantidadComentarios: r._count.comentarios,
      createdAt: r.createdAt,
    }));
  }

  async obtenerInterno(cuentaId: string, id: string) {
    const r = await this.prisma.reporte.findFirst({
      where: { id, cuentaId, activo: true },
      include: {
        autor: { select: { id: true, nombre: true } },
        comentarios: {
          where: { activo: true },
          include: { autor: { select: { id: true, nombre: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!r) throw new NotFoundException('Reporte no encontrado');
    return r;
  }

  /** Ruta PÚBLICA — usuario no autenticado. Sólo devuelve si el reporte no expiró. */
  async obtenerPorToken(token: string) {
    const r = await this.prisma.reporte.findFirst({
      where: { tokenPublico: token, activo: true },
      include: { autor: { select: { id: true, nombre: true } } },
    });
    if (!r) throw new NotFoundException('Reporte no encontrado o revocado');
    if (r.expiraEn && r.expiraEn < new Date()) {
      throw new NotFoundException('El link del reporte expiró');
    }
    return {
      id: r.id,
      tipo: r.tipo,
      titulo: r.titulo,
      datosSnapshot: r.datosSnapshot,
      autor: r.autor,
      createdAt: r.createdAt,
    };
  }

  // ---------- ESCRITURA ----------

  async crear(user: UsuarioActual, dto: CrearReporteDto) {
    this.asegurarEscritura(user);

    let titulo = dto.titulo?.trim();
    let datosSnapshot: unknown;

    if (dto.tipo === 'lote_campania') {
      const id = dto.parametros.loteCampaniaId;
      if (!id) throw new BadRequestException('parametros.loteCampaniaId requerido');
      const snap = await this.snapshotLoteCampania(user.cuentaId, id);
      titulo = titulo ?? `${snap.lote.nombre} · ${snap.cultivo.nombre} · ${snap.campania.nombre}`;
      datosSnapshot = snap;
    } else if (dto.tipo === 'monitoreo') {
      const id = dto.parametros.monitoreoId;
      if (!id) throw new BadRequestException('parametros.monitoreoId requerido');
      const snap = await this.snapshotMonitoreo(user.cuentaId, id);
      titulo = titulo ?? `Monitoreo ${snap.tipo.replace('_', ' ')} — ${snap.loteCampania.lote.nombre} (${snap.fecha.slice(0, 10)})`;
      datosSnapshot = snap;
    } else if (dto.tipo === 'cultivo_campania') {
      const campaniaId = dto.parametros.campaniaId;
      const cultivoId = dto.parametros.cultivoId;
      if (!campaniaId || !cultivoId) {
        throw new BadRequestException('parametros.campaniaId y parametros.cultivoId requeridos');
      }
      const snap = await this.snapshotCultivoCampania(user.cuentaId, campaniaId, cultivoId);
      titulo = titulo ?? `${snap.cultivo.nombre} · ${snap.campania.nombre} — ${snap.totales.lotes} lote(s)`;
      datosSnapshot = snap;
    } else if (dto.tipo === 'anual') {
      const anio = parseInt(dto.parametros.anio ?? '', 10);
      if (!anio || anio < 2000 || anio > 2100) {
        throw new BadRequestException('parametros.anio requerido (ej. "2026")');
      }
      const establecimientoId = dto.parametros.establecimientoId ?? null;
      const snap = await this.snapshotAnual(user.cuentaId, anio, establecimientoId);
      titulo = titulo ?? `Reporte ${anio}${snap.establecimiento ? ` — ${snap.establecimiento.nombre}` : ' — todos los campos'}`;
      datosSnapshot = snap;
    } else {
      throw new BadRequestException(`Tipo de reporte ${dto.tipo} aún no implementado`);
    }

    const expiraEn = dto.diasValidez
      ? new Date(Date.now() + dto.diasValidez * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.reporte.create({
      data: {
        cuentaId: user.cuentaId,
        autorId: user.id,
        tipo: dto.tipo,
        titulo: titulo!,
        parametros: dto.parametros,
        datosSnapshot: datosSnapshot as object,
        expiraEn,
      },
      include: { autor: { select: { id: true, nombre: true } } },
    });
  }

  async revocar(user: UsuarioActual, id: string) {
    this.asegurarEscritura(user);
    const existente = await this.prisma.reporte.findFirst({
      where: { id, cuentaId: user.cuentaId, activo: true },
      select: { id: true },
    });
    if (!existente) throw new NotFoundException('Reporte no encontrado');
    await this.prisma.reporte.update({ where: { id }, data: { activo: false } });
  }

  // ---------- COMENTARIOS ----------

  async listarComentarios(cuentaId: string, reporteId: string) {
    await this.obtenerInterno(cuentaId, reporteId);
    return this.prisma.comentarioReporte.findMany({
      where: { reporteId, activo: true },
      include: { autor: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async comentar(user: UsuarioActual, reporteId: string, dto: ComentarioReporteDto) {
    // Cualquier miembro autenticado de la cuenta puede comentar — incluido
    // el propietario, que es justamente quien usa este canal.
    await this.obtenerInterno(user.cuentaId, reporteId);
    return this.prisma.comentarioReporte.create({
      data: {
        reporteId,
        autorId: user.id,
        texto: dto.texto.trim(),
      },
      include: { autor: { select: { id: true, nombre: true } } },
    });
  }

  async eliminarComentario(user: UsuarioActual, comentarioId: string) {
    const c = await this.prisma.comentarioReporte.findFirst({
      where: { id: comentarioId, activo: true, reporte: { cuentaId: user.cuentaId } },
      select: { id: true, autorId: true },
    });
    if (!c) throw new NotFoundException('Comentario no encontrado');

    // Sólo el autor o el ingeniero pueden borrar.
    if (c.autorId !== user.id && user.rolEnCuentaActiva !== RolEnCuenta.ingeniero) {
      throw new ForbiddenException('Solo el autor o el ingeniero puede borrar el comentario');
    }
    await this.prisma.comentarioReporte.update({
      where: { id: comentarioId },
      data: { activo: false },
    });
  }

  // ---------- SNAPSHOTS ----------

  /**
   * Arma el snapshot de datos de un lote-campania: info del lote/cultivo/campania,
   * labores e insumos cargados, monitoreos visibles, y el resultado calculado
   * (costos, ingresos, márgenes, punto de equilibrio).
   */
  private async snapshotLoteCampania(cuentaId: string, loteCampaniaId: string) {
    const lc = await this.prisma.loteCampania.findFirst({
      where: { id: loteCampaniaId, cuentaId, activo: true },
      include: {
        lote: { include: { establecimiento: { select: { id: true, nombre: true, ubicacion: true } } } },
        cultivo: { select: { id: true, nombre: true } },
        variedad: { select: { id: true, nombre: true } },
        campania: { select: { id: true, nombre: true, tipo: true } },
        labores: {
          where: { activo: true },
          orderBy: { fecha: 'desc' },
          select: {
            id: true, tipo: true, fecha: true, ejecutor: true,
            costoTotalUsd: true, formaPago: true, nota: true,
          },
        },
        insumosAplicados: {
          where: { activo: true },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, tipo: true, producto: true, cantidad: true, unidad: true,
            costoTotalUsd: true, formaPago: true,
          },
        },
        monitoreos: {
          where: { activo: true },
          orderBy: { fecha: 'desc' },
          take: 10,
          select: {
            id: true, tipo: true, fecha: true, observaciones: true,
            prescripcion: true, urgencia: true,
            fotos: { select: { url: true } },
          },
        },
      },
    });
    if (!lc) throw new NotFoundException('Lote-campaña no encontrado');

    const resultado = await this.calculos.calcularResultadoLote(cuentaId, loteCampaniaId);

    return {
      lote: { id: lc.lote.id, nombre: lc.lote.nombre, superficieHa: lc.lote.superficieHa.toString() },
      establecimiento: lc.lote.establecimiento,
      cultivo: lc.cultivo,
      variedad: lc.variedad,
      campania: lc.campania,
      loteCampania: {
        id: lc.id,
        superficieSembradaHa: lc.superficieSembradaHa.toString(),
        fechaSiembra: lc.fechaSiembra,
        rindeEstimadoQqHa: lc.rindeEstimadoQqHa?.toString() ?? null,
        rindeRealQqHa: lc.rindeRealQqHa?.toString() ?? null,
        precioGranoUsdTn: lc.precioGranoUsdTn?.toString() ?? null,
        fechaCosecha: lc.fechaCosecha,
      },
      labores: lc.labores.map((l) => ({
        ...l,
        costoTotalUsd: l.costoTotalUsd?.toString() ?? null,
      })),
      insumos: lc.insumosAplicados.map((i) => ({
        ...i,
        cantidad: i.cantidad.toString(),
        costoTotalUsd: i.costoTotalUsd.toString(),
      })),
      monitoreos: lc.monitoreos,
      resultado,
      generadoEn: new Date().toISOString(),
    };
  }

  /** Snapshot de un solo monitoreo: foto + observaciones + prescripción + contexto. */
  private async snapshotMonitoreo(cuentaId: string, monitoreoId: string) {
    const m = await this.prisma.monitoreo.findFirst({
      where: { id: monitoreoId, cuentaId, activo: true },
      include: {
        autor: { select: { id: true, nombre: true } },
        fotos: { orderBy: { orden: 'asc' } },
        loteCampania: {
          include: {
            lote: { include: { establecimiento: { select: { id: true, nombre: true } } } },
            cultivo: { select: { id: true, nombre: true } },
            campania: { select: { id: true, nombre: true } },
          },
        },
      },
    });
    if (!m) throw new NotFoundException('Monitoreo no encontrado');
    return {
      id: m.id,
      tipo: m.tipo,
      fecha: m.fecha.toISOString(),
      urgencia: m.urgencia,
      observaciones: m.observaciones,
      prescripcion: m.prescripcion,
      latitud: m.latitud?.toString() ?? null,
      longitud: m.longitud?.toString() ?? null,
      fotos: m.fotos,
      autor: m.autor,
      loteCampania: {
        id: m.loteCampania.id,
        lote: { id: m.loteCampania.lote.id, nombre: m.loteCampania.lote.nombre },
        establecimiento: m.loteCampania.lote.establecimiento,
        cultivo: m.loteCampania.cultivo,
        campania: m.loteCampania.campania,
      },
      generadoEn: new Date().toISOString(),
    };
  }

  /**
   * Snapshot de TODOS los lotes con un cultivo en una campaña: agrega
   * superficies, costos, ingresos y márgenes; recalcula los /ha sobre
   * la superficie agregada (no promedia promedios).
   */
  private async snapshotCultivoCampania(cuentaId: string, campaniaId: string, cultivoId: string) {
    const [campania, cultivo, agregado] = await Promise.all([
      this.prisma.campania.findFirst({ where: { id: campaniaId, cuentaId, activo: true } }),
      this.prisma.cultivo.findFirst({ where: { id: cultivoId } }),
      this.calculos.agregarPorCultivo(cuentaId, campaniaId),
    ]);
    if (!campania) throw new NotFoundException('Campaña no encontrada');
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');

    const delCultivo = agregado.find((a) => a.cultivoId === cultivoId);
    if (!delCultivo) {
      throw new NotFoundException(
        `No hay lotes con cultivo "${cultivo.nombre}" en la campaña "${campania.nombre}"`,
      );
    }

    const lcs = await this.prisma.loteCampania.findMany({
      where: { cuentaId, campaniaId, cultivoId, activo: true },
      include: {
        lote: { include: { establecimiento: { select: { id: true, nombre: true } } } },
      },
      orderBy: { lote: { nombre: 'asc' } },
    });

    const detallePorLote = await Promise.all(
      lcs.map(async (lc) => {
        const r = await this.calculos.calcularResultadoLote(cuentaId, lc.id);
        return {
          loteCampaniaId: lc.id,
          lote: { id: lc.lote.id, nombre: lc.lote.nombre },
          establecimiento: lc.lote.establecimiento,
          superficieHa: lc.superficieSembradaHa.toString(),
          rinde: r.rinde,
          rindeFuente: r.rindeFuente,
          ingresoBruto: r.ingresoBruto,
          costoTotal: r.costos.total,
          margenNeto: r.margenes.neto,
          margenNetoHa: r.margenes.netoHa,
        };
      }),
    );

    return {
      campania: { id: campania.id, nombre: campania.nombre },
      cultivo: { id: cultivo.id, nombre: cultivo.nombre },
      totales: {
        lotes: lcs.length,
        superficieHa: delCultivo.superficieHa,
        ingresoBruto: delCultivo.ingresoBruto,
        costoTotal: delCultivo.costoTotal,
        margenNeto: delCultivo.margenNeto,
        margenNetoHa: delCultivo.margenNetoHa,
      },
      porLote: detallePorLote,
      generadoEn: new Date().toISOString(),
    };
  }

  /**
   * Snapshot anual: agrega TODOS los lote_campania que cruzan el año,
   * agrupando por cultivo y opcionalmente por establecimiento.
   */
  private async snapshotAnual(cuentaId: string, anio: number, establecimientoId: string | null) {
    const inicioAnio = new Date(`${anio}-01-01T00:00:00Z`);
    const finAnio = new Date(`${anio}-12-31T23:59:59Z`);

    const establecimiento = establecimientoId
      ? await this.prisma.establecimiento.findFirst({
          where: { id: establecimientoId, cuentaId, activo: true },
          select: { id: true, nombre: true, ubicacion: true },
        })
      : null;

    // Lotes-campania cuya ventana cruza el año:
    //   (fechaSiembra <= finAnio) AND (fechaCosecha IS NULL OR fechaCosecha >= inicioAnio)
    const lcs = await this.prisma.loteCampania.findMany({
      where: {
        cuentaId,
        activo: true,
        ...(establecimientoId && { lote: { establecimientoId } }),
        OR: [
          { fechaSiembra: { lte: finAnio }, fechaCosecha: null },
          { fechaSiembra: { lte: finAnio }, fechaCosecha: { gte: inicioAnio } },
          { fechaSiembra: null, fechaCosecha: { gte: inicioAnio, lte: finAnio } },
        ],
      },
      include: {
        lote: { include: { establecimiento: { select: { id: true, nombre: true } } } },
        cultivo: { select: { id: true, nombre: true } },
        campania: { select: { id: true, nombre: true } },
      },
    });

    // Resultados detalle + agrupado por cultivo
    type Linea = {
      loteCampaniaId: string;
      lote: string;
      establecimiento: string;
      cultivo: string;
      campania: string;
      superficieHa: number;
      ingresoBruto: number;
      costoTotal: number;
      margenNeto: number;
    };

    const lineas: Linea[] = [];
    for (const lc of lcs) {
      const r = await this.calculos.calcularResultadoLote(cuentaId, lc.id);
      lineas.push({
        loteCampaniaId: lc.id,
        lote: lc.lote.nombre,
        establecimiento: lc.lote.establecimiento.nombre,
        cultivo: lc.cultivo.nombre,
        campania: lc.campania.nombre,
        superficieHa: Number(r.superficieHa),
        ingresoBruto: Number(r.ingresoBruto),
        costoTotal: Number(r.costos.total),
        margenNeto: Number(r.margenes.neto),
      });
    }

    // Agregaciones (sumar totales, recalcular /ha sobre sup agregada)
    const supTotal = lineas.reduce((s, l) => s + l.superficieHa, 0);
    const ingresoTotal = lineas.reduce((s, l) => s + l.ingresoBruto, 0);
    const costoTotal = lineas.reduce((s, l) => s + l.costoTotal, 0);
    const margenTotal = lineas.reduce((s, l) => s + l.margenNeto, 0);

    // Por cultivo
    const porCultivoMap = new Map<string, { cultivo: string; lotes: number; superficieHa: number; ingreso: number; costo: number; margen: number }>();
    for (const l of lineas) {
      const k = l.cultivo;
      const acc = porCultivoMap.get(k) ?? { cultivo: k, lotes: 0, superficieHa: 0, ingreso: 0, costo: 0, margen: 0 };
      acc.lotes += 1;
      acc.superficieHa += l.superficieHa;
      acc.ingreso += l.ingresoBruto;
      acc.costo += l.costoTotal;
      acc.margen += l.margenNeto;
      porCultivoMap.set(k, acc);
    }
    const porCultivo = [...porCultivoMap.values()].sort((a, b) => b.margen - a.margen);

    return {
      anio,
      establecimiento,
      totales: {
        lotes: lineas.length,
        superficieHa: supTotal,
        ingresoBruto: ingresoTotal,
        costoTotal,
        margenNeto: margenTotal,
        margenNetoHa: supTotal > 0 ? margenTotal / supTotal : 0,
      },
      porCultivo,
      detallePorLote: lineas,
      generadoEn: new Date().toISOString(),
    };
  }

  // ---------- HELPERS ----------

  private asegurarEscritura(user: UsuarioActual): void {
    if (!ROLES_ESCRITURA.includes(user.rolEnCuentaActiva)) {
      throw new ForbiddenException('No tenés permiso para generar reportes');
    }
  }
}
