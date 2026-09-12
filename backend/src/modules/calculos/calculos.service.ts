import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { ingresoUsd, precioUsdPorQq, toFixed2 } from './conversiones';

/**
 * CalculosService — el corazón del producto.
 *
 * Las fórmulas siguen la sección 4 de AgroFacil_MVP_Especificacion.docx:
 * - Costos: insumos + labores + arrendamiento + otros
 * - Ingreso: rinde × superficie × precio_usd_qq (con rinde_real ?? rinde_estimado)
 * - Márgenes: bruto y neto en USD, USD/ha y qq/ha
 * - Punto de equilibrio: costo_total_ha / precio_usd_qq
 *
 * REGLA DE ORO en agregaciones: sumar totales y RECALCULAR /ha sobre superficie agregada.
 * NUNCA promediar promedios.
 */
@Injectable()
export class CalculosService {
  constructor(private readonly prisma: PrismaService) {}

  async calcularResultadoLote(cuentaId: string, loteCampaniaId: string) {
    const lc = await this.prisma.loteCampania.findFirst({
      where: { id: loteCampaniaId, cuentaId },
      include: {
        lote: { include: { establecimiento: { select: { id: true, nombre: true } } } },
        cultivo: true,
        campania: true,
        labores: { where: { activo: true } },
        insumosAplicados: { where: { activo: true } },
      },
    });
    if (!lc) throw new NotFoundException(`LoteCampania ${loteCampaniaId} no encontrado`);
    return this.computarResultado(lc);
  }

  async agregarPorCultivo(cuentaId: string, campaniaId: string) {
    const lcs = await this.prisma.loteCampania.findMany({
      where: { cuentaId, campaniaId, activo: true },
      include: {
        lote: true,
        cultivo: true,
        labores: { where: { activo: true } },
        insumosAplicados: { where: { activo: true } },
      },
    });
    if (lcs.length === 0) return [];

    const resultados = lcs.map((lc) => ({ lc, resultado: this.computarResultado(lc) }));

    const porCultivo = new Map<
      string,
      {
        cultivoId: string;
        cultivoNombre: string;
        cantidadLotes: number;
        superficieHa: Decimal;
        ingresoBruto: Decimal;
        costoTotal: Decimal;
        margenNeto: Decimal;
        algunoProyectado: boolean;
      }
    >();

    for (const { lc, resultado } of resultados) {
      const acc = porCultivo.get(lc.cultivoId) ?? {
        cultivoId: lc.cultivoId,
        cultivoNombre: lc.cultivo.nombre,
        cantidadLotes: 0,
        superficieHa: new Decimal(0),
        ingresoBruto: new Decimal(0),
        costoTotal: new Decimal(0),
        margenNeto: new Decimal(0),
        algunoProyectado: false,
      };
      acc.cantidadLotes += 1;
      acc.superficieHa = acc.superficieHa.plus(resultado._raw.superficieHa);
      acc.ingresoBruto = acc.ingresoBruto.plus(resultado._raw.ingresoBruto);
      acc.costoTotal = acc.costoTotal.plus(resultado._raw.costoTotal);
      acc.margenNeto = acc.margenNeto.plus(resultado._raw.margenNeto);
      acc.algunoProyectado = acc.algunoProyectado || resultado.esProyeccion;
      porCultivo.set(lc.cultivoId, acc);
    }

    // Recalcular /ha sobre superficie AGREGADA (no promediar promedios)
    return Array.from(porCultivo.values()).map((acc) => ({
      cultivoId: acc.cultivoId,
      cultivoNombre: acc.cultivoNombre,
      cantidadLotes: acc.cantidadLotes,
      esProyeccion: acc.algunoProyectado,
      superficieHa: toFixed2(acc.superficieHa),
      ingresoBruto: toFixed2(acc.ingresoBruto),
      costoTotal: toFixed2(acc.costoTotal),
      margenNeto: toFixed2(acc.margenNeto),
      ingresoBrutoHa: acc.superficieHa.isZero() ? '0.00' : toFixed2(acc.ingresoBruto.div(acc.superficieHa)),
      costoTotalHa: acc.superficieHa.isZero() ? '0.00' : toFixed2(acc.costoTotal.div(acc.superficieHa)),
      margenNetoHa: acc.superficieHa.isZero() ? '0.00' : toFixed2(acc.margenNeto.div(acc.superficieHa)),
    }));
  }

