import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculosService } from '../calculos/calculos.service';
import { ClimaService } from '../clima/clima.service';

/**
 * Servicio que arma el "contexto agro" que se le pasa a Claude en cada
 * conversación. Lee del estado real de la cuenta del usuario y devuelve
 * un objeto estructurado que el LLM puede entender.
 *
 * Diseño:
 *  - Se pasa SIEMPRE: información de cuenta, establecimientos, lotes, cultivos.
 *  - Se pasa si hay: campañas activas con sus lotes-campaña y resultados.
 *  - Se acotan los datos para no inflar tokens innecesariamente:
 *    * Solo campañas con fechaInicio dentro de los últimos 18 meses.
 *    * Últimas 30 labores e insumos.
 *    * Lluvias de los últimos 90 días.
 *    * Clima actual solo si el primer establecimiento tiene coordenadas.
 */
@Injectable()
export class ContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculos: CalculosService,
    private readonly clima: ClimaService,
  ) {}

  async armarContexto(cuentaId: string): Promise<ContextoAgro> {
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
    let clima: ContextoAgro['clima'] = null;
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
      cuenta: {
        nombre: cuenta?.nombre ?? 'Sin nombre',
      },
      catalogo: {
        cultivos: cultivos.map((c) => c.nombre),
      },
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

  /** Versión textual del contexto — fácil de leer para humanos y para Claude.
   *  Se usa al armar el system prompt. */
  resumenTexto(c: ContextoAgro): string {
    const lineas: string[] = [];
    lineas.push(`Cuenta: ${c.cuenta.nombre}`);
    lineas.push(`Establecimientos (${c.establecimientos.length}): ${c.establecimientos.map((e) => `${e.nombre} (${e.lotesActivos} lotes)`).join(', ')}`);
    lineas.push(`Lotes activos: ${c.lotes.length}, superficie total: ${c.lotes.reduce((s, l) => s + l.superficieHa, 0).toFixed(0)} ha`);
    lineas.push(`Campañas activas: ${c.campaniasActivas.map((cp) => `${cp.nombre} (${cp.tipo})`).join(', ') || 'ninguna'}`);
    lineas.push(`Lotes en campaña: ${c.lotesCampania.length}`);
    if (c.clima) {
      lineas.push(`Clima ${c.clima.establecimiento}: ${c.clima.actual.descripcion}, ${c.clima.actual.temperatura}°C, viento ${c.clima.actual.vientoKmh} km/h.`);
    }
    lineas.push(`Lluvias últimos 90d: ${c.lluviasUltimos90Dias.totalMm.toFixed(1)} mm (${c.lluviasUltimos90Dias.diasConRegistro} días con registro)`);
    return lineas.join('\n');
  }
}

// ============================================================
// Tipos del contexto que se le pasa a Claude
// ============================================================

export interface ContextoAgro {
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
    tipo: string;
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
