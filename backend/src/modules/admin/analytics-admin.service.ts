import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/// Métricas agregadas por cuenta y globales. Todas en USD y qq (quintales).
@Injectable()
export class AnalyticsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /// Analítica completa de una cuenta — producción, productos, márgenes, actividad.
  async cuenta(cuentaId: string) {
    const lotesCampania = await this.prisma.loteCampania.findMany({
      where: { lote: { cuentaId } },
      include: {
        cultivo: { select: { nombre: true } },
        lote: { select: { superficieHa: true, tenencia: true, arrendamientoValor: true, arrendamientoUnidad: true } },
        labores: { select: { costoTotalUsd: true } },
        insumosAplicados: { select: { costoTotalUsd: true, producto: true, cantidad: true, unidad: true, tipo: true } },
      },
    });

    // Producción por cultivo
    const cultivosMap = new Map<string, { superficieHa: number; producidoKg: number; ingresoUsd: number }>();
    let superficieTotal = 0;
    let ingresoTotal = 0;
    let costoDirectoTotal = 0;

    for (const lc of lotesCampania) {
      const superficie = Number(lc.superficieSembradaHa);
      const rinde = Number(lc.rindeRealQqHa ?? lc.rindeEstimadoQqHa ?? 0);
      const precioPorQq = Number(lc.precioGranoUsdTn ?? 0) / 10;
      const produccionKg = rinde * superficie * 100;
      const ingresoLote = rinde * superficie * precioPorQq;
      const costoInsumos = lc.insumosAplicados.reduce((s, i) => s + Number(i.costoTotalUsd ?? 0), 0);
      const costoLabores = lc.labores.reduce((s, l) => s + Number(l.costoTotalUsd ?? 0), 0);

      superficieTotal += superficie;
      ingresoTotal += ingresoLote;
      costoDirectoTotal += costoInsumos + costoLabores;

      const k = lc.cultivo.nombre;
      const prev = cultivosMap.get(k) ?? { superficieHa: 0, producidoKg: 0, ingresoUsd: 0 };
      cultivosMap.set(k, {
        superficieHa: prev.superficieHa + superficie,
        producidoKg: prev.producidoKg + produccionKg,
        ingresoUsd: prev.ingresoUsd + ingresoLote,
      });
    }

    const cultivos = Array.from(cultivosMap.entries())
      .map(([nombre, v]) => ({
        nombre,
        superficieHa: v.superficieHa,
        producidoKg: v.producidoKg,
        producidoTn: v.producidoKg / 1000,
        rindePromedioQqHa: v.superficieHa > 0 ? (v.producidoKg / v.superficieHa) / 100 : 0,
        ingresoUsd: v.ingresoUsd,
      }))
      .sort((a, b) => b.superficieHa - a.superficieHa);

    const margenNetoUsd = ingresoTotal - costoDirectoTotal;

    // Top productos usados (acumulado de insumos aplicados, agrupado por producto+tipo)
    type ProdAcc = { producto: string; tipo: string; cantidad: number; unidad: string; costoUsd: number };
    const prodMap = new Map<string, ProdAcc>();
    for (const lc of lotesCampania) {
      for (const ia of lc.insumosAplicados) {
        const k = `${ia.tipo}::${ia.producto}::${ia.unidad}`;
        const prev = prodMap.get(k) ?? { producto: ia.producto, tipo: ia.tipo, cantidad: 0, unidad: ia.unidad, costoUsd: 0 };
        prodMap.set(k, {
          ...prev,
          cantidad: prev.cantidad + Number(ia.cantidad ?? 0),
          costoUsd: prev.costoUsd + Number(ia.costoTotalUsd ?? 0),
        });
      }
    }
    const topProductos = Array.from(prodMap.values())
      .sort((a, b) => b.costoUsd - a.costoUsd)
      .slice(0, 10);

    // Última actividad
    const [ultimoMonitoreo, ultimoInsumo, ultimoLabor, ultimoReporte] = await Promise.all([
      this.prisma.monitoreo.findFirst({ where: { cuentaId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      this.prisma.insumoAplicado.findFirst({ where: { loteCampania: { lote: { cuentaId } } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      this.prisma.labor.findFirst({ where: { loteCampania: { lote: { cuentaId } } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      this.prisma.reporte.findFirst({ where: { cuentaId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);

    // Timeline 30 días (conteo combinado de monitoreos + insumos + labores + reportes)
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    const eventos = await this.timeline30dias(cuentaId, desde);

    // Counts globales útiles
    const [establecimientos, lotes, campaniasActivas, miembrosActivos, monitoreos, reportes] = await Promise.all([
      this.prisma.establecimiento.count({ where: { cuentaId, activo: true } }),
      this.prisma.lote.count({ where: { cuentaId, activo: true } }),
      this.prisma.campania.count({ where: { cuentaId, activo: true } }),
      this.prisma.usuarioCuenta.count({ where: { cuentaId, activo: true } }),
      this.prisma.monitoreo.count({ where: { cuentaId, activo: true } }),
      this.prisma.reporte.count({ where: { cuentaId, activo: true } }),
    ]);

    return {
      totales: {
        superficieHa: superficieTotal,
        ingresoUsd: ingresoTotal,
        costoDirectoUsd: costoDirectoTotal,
        margenNetoUsd,
        ingresoPorHa: superficieTotal > 0 ? ingresoTotal / superficieTotal : 0,
        margenPorHa: superficieTotal > 0 ? margenNetoUsd / superficieTotal : 0,
      },
      cultivos,
      topProductos,
      ultimaActividad: {
        monitoreo: ultimoMonitoreo?.createdAt ?? null,
        insumo: ultimoInsumo?.createdAt ?? null,
        labor: ultimoLabor?.createdAt ?? null,
        reporte: ultimoReporte?.createdAt ?? null,
      },
      timeline30dias: eventos,
      conteos: {
        establecimientos,
        lotes,
        campaniasActivas,
        miembrosActivos,
        monitoreos,
        reportes,
      },
    };
  }

  /// Métricas globales de la plataforma.
  async global() {
    const [
      cuentasActivas,
      cuentasTotales,
      usuariosActivos,
      establecimientos,
      lotes,
      lotesCampania,
      campaniasActivas,
      pendientesActivacion,
    ] = await Promise.all([
      this.prisma.cuenta.count({ where: { activo: true } }),
      this.prisma.cuenta.count(),
      this.prisma.usuario.count({ where: { activo: true } }),
      this.prisma.establecimiento.count({ where: { activo: true } }),
      this.prisma.lote.count({ where: { activo: true } }),
      this.prisma.loteCampania.count(),
      this.prisma.campania.count({ where: { activo: true } }),
      this.prisma.tokenInvitacion.count({ where: { usadoEn: null, expiraEn: { gt: new Date() } } }),
    ]);

    // Superficie total y producción total en la plataforma
    const lcs = await this.prisma.loteCampania.findMany({
      select: {
        superficieSembradaHa: true,
        rindeRealQqHa: true,
        rindeEstimadoQqHa: true,
        precioGranoUsdTn: true,
        cultivo: { select: { nombre: true } },
      },
    });
    let superficieTotal = 0;
    let produccionKg = 0;
    let ingresoTotal = 0;
    const cultivosMap = new Map<string, number>();
    for (const lc of lcs) {
      const sup = Number(lc.superficieSembradaHa);
      const rinde = Number(lc.rindeRealQqHa ?? lc.rindeEstimadoQqHa ?? 0);
      const precio = Number(lc.precioGranoUsdTn ?? 0) / 10;
      const prod = rinde * sup * 100;
      superficieTotal += sup;
      produccionKg += prod;
      ingresoTotal += rinde * sup * precio;
      cultivosMap.set(lc.cultivo.nombre, (cultivosMap.get(lc.cultivo.nombre) ?? 0) + sup);
    }

    // Top 5 cuentas por superficie sembrada
    const cuentas = await this.prisma.cuenta.findMany({
      where: { activo: true },
      include: {
        establecimientos: {
          include: {
            lotes: {
              include: { lotesCampania: { select: { superficieSembradaHa: true } } },
            },
          },
        },
      },
    });
    const topCuentas = cuentas
      .map((c) => {
        let sup = 0;
        for (const e of c.establecimientos) for (const l of e.lotes) for (const lc of l.lotesCampania) {
          sup += Number(lc.superficieSembradaHa);
        }
        return { id: c.id, nombre: c.nombre, superficieHa: sup };
      })
      .sort((a, b) => b.superficieHa - a.superficieHa)
      .slice(0, 5);

    return {
      cuentas: { activas: cuentasActivas, totales: cuentasTotales },
      usuarios: { activos: usuariosActivos, pendientesActivacion },
      operacion: {
        establecimientos,
        lotes,
        lotesCampania,
        campaniasActivas,
        superficieHa: superficieTotal,
        produccionKg,
        produccionTn: produccionKg / 1000,
        ingresoEstimadoUsd: ingresoTotal,
      },
      superficiePorCultivo: Array.from(cultivosMap.entries())
        .map(([nombre, superficieHa]) => ({ nombre, superficieHa }))
        .sort((a, b) => b.superficieHa - a.superficieHa),
      topCuentas,
    };
  }

  private async timeline30dias(cuentaId: string, desde: Date) {
    // Hacemos 1 raw query agrupando por día de evento. Combinamos todas las tablas
    // de "actividad" del usuario en una sola serie.
    const rows = await this.prisma.$queryRaw<{ fecha: Date; eventos: bigint }[]>(Prisma.sql`
      WITH eventos AS (
        SELECT created_at FROM monitoreos
          WHERE cuenta_id = ${cuentaId}::uuid AND created_at >= ${desde}
        UNION ALL
        SELECT ia.created_at FROM insumos_aplicados ia
          JOIN lotes_campania lc ON ia.lote_campania_id = lc.id
          JOIN lotes l ON lc.lote_id = l.id
          WHERE l.cuenta_id = ${cuentaId}::uuid AND ia.created_at >= ${desde}
        UNION ALL
        SELECT lb.created_at FROM labores lb
          JOIN lotes_campania lc ON lb.lote_campania_id = lc.id
          JOIN lotes l ON lc.lote_id = l.id
          WHERE l.cuenta_id = ${cuentaId}::uuid AND lb.created_at >= ${desde}
        UNION ALL
        SELECT created_at FROM reportes
          WHERE cuenta_id = ${cuentaId}::uuid AND created_at >= ${desde}
      )
      SELECT date_trunc('day', created_at)::date AS fecha, COUNT(*) AS eventos
      FROM eventos
      GROUP BY fecha
      ORDER BY fecha ASC
    `);
    return rows.map((r) => ({ fecha: r.fecha.toISOString().slice(0, 10), eventos: Number(r.eventos) }));
  }
}