  async resumenCampania(cuentaId: string, campaniaId: string) {
    const lcs = await this.prisma.loteCampania.findMany({
      where: { cuentaId, campaniaId, activo: true },
      include: {
        lote: true,
        cultivo: true,
        labores: { where: { activo: true } },
        insumosAplicados: { where: { activo: true } },
      },
    });

    let superficieHa = new Decimal(0);
    let ingresoBruto = new Decimal(0);
    let costoTotal = new Decimal(0);
    let margenNeto = new Decimal(0);
    let algunoProyectado = false;

    for (const lc of lcs) {
      const r = this.computarResultado(lc);
      superficieHa = superficieHa.plus(r._raw.superficieHa);
      ingresoBruto = ingresoBruto.plus(r._raw.ingresoBruto);
      costoTotal = costoTotal.plus(r._raw.costoTotal);
      margenNeto = margenNeto.plus(r._raw.margenNeto);
      algunoProyectado = algunoProyectado || r.esProyeccion;
    }

    return {
      campaniaId,
      cantidadLotes: lcs.length,
      esProyeccion: algunoProyectado,
      totales: {
        superficieHa: toFixed2(superficieHa),
        ingresoBruto: toFixed2(ingresoBruto),
        costoTotal: toFixed2(costoTotal),
        margenNeto: toFixed2(margenNeto),
        ingresoBrutoHa: superficieHa.isZero() ? '0.00' : toFixed2(ingresoBruto.div(superficieHa)),
        costoTotalHa: superficieHa.isZero() ? '0.00' : toFixed2(costoTotal.div(superficieHa)),
        margenNetoHa: superficieHa.isZero() ? '0.00' : toFixed2(margenNeto.div(superficieHa)),
      },
      porCultivo: await this.agregarPorCultivo(cuentaId, campaniaId),
    };
  }

  // ============================================================
  // Fórmula central — pública para que los tests la puedan ejercitar
  // sin tocar la BD (recibe el aggregate de un lote_campania).
  // ============================================================

  computarResultado(
    lc: LoteCampaniaConRelaciones,
  ): ResultadoLote {
    const superficieHa = new Decimal(lc.superficieSembradaHa.toString());
    if (superficieHa.isZero()) {
      throw new BadRequestException('superficie_sembrada_ha no puede ser 0 para calcular resultado');
    }

    const precioUsdTn = new Decimal((lc.precioGranoUsdTn ?? 0).toString());
    const precioUsdQq = precioUsdPorQq(precioUsdTn);

    // === Rinde ===
    const rindeReal = lc.rindeRealQqHa !== null && lc.rindeRealQqHa !== undefined
      ? new Decimal(lc.rindeRealQqHa.toString())
      : null;
    const rindeEstimado = lc.rindeEstimadoQqHa !== null && lc.rindeEstimadoQqHa !== undefined
      ? new Decimal(lc.rindeEstimadoQqHa.toString())
      : null;
    const rinde = rindeReal ?? rindeEstimado ?? new Decimal(0);
    const esProyeccion = rindeReal === null;

    // === Costos directos ===
    const costoInsumos = lc.insumosAplicados.reduce(
      (acc, i) => acc.plus(new Decimal(i.costoTotalUsd.toString())),
      new Decimal(0),
    );
    const costoLabores = lc.labores.reduce(
      (acc, l) => acc.plus(l.costoTotalUsd === null ? new Decimal(0) : new Decimal(l.costoTotalUsd.toString())),
      new Decimal(0),
    );
    const costoDirecto = costoInsumos.plus(costoLabores);

    // === Ingreso bruto ===
    const ingresoBruto = precioUsdQq.isZero()
      ? new Decimal(0)
      : ingresoUsd(rinde, superficieHa, precioUsdQq);

    // === Arrendamiento ===
    const costoArrendamiento = this.calcularArrendamiento({
      tenencia: lc.lote.tenencia,
      unidad: lc.lote.arrendamientoUnidad,
      valor: lc.lote.arrendamientoValor,
      superficieHa,
      precioUsdQq,
      ingresoBruto,
    });

    // === Totales ===
    const otrosGastos = new Decimal(0); // placeholder para futuro
    const costoTotal = costoDirecto.plus(costoArrendamiento).plus(otrosGastos);
    const costoTotalHa = costoTotal.div(superficieHa);

    // === Márgenes ===
    const margenBruto = ingresoBruto.minus(costoDirecto);
    const margenBrutoHa = margenBruto.div(superficieHa);
    const margenNeto = margenBruto.minus(costoArrendamiento).minus(otrosGastos);
    const margenNetoHa = margenNeto.div(superficieHa);
    const margenNetoQqHa = precioUsdQq.isZero() ? new Decimal(0) : margenNetoHa.div(precioUsdQq);

    // === Punto de equilibrio (rinde de indiferencia) ===
    const rindeEquilibrioQqHa = precioUsdQq.isZero() ? new Decimal(0) : costoTotalHa.div(precioUsdQq);
    const margenSeguridadQq = rinde.minus(rindeEquilibrioQqHa);

    return {
      loteCampaniaId: lc.id,
      cultivo: lc.cultivo.nombre,
      lote: lc.lote.nombre,
      esProyeccion,
      superficieHa: toFixed2(superficieHa),
      rinde: rinde.toFixed(2),
      rindeFuente: esProyeccion ? 'estimado' : 'real',
      precioGranoUsdTn: precioUsdTn.toFixed(2),
      precioGranoUsdQq: precioUsdQq.toFixed(4),
      ingresoBruto: toFixed2(ingresoBruto),
      costos: {
        insumos: toFixed2(costoInsumos),
        labores: toFixed2(costoLabores),
        directo: toFixed2(costoDirecto),
        arrendamiento: toFixed2(costoArrendamiento),
        otros: toFixed2(otrosGastos),
        total: toFixed2(costoTotal),
        totalHa: toFixed2(costoTotalHa),
      },
      margenes: {
        bruto: toFixed2(margenBruto),
        brutoHa: toFixed2(margenBrutoHa),
        neto: toFixed2(margenNeto),
        netoHa: toFixed2(margenNetoHa),
        netoQqHa: margenNetoQqHa.toFixed(2),
      },
      puntoEquilibrio: {
        rindeQqHa: rindeEquilibrioQqHa.toFixed(2),
        margenSeguridadQq: margenSeguridadQq.toFixed(2),
        lectura: this.armarLecturaPuntoEq(rinde, rindeEquilibrioQqHa),
      },
      // valores crudos para usar en agregaciones — no se serializan al cliente
      _raw: {
        superficieHa,
        ingresoBruto,
        costoTotal,
        margenNeto,
      },
    };
  }

