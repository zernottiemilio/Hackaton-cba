import { Injectable } from '@nestjs/common';
import type { RolTokenizacion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculosService } from '../calculos/calculos.service';
import { ClimaService } from '../clima/clima.service';

/**
 * Arma el contexto que se le pasa a Claude en cada mensaje. Cada rol
 * recibe datos distintos:
 *
 *  - productor: estado agro de su cuenta (establecimientos, lotes, cálculos,
 *    lluvias, clima) — el flujo AgroFácil original.
 *  - inversor: portfolio, hitos de las tenencias, marketplace abierto ahora.
 *  - admin_plataforma: KPIs globales (cola de revisión, fondeadas,
 *    comisiones acumuladas).
 *  - acopio: placeholder — hoy no tiene datos propios.
 *
 * El discriminante `rol` sirve al system prompt para saber qué shape esperar.
 * Toda operación de contexto es best-effort: si algo falla, se devuelve el
 * shape con listas vacías y el modelo lo maneja.
 */
@Injectable()
export class ContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculos: CalculosService,
    private readonly clima: ClimaService,
  ) {}

  async armarContexto(
    cuentaId: string,
    usuarioId: string,
    rol: RolTokenizacion | null | undefined,
  ): Promise<Contexto> {
    switch (rol) {
      case 'inversor':
        return this.contextoInversor(usuarioId);
      case 'admin_plataforma':
        return this.contextoAdmin();
      case 'acopio':
        return this.contextoAcopio(usuarioId);
      case 'productor':
      default:
        return this.contextoProductor(cuentaId);
    }
  }

  // ============================================================
  // PRODUCTOR — estado agro de su cuenta
  // ============================================================

  private async contextoProductor(cuentaId: string): Promise<ContextoProductor> {
    const [cuenta, establecimientos, campanias, cultivos] = await Promise.all([
      this.prisma.cuenta.findUnique({ where: { id: cuentaId } }),
      this.prisma.establecimiento.findMany({
        where: { cuentaId, activo: true },
        include: { _count: { select: { lotes: { where: { activo: true } } } } },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.campania.findMany({
        where: {
          cuentaId,
          activo: true,
          fechaInicio: { gte: new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { fechaInicio: 'desc' },
      }),
      this.prisma.cultivo.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    ]);

    const [lotes, lotesCampania, labores, insumos, lluvias90d] = await Promise.all([
      this.prisma.lote.findMany({
        where: { cuentaId, activo: true },
        include: { establecimiento: { select: { id: true, nombre: true } } },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.loteCampania.findMany({
        where: {
          cuentaId,
          activo: true,
          campaniaId: { in: campanias.map((c) => c.id) },
        },
        include: {
          lote: { include: { establecimiento: { select: { nombre: true } } } },
          cultivo: true,
          campania: true,
        },
      }),
      this.prisma.labor.findMany({
        where: { cuentaId, activo: true },
        include: {
          loteCampania: {
            include: {
              lote: { select: { nombre: true } },
              cultivo: { select: { nombre: true } },
            },
          },
        },
        orderBy: { fecha: 'desc' },
        take: 30,
      }),
      this.prisma.insumoAplicado.findMany({
        where: { cuentaId, activo: true },
        include: {
          loteCampania: {
            include: {
              lote: { select: { nombre: true } },
              cultivo: { select: { nombre: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.registroLluvia.findMany({
        where: {
          cuentaId,
          activo: true,
          fecha: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { fecha: 'desc' },
      }),
    ]);

    // Calcular resultados de los lote_campania (no falla si hay incompletos)
    const resultados: ResultadoCampoCalculado[] = [];
    for (const lc of lotesCampania) {
      try {
        const r = await this.calculos.calcularResultadoLote(cuentaId, lc.id);
        resultados.push({
          lote: lc.lote.nombre,
          establecimiento: lc.lote.establecimiento?.nombre ?? '',
          campania: lc.campania.nombre,
          cultivo: lc.cultivo.nombre,
          esProyeccion: r.esProyeccion,
          superficieHa: r.superficieHa,
          rinde: r.rinde,
          rindeFuente: r.rindeFuente,
          ingresoBruto: r.ingresoBruto,
          costoTotal: r.costos.total,
          costoTotalHa: r.costos.totalHa,
          margenNeto: r.margenes.neto,
          margenNetoHa: r.margenes.netoHa,
          puntoEquilibrio: r.puntoEquilibrio.rindeQqHa,
          lectura: r.puntoEquilibrio.lectura,
        });
      } catch {
        // si el lote no tiene datos suficientes para calcular, lo omitimos
      }
    }

    // Clima actual: solo si el primer establecimiento tiene coordenadas
    let clima: ContextoProductor['clima'] = null;
    const estabConCoords = establecimientos.find((e) => e.latitud && e.longitud);
    if (estabConCoords) {
      try {
        const lat = Number(estabConCoords.latitud);
        const lon = Number(estabConCoords.longitud);
        const [actual, pronostico] = await Promise.all([
          this.clima.actual(lat, lon),
          this.clima.pronostico(lat, lon),
        ]);
        clima = {
          establecimiento: estabConCoords.nombre,
          actual: {
            temperatura: actual.temperatura,
            humedad: actual.humedad,
            vientoKmh: actual.vientoKmh,
            descripcion: actual.info.descripcion,
            lluviaUltimaHora: actual.lluvia,
          },
          proximosDias: pronostico.dias.slice(0, 5).map((d) => ({
            fecha: d.fecha,
            tMax: d.tMax,
            tMin: d.tMin,
            lluvia: d.lluvia,
            probLluvia: d.probLluvia,
            descripcion: d.info.descripcion,
          })),
        };
      } catch {
        // si Open-Meteo falla, seguimos sin clima
      }
    }

    return {
      rol: 'productor',
      cuenta: { nombre: cuenta?.nombre ?? 'Sin nombre' },
      catalogo: { cultivos: cultivos.map((c) => c.nombre) },
      establecimientos: establecimientos.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        ubicacion: e.ubicacion,
        tenencia: e.tenencia,
        superficieTotalHa: e.superficieTotalHa ? Number(e.superficieTotalHa) : null,
        lotesActivos: e._count.lotes,
        tieneCoordenadas: !!(e.latitud && e.longitud),
      })),
      lotes: lotes.map((l) => ({
        id: l.id,
        nombre: l.nombre,
        establecimiento: l.establecimiento.nombre,
        superficieHa: Number(l.superficieHa),
        tenencia: l.tenencia,
        arrendamiento:
          l.tenencia === 'arrendado' && l.arrendamientoValor && l.arrendamientoUnidad
            ? { valor: Number(l.arrendamientoValor), unidad: l.arrendamientoUnidad }
            : null,
      })),
      campaniasActivas: campanias.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        fechaInicio: c.fechaInicio.toISOString().slice(0, 10),
        fechaFin: c.fechaFin?.toISOString().slice(0, 10) ?? null,
      })),
      lotesCampania: lotesCampania.map((lc) => ({
        id: lc.id,
        lote: lc.lote.nombre,
        establecimiento: lc.lote.establecimiento?.nombre ?? '',
        campania: lc.campania.nombre,
        cultivo: lc.cultivo.nombre,
        superficieSembradaHa: Number(lc.superficieSembradaHa),
        fechaSiembra: lc.fechaSiembra?.toISOString().slice(0, 10) ?? null,
        rindeEstimadoQqHa: lc.rindeEstimadoQqHa ? Number(lc.rindeEstimadoQqHa) : null,
        rindeRealQqHa: lc.rindeRealQqHa ? Number(lc.rindeRealQqHa) : null,
        precioGranoUsdTn: lc.precioGranoUsdTn ? Number(lc.precioGranoUsdTn) : null,
        fechaCosecha: lc.fechaCosecha?.toISOString().slice(0, 10) ?? null,
      })),
      resultadosCalculados: resultados,
      laboresRecientes: labores.map((l) => ({
        fecha: l.fecha.toISOString().slice(0, 10),
        tipo: l.tipo,
        ejecutor: l.ejecutor,
        lote: l.loteCampania.lote.nombre,
        cultivo: l.loteCampania.cultivo.nombre,
        costoUsd: l.costoTotalUsd ? Number(l.costoTotalUsd) : null,
        formaPago: l.formaPago,
        nota: l.nota,
      })),
      insumosRecientes: insumos.map((i) => ({
        fecha: i.createdAt.toISOString().slice(0, 10),
        tipo: i.tipo,
        producto: i.producto,
        cantidad: Number(i.cantidad),
        unidad: i.unidad,
        costoUsd: Number(i.costoTotalUsd),
        formaPago: i.formaPago,
        lote: i.loteCampania.lote.nombre,
        cultivo: i.loteCampania.cultivo.nombre,
      })),
      lluviasUltimos90Dias: {
        totalMm: lluvias90d.reduce((s, r) => s + Number(r.mm), 0),
        diasConRegistro: lluvias90d.length,
        ultimos: lluvias90d.slice(0, 30).map((r) => ({
          fecha: r.fecha.toISOString().slice(0, 10),
          mm: Number(r.mm),
          origen: r.origen,
        })),
      },
      clima,
    };
  }

  // ============================================================
  // INVERSOR — portfolio + marketplace abierto ahora
  // ============================================================

  private async contextoInversor(inversorId: string): Promise<ContextoInversor> {
    const [usuario, tenencias, marketplace] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: inversorId },
        select: { id: true, nombre: true, walletAddress: true },
      }),
      this.prisma.tenenciaToken.findMany({
        where: { inversorId, activo: true },
        include: {
          tokenizacion: {
            include: {
              campania: { include: { cultivo: true, establecimiento: true } },
              productor: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tokenizacionCampana.findMany({
        where: {
          activo: true,
          campania: { estadoToken: 'abierta' },
          fondeoHasta: { gt: new Date() },
        },
        include: {
          campania: { include: { cultivo: true, establecimiento: true } },
          productor: { select: { id: true, nombre: true } },
        },
        orderBy: { fondeoHasta: 'asc' },
        take: 20,
      }),
    ]);

    const activas = tenencias.filter((t) => t.estado === 'activa');
    const liquidadas = tenencias.filter((t) => t.estado === 'liquidada');

    const invertidoUsd = tenencias.reduce((acc, t) => acc + Number(t.montoTotalUsd), 0);
    const recibidoUsd = liquidadas.reduce((acc, t) => acc + Number(t.usdcRecibido ?? 0), 0);
    const invertidoLiquidadas = liquidadas.reduce((acc, t) => acc + Number(t.montoTotalUsd), 0);
    const retornoRealizadoUsd = recibidoUsd - invertidoLiquidadas;
    const retornoRealizadoPct =
      invertidoLiquidadas > 0 ? (retornoRealizadoUsd / invertidoLiquidadas) * 100 : null;

    return {
      rol: 'inversor',
      inversor: {
        id: usuario?.id ?? inversorId,
        nombre: usuario?.nombre ?? '',
        walletAddress: usuario?.walletAddress ?? null,
      },
      resumen: {
        tenenciasActivas: activas.length,
        tenenciasLiquidadas: liquidadas.length,
        invertidoTotalUsd: Number(invertidoUsd.toFixed(2)),
        recibidoTotalUsd: Number(recibidoUsd.toFixed(2)),
        retornoRealizadoUsd: Number(retornoRealizadoUsd.toFixed(2)),
        retornoRealizadoPct:
          retornoRealizadoPct !== null ? Number(retornoRealizadoPct.toFixed(2)) : null,
      },
      portfolio: tenencias.map((t) => ({
        tenenciaId: t.id,
        tokenizacionId: t.tokenizacionId,
        campania: t.tokenizacion.campania.nombre,
        cultivo: t.tokenizacion.campania.cultivo?.nombre ?? null,
        productor: t.tokenizacion.productor.nombre,
        productorId: t.tokenizacion.productor.id,
        estado: t.estado,
        tokens: Number(t.tokens),
        precioCompraUsd: Number(t.precioCompraUsd),
        montoTotalUsd: Number(t.montoTotalUsd),
        usdcRecibido: t.usdcRecibido ? Number(t.usdcRecibido) : null,
        fechaCobro: t.fechaCobro?.toISOString() ?? null,
      })),
      marketplace: marketplace.map((t) => ({
        tokenizacionId: t.id,
        nombre: t.campania.nombre,
        cultivo: t.campania.cultivo?.nombre ?? null,
        provincia: t.campania.establecimiento?.provincia ?? null,
        modo: t.modo,
        productor: { id: t.productor.id, nombre: t.productor.nombre },
        precioTokenUsd: Number(t.precioTokenUsd),
        descuentoPct: Number(t.descuentoPct),
        toneladasOfrecidas: Number(t.toneladasOfrecidas),
        tokensVendidos: Number(t.tokensVendidos),
        toneladasMinimas: Number(t.toneladasMinimas),
        fondeoHasta: t.fondeoHasta.toISOString(),
        fechaLiquidacionEstimada: t.fechaLiquidacionEstimada?.toISOString() ?? null,
        garantias: {
          seguroGranizo: t.tieneSeguroGranizo,
          seguroParametrico: t.tieneSeguroParametrico,
          avalSgr: t.tieneAvalSgr,
        },
      })),
    };
  }

  // ============================================================
  // ADMIN — KPIs globales
  // ============================================================

  private async contextoAdmin(): Promise<ContextoAdmin> {
    const inicioMes = new Date();
    inicioMes.setUTCDate(1);
    inicioMes.setUTCHours(0, 0, 0, 0);

    const [enRevision, fondeadas, liquidadasCount, comisionesMes] = await Promise.all([
      this.prisma.tokenizacionCampana.count({
        where: { activo: true, campania: { estadoToken: 'en_revision' } },
      }),
      this.prisma.tokenizacionCampana.count({
        where: { activo: true, campania: { estadoToken: 'fondeada' } },
      }),
      this.prisma.tokenizacionCampana.count({
        where: { activo: true, campania: { estadoToken: 'liquidada' } },
      }),
      this.prisma.comisionPlataforma.aggregate({
        where: { createdAt: { gte: inicioMes } },
        _sum: { montoBrutoUsd: true, montoComisionUsd: true },
        _count: { _all: true },
      }),
    ]);

    return {
      rol: 'admin_plataforma',
      kpis: {
        campanasEnRevision: enRevision,
        campanasFondeadasPendientesLiquidar: fondeadas,
        campanasLiquidadasTotal: liquidadasCount,
        comisionesMesActual: {
          desde: inicioMes.toISOString(),
          operaciones: comisionesMes._count._all,
          brutoUsd: Number(comisionesMes._sum.montoBrutoUsd ?? 0),
          comisionUsd: Number(comisionesMes._sum.montoComisionUsd ?? 0),
        },
      },
    };
  }

  // ============================================================
  // ACOPIO — placeholder
  // ============================================================

  private async contextoAcopio(usuarioId: string): Promise<ContextoAcopio> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true, acopio: { select: { razonSocial: true } } },
    });
    return {
      rol: 'acopio',
      operador: usuario?.nombre ?? '',
      acopio: usuario?.acopio?.razonSocial ?? null,
      nota: 'El rol acopio todavía no tiene pantallas ni acciones habilitadas en Harvest.',
    };
  }

  /** Versión textual del contexto — fácil de leer para logs/debug. */
  resumenTexto(c: Contexto): string {
    switch (c.rol) {
      case 'productor': {
        const lineas: string[] = [];
        lineas.push(`Cuenta: ${c.cuenta.nombre}`);
        lineas.push(
          `Establecimientos (${c.establecimientos.length}): ${c.establecimientos
            .map((e) => `${e.nombre} (${e.lotesActivos} lotes)`)
            .join(', ')}`,
        );
        lineas.push(
          `Lotes activos: ${c.lotes.length}, superficie total: ${c.lotes
            .reduce((s, l) => s + l.superficieHa, 0)
            .toFixed(0)} ha`,
        );
        lineas.push(
          `Campañas activas: ${c.campaniasActivas.map((cp) => `${cp.nombre} (${cp.tipo})`).join(', ') || 'ninguna'}`,
        );
        lineas.push(`Lotes en campaña: ${c.lotesCampania.length}`);
        if (c.clima) {
          lineas.push(
            `Clima ${c.clima.establecimiento}: ${c.clima.actual.descripcion}, ${c.clima.actual.temperatura}°C, viento ${c.clima.actual.vientoKmh} km/h.`,
          );
        }
        lineas.push(
          `Lluvias últimos 90d: ${c.lluviasUltimos90Dias.totalMm.toFixed(1)} mm (${c.lluviasUltimos90Dias.diasConRegistro} días con registro)`,
        );
        return lineas.join('\n');
      }
      case 'inversor':
        return `Inversor ${c.inversor.nombre}: ${c.resumen.tenenciasActivas} tenencias activas, ${c.resumen.tenenciasLiquidadas} liquidadas. Marketplace: ${c.marketplace.length} campañas abiertas.`;
      case 'admin_plataforma':
        return `Admin — Cola de revisión: ${c.kpis.campanasEnRevision}. Pendientes de liquidar: ${c.kpis.campanasFondeadasPendientesLiquidar}. Comisiones del mes: ${c.kpis.comisionesMesActual.comisionUsd.toFixed(2)} USDC.`;
      case 'acopio':
        return `Operador acopio ${c.operador} (${c.acopio ?? 'sin acopio asociado'}).`;
    }
  }
}

// ============================================================
// Tipos del contexto que se le pasa a Claude
// ============================================================

export type Contexto = ContextoProductor | ContextoInversor | ContextoAdmin | ContextoAcopio;

export interface ContextoProductor {
  rol: 'productor';
  cuenta: { nombre: string };
  catalogo: { cultivos: string[] };
  establecimientos: {
    id: string;
    nombre: string;
    ubicacion: string | null;
    tenencia: string;
    superficieTotalHa: number | null;
    lotesActivos: number;
    tieneCoordenadas: boolean;
  }[];
  lotes: {
    id: string;
    nombre: string;
    establecimiento: string;
    superficieHa: number;
    tenencia: string | null;
    arrendamiento: { valor: number; unidad: string } | null;
  }[];
  campaniasActivas: {
    id: string;
    nombre: string;
    tipo: string | null;
    fechaInicio: string;
    fechaFin: string | null;
  }[];
  lotesCampania: {
    id: string;
    lote: string;
    establecimiento: string;
    campania: string;
    cultivo: string;
    superficieSembradaHa: number;
    fechaSiembra: string | null;
    rindeEstimadoQqHa: number | null;
    rindeRealQqHa: number | null;
    precioGranoUsdTn: number | null;
    fechaCosecha: string | null;
  }[];
  resultadosCalculados: ResultadoCampoCalculado[];
  laboresRecientes: {
    fecha: string;
    tipo: string;
    ejecutor: string;
    lote: string;
    cultivo: string;
    costoUsd: number | null;
    formaPago: string | null;
    nota: string | null;
  }[];
  insumosRecientes: {
    fecha: string;
    tipo: string;
    producto: string;
    cantidad: number;
    unidad: string;
    costoUsd: number;
    formaPago: string | null;
    lote: string;
    cultivo: string;
  }[];
  lluviasUltimos90Dias: {
    totalMm: number;
    diasConRegistro: number;
    ultimos: { fecha: string; mm: number; origen: string }[];
  };
  clima: {
    establecimiento: string;
    actual: {
      temperatura: number;
      humedad: number;
      vientoKmh: number;
      descripcion: string;
      lluviaUltimaHora: number;
    };
    proximosDias: {
      fecha: string;
      tMax: number;
      tMin: number;
      lluvia: number;
      probLluvia: number;
      descripcion: string;
    }[];
  } | null;
}

export interface ContextoInversor {
  rol: 'inversor';
  inversor: { id: string; nombre: string; walletAddress: string | null };
  resumen: {
    tenenciasActivas: number;
    tenenciasLiquidadas: number;
    invertidoTotalUsd: number;
    recibidoTotalUsd: number;
    retornoRealizadoUsd: number;
    retornoRealizadoPct: number | null;
  };
  portfolio: {
    tenenciaId: string;
    tokenizacionId: string;
    campania: string;
    cultivo: string | null;
    productor: string;
    productorId: string;
    estado: string;
    tokens: number;
    precioCompraUsd: number;
    montoTotalUsd: number;
    usdcRecibido: number | null;
    fechaCobro: string | null;
  }[];
  marketplace: {
    tokenizacionId: string;
    nombre: string;
    cultivo: string | null;
    provincia: string | null;
    modo: string;
    productor: { id: string; nombre: string };
    precioTokenUsd: number;
    descuentoPct: number;
    toneladasOfrecidas: number;
    tokensVendidos: number;
    toneladasMinimas: number;
    fondeoHasta: string;
    fechaLiquidacionEstimada: string | null;
    garantias: {
      seguroGranizo: boolean;
      seguroParametrico: boolean;
      avalSgr: boolean;
    };
  }[];
}

export interface ContextoAdmin {
  rol: 'admin_plataforma';
  kpis: {
    campanasEnRevision: number;
    campanasFondeadasPendientesLiquidar: number;
    campanasLiquidadasTotal: number;
    comisionesMesActual: {
      desde: string;
      operaciones: number;
      brutoUsd: number;
      comisionUsd: number;
    };
  };
}

export interface ContextoAcopio {
  rol: 'acopio';
  operador: string;
  acopio: string | null;
  nota: string;
}

export interface ResultadoCampoCalculado {
  lote: string;
  establecimiento: string;
  campania: string;
  cultivo: string;
  esProyeccion: boolean;
  superficieHa: string;
  rinde: string;
  rindeFuente: 'real' | 'estimado';
  ingresoBruto: string;
  costoTotal: string;
  costoTotalHa: string;
  margenNeto: string;
  margenNetoHa: string;
  puntoEquilibrio: string;
  lectura: string;
}

// Backwards-compat: si algo importaba `ContextoAgro`, se resuelve al productor.
export type ContextoAgro = ContextoProductor;