  calcularArrendamiento(p: {
    tenencia: 'propio' | 'arrendado' | 'mixto' | null;
    unidad: 'qq_ha' | 'usd_ha' | 'pct_produccion' | null;
    valor: { toString: () => string } | null;
    superficieHa: Decimal;
    precioUsdQq: Decimal;
    ingresoBruto: Decimal;
  }): Decimal {
    if (p.tenencia !== 'arrendado' || p.valor === null || p.unidad === null) {
      return new Decimal(0);
    }
    const valor = new Decimal(p.valor.toString());
    switch (p.unidad) {
      case 'qq_ha':
        return valor.times(p.superficieHa).times(p.precioUsdQq);
      case 'usd_ha':
        return valor.times(p.superficieHa);
      case 'pct_produccion':
        return p.ingresoBruto.times(valor).div(100);
      default:
        return new Decimal(0);
    }
  }

  private armarLecturaPuntoEq(rinde: Decimal, equilibrio: Decimal): string {
    const e = equilibrio.toFixed(1);
    const r = rinde.toFixed(1);
    if (rinde.greaterThanOrEqualTo(equilibrio)) {
      return `Necesitás ${e} qq/ha para no perder. Tu rinde es ${r} qq/ha — estás por encima.`;
    }
    return `Necesitás ${e} qq/ha para no perder. Tu rinde es ${r} qq/ha — estás por debajo.`;
  }
}

// ============================================================
// Tipos auxiliares
// ============================================================

export interface LoteCampaniaConRelaciones {
  id: string;
  superficieSembradaHa: { toString: () => string };
  precioGranoUsdTn: { toString: () => string } | null;
  rindeRealQqHa: { toString: () => string } | null;
  rindeEstimadoQqHa: { toString: () => string } | null;
  lote: {
    nombre: string;
    tenencia: 'propio' | 'arrendado' | 'mixto' | null;
    arrendamientoUnidad: 'qq_ha' | 'usd_ha' | 'pct_produccion' | null;
    arrendamientoValor: { toString: () => string } | null;
  };
  cultivo: { nombre: string };
  labores: Array<{ costoTotalUsd: { toString: () => string } | null }>;
  insumosAplicados: Array<{ costoTotalUsd: { toString: () => string } }>;
}

export interface ResultadoLote {
  loteCampaniaId: string;
  cultivo: string;
  lote: string;
  esProyeccion: boolean;
  superficieHa: string;
  rinde: string;
  rindeFuente: 'real' | 'estimado';
  precioGranoUsdTn: string;
  precioGranoUsdQq: string;
  ingresoBruto: string;
  costos: {
    insumos: string;
    labores: string;
    directo: string;
    arrendamiento: string;
    otros: string;
    total: string;
    totalHa: string;
  };
  margenes: {
    bruto: string;
    brutoHa: string;
    neto: string;
    netoHa: string;
    netoQqHa: string;
  };
  puntoEquilibrio: {
    rindeQqHa: string;
    margenSeguridadQq: string;
    lectura: string;
  };
  _raw: {
    superficieHa: Decimal;
    ingresoBruto: Decimal;
    costoTotal: Decimal;
    margenNeto: Decimal;
  };
}
