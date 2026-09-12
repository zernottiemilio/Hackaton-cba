import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servicio con la vista "inversor" del catálogo:
 * lista de productores activos con rating y sus campañas.
 *
 * El rating se calcula de forma determinística a partir de datos reales:
 *  - Ratio de campañas liquidadas por encima o por debajo del precio de referencia
 *  - Garantías activadas
 *  - Antigüedad
 *  - Completitud (fotos, historial de rinde)
 * Estructura pensada para ser reemplazada por un score real cuando existan
 * suficientes ciclos históricos.
 */
@Injectable()
export class ProductoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    // Traemos usuarios con al menos una tokenización creada (son productores reales).
    const productores = await this.prisma.usuario.findMany({
      where: {
        contextosTokenizacion: { has: 'productor' },
        tokenizacionesProductor: { some: {} },
      },
      include: {
        tokenizacionesProductor: {
          include: {
            campania: {
              include: { cultivo: true, establecimiento: true },
            },
            tenencias: { select: { id: true, tokens: true } },
          },
        },
      },
    });

    return productores.map((p) => this.armarProductorResumen(p));
  }

  /**
   * Histórico de campañas ya liquidadas del productor + KPIs agregados.
   * Público. Lo consume el marketplace, la ficha del productor y el
   * asistente IA (para responder "¿en qué productor conviene invertir?").
   *
   * A diferencia de `detalle()`, acá solo devolvemos las liquidadas y
   * derivamos rendimientos reales — no series mock. Si el productor no
   * tiene campañas liquidadas todavía, `campanas` es [] y `kpis` refleja
   * "sin historial".
   */
  async historial(productorId: string) {
    const productor = await this.prisma.usuario.findUnique({
      where: { id: productorId },
      select: { id: true, nombre: true, walletAddress: true, createdAt: true },
    });
    if (!productor) throw new NotFoundException('Productor no encontrado');

    const liquidadas = await this.prisma.tokenizacionCampana.findMany({
      where: {
        productorId,
        campania: { estadoToken: 'liquidada' },
      },
      include: {
        campania: {
          include: { cultivo: true, establecimiento: true },
        },
        tenencias: {
          select: { id: true, tokens: true, precioCompraUsd: true, usdcRecibido: true },
        },
      },
      orderBy: { liquidadaEn: 'desc' },
    });

    const campanas = liquidadas.map((t) => {
      const rindeReal = t.campania.rindeRealTnHa ? Number(t.campania.rindeRealTnHa) : null;
      const rindeEstimado = t.campania.rindeEstimadoTnHa ? Number(t.campania.rindeEstimadoTnHa) : null;
      const precioReferencia = Number(t.precioReferenciaUsdTn);
      const precioLiquidacion = t.precioLiquidacionUsdTn ? Number(t.precioLiquidacionUsdTn) : null;
      const payoutPorToken = t.payoutPorTokenUsd ? Number(t.payoutPorTokenUsd) : null;

      // Retorno promedio ponderado de las tenencias.
      const totalTokens = t.tenencias.reduce((acc, ten) => acc + Number(ten.tokens), 0);
      const totalInvertido = t.tenencias.reduce(
        (acc, ten) => acc + Number(ten.tokens) * Number(ten.precioCompraUsd),
        0,
      );
      const totalRecibido = t.tenencias.reduce(
        (acc, ten) => acc + Number(ten.usdcRecibido ?? 0),
        0,
      );
      const retornoPct =
        totalInvertido > 0 ? ((totalRecibido - totalInvertido) / totalInvertido) * 100 : null;

      // On-time: liquidada dentro del margen (24h) sobre la fecha estimada.
      const onTime = t.fechaLiquidacionEstimada && t.liquidadaEn
        ? new Date(t.liquidadaEn).getTime() <=
            new Date(t.fechaLiquidacionEstimada).getTime() + 24 * 3600 * 1000
        : null;

      return {
        id: t.id,
        campaniaId: t.campaniaId,
        nombre: t.campania.nombre,
        cultivo: t.campania.cultivo?.nombre ?? null,
        cicloAgricola: t.campania.cicloAgricola,
        establecimiento: t.campania.establecimiento?.nombre ?? null,
        provincia: t.campania.establecimiento?.provincia ?? null,
        rindeEstimadoTnHa: rindeEstimado,
        rindeRealTnHa: rindeReal,
        rindeCumplimientoPct:
          rindeEstimado && rindeReal ? (rindeReal / rindeEstimado) * 100 : null,
        precioReferenciaUsdTn: precioReferencia,
        precioLiquidacionUsdTn: precioLiquidacion,
        toneladasOfrecidas: Number(t.toneladasOfrecidas),
        toneladasEntregadas: t.toneladasEntregadas ? Number(t.toneladasEntregadas) : null,
        payoutPorTokenUsd: payoutPorToken,
        retornoInversorPct: retornoPct,
        onTime,
        inversoresCount: t.tenencias.length,
        totalRecaudadoUsd: totalInvertido,
        fondeoDesde: t.fondeoDesde,
        fondeoHasta: t.fondeoHasta,
        fechaLiquidacionEstimada: t.fechaLiquidacionEstimada,
        liquidadaEn: t.liquidadaEn,
      };
    });

    const retornos = campanas.map((c) => c.retornoInversorPct).filter((r): r is number => r !== null);
    const cumplimientos = campanas
      .map((c) => c.rindeCumplimientoPct)
      .filter((r): r is number => r !== null);
    const onTimeCount = campanas.filter((c) => c.onTime === true).length;
    const onTimeEvaluables = campanas.filter((c) => c.onTime !== null).length;

    const kpis = {
      campanasLiquidadas: campanas.length,
      retornoInversorPromedioPct:
        retornos.length > 0 ? retornos.reduce((a, b) => a + b, 0) / retornos.length : null,
      cumpleFechasPct: onTimeEvaluables > 0 ? (onTimeCount / onTimeEvaluables) * 100 : null,
      rindeCumplimientoPromedioPct:
        cumplimientos.length > 0
          ? cumplimientos.reduce((a, b) => a + b, 0) / cumplimientos.length
          : null,
    };

    return { productor, campanas, kpis };
  }

  async detalle(productorId: string) {
    const productor = await this.prisma.usuario.findUnique({
      where: { id: productorId },
      include: {
        tokenizacionesProductor: {
          include: {
            campania: {
              include: {
                cultivo: true,
                establecimiento: { include: { acopioHabitual: true } },
              },
            },
            tenencias: { select: { id: true, tokens: true, walletAddress: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!productor) throw new NotFoundException('Productor no encontrado');

    const resumen = this.armarProductorResumen(productor);
    const tokenizaciones = productor.tokenizacionesProductor;

    // Serie histórica de precios (mock) por cultivo para trazabilidad.
    // En prod real, esto sería una lectura del oráculo — acá lo simulamos con
    // una serie 90d con noise gaussiano y reversión a la media.
    const cultivosTrackeados = Array.from(
      new Set(tokenizaciones.map((t) => t.campania.cultivo?.nombre).filter(Boolean) as string[]),
    );
    const trazabilidad: Record<string, { fecha: string; usdTn: number }[]> = {};
    cultivosTrackeados.forEach((c) => {
      trazabilidad[c] = this.generarSerieHistorica(c);
    });

    // Eventos por campaña (hitos): publicación, cambios, ventas relevantes.
    const eventos = tokenizaciones.map((t) => ({
      tokenizacionId: t.id,
      hitos: this.generarHitos(t),
    }));

    return {
      ...resumen,
      tokenizaciones,
      trazabilidad,
      eventos,
    };
  }

  // ─── helpers privados ─────────────────────────────────────────────

  private armarProductorResumen(p: any) {
    const tokenizaciones = p.tokenizacionesProductor ?? [];
    const activas = tokenizaciones.filter((t: any) => t.campania.estadoToken === 'abierta' || t.campania.estadoToken === 'en_curso' || t.campania.estadoToken === 'en_cosecha');
    const liquidadas = tokenizaciones.filter((t: any) => t.campania.estadoToken === 'liquidada');
    const liquidadasBien = liquidadas.filter((t: any) => t.precioLiquidacionUsdTn && Number(t.precioLiquidacionUsdTn) >= Number(t.precioReferenciaUsdTn));

    const rating = this.calcularRating({
      totalCampanias: tokenizaciones.length,
      campaniasLiquidadas: liquidadas.length,
      liquidadasPositivas: liquidadasBien.length,
      tieneGarantias: tokenizaciones.some(
        (t: any) => t.tieneSeguroGranizo || t.tieneSeguroParametrico || t.tieneAvalSgr,
      ),
      antiguedadDias: p.createdAt ? Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (24 * 3600 * 1000)) : 0,
    });

    // Toneladas totales bajo administración (activas)
    const toneladasBajoAdmin = activas.reduce(
      (acc: number, t: any) => acc + Number(t.toneladasOfrecidas),
      0,
    );
    const usdRecaudadoTotal = tokenizaciones.reduce(
      (acc: number, t: any) => acc + Number(t.montoRecaudadoUsd ?? 0),
      0,
    );

    // Cultivos que maneja
    const cultivos = Array.from(
      new Set(tokenizaciones.map((t: any) => t.campania.cultivo?.nombre).filter(Boolean)),
    );

    // Provincia dominante
    const provincias = tokenizaciones.map((t: any) => t.campania.establecimiento?.provincia).filter(Boolean);
    const provinciaMasFrecuente = provincias.length > 0
      ? provincias.sort((a: string, b: string) =>
          provincias.filter((v: string) => v === a).length - provincias.filter((v: string) => v === b).length,
        ).pop()
      : null;

    return {
      id: p.id,
      nombre: p.nombre,
      email: p.email,
      walletAddress: p.walletAddress,
      createdAt: p.createdAt,
      rating,
      metricas: {
        campaniasActivas: activas.length,
        campaniasLiquidadas: liquidadas.length,
        liquidadasPositivas: liquidadasBien.length,
        toneladasBajoAdmin,
        usdRecaudadoTotal,
      },
      cultivos,
      provincia: provinciaMasFrecuente,
      campaniasActivas: activas,
    };
  }

  /**
   * Rating 0-5 con 1 decimal. Base 3.5, penaliza si tiene liquidadas
   * negativas, bonifica por antigüedad, garantías y liquidaciones positivas.
   * Con pocos datos, se mantiene cerca de 4.0 (neutro-positivo).
   */
  private calcularRating(input: {
    totalCampanias: number;
    campaniasLiquidadas: number;
    liquidadasPositivas: number;
    tieneGarantias: boolean;
    antiguedadDias: number;
  }): number {
    let score = 3.5;

    // Ratio de éxito en liquidaciones
    if (input.campaniasLiquidadas > 0) {
      const ratioExito = input.liquidadasPositivas / input.campaniasLiquidadas;
      score += (ratioExito - 0.5) * 1.5; // rango [-0.75, +0.75]
    } else {
      score += 0.2; // sin historial malo, ligeramente positivo
    }

    // Garantías
    if (input.tieneGarantias) score += 0.4;

    // Antigüedad (bonus max 0.4 a los 365 días)
    score += Math.min(0.4, input.antiguedadDias / 365 * 0.4);

    // Volumen (bonus por operar volumen)
    score += Math.min(0.3, input.totalCampanias * 0.08);

    // Clamp y redondeo a 1 decimal
    return Math.round(Math.max(1.0, Math.min(5.0, score)) * 10) / 10;
  }

  /**
   * Genera 90 días de serie histórica para el cultivo con random walk.
   * Determinístico por cultivo — sirve para trazabilidad visual.
   */
  private generarSerieHistorica(cultivo: string): { fecha: string; usdTn: number }[] {
    const bases: Record<string, number> = {
      soja: 305,
      'maíz': 192,
      trigo: 240,
      girasol: 380,
    };
    const base = bases[cultivo] ?? 300;
    const seed = cultivo.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    let precio = base;
    const serie: { fecha: string; usdTn: number }[] = [];
    const hoy = Date.now();

    for (let i = 90; i >= 0; i--) {
      // Pseudo-random determinístico con hash simple
      const rnd = Math.sin(seed + i * 7.3) * 43758.5453;
      const cambio = (rnd - Math.floor(rnd) - 0.5) * base * 0.02;
      const reversion = (base - precio) * 0.03;
      precio = Math.max(base * 0.7, precio + cambio + reversion);
      serie.push({
        fecha: new Date(hoy - i * 24 * 3600 * 1000).toISOString(),
        usdTn: Math.round(precio * 100) / 100,
      });
    }
    return serie;
  }

  /**
   * Genera hitos de vida de una campaña para el timeline de trazabilidad.
   * En prod real serían eventos on-chain reales; acá los derivamos de
   * los timestamps y las tenencias que ya están en la BD.
   */
  private generarHitos(t: any): {
    fecha: string;
    tipo: 'publicacion' | 'compra' | 'cambio_precio' | 'liquidacion' | 'aprobacion';
    descripcion: string;
    monto?: number;
  }[] {
    const hitos = [];
    if (t.createdAt) {
      hitos.push({
        fecha: new Date(t.createdAt).toISOString(),
        tipo: 'publicacion' as const,
        descripcion: 'Emisión creada',
      });
    }
    if (t.aprobadaEn) {
      hitos.push({
        fecha: new Date(t.aprobadaEn).toISOString(),
        tipo: 'aprobacion' as const,
        descripcion: 'Aprobada por admin — publicada al marketplace',
      });
    }
    // Compras: agregamos las top 3 más recientes
    const compras = (t.tenencias ?? []).slice(0, 3);
    compras.forEach((c: any) => {
      if (c.createdAt) {
        hitos.push({
          fecha: new Date(c.createdAt).toISOString(),
          tipo: 'compra' as const,
          descripcion: `Compra de ${Number(c.tokens).toFixed(0)} HRV`,
          monto: Number(c.tokens),
        });
      }
    });
    if (t.liquidadaEn) {
      hitos.push({
        fecha: new Date(t.liquidadaEn).toISOString(),
        tipo: 'liquidacion' as const,
        descripcion: `Liquidada a ${Number(t.precioLiquidacionUsdTn ?? 0).toFixed(2)} USD/t`,
      });
    }
    return hitos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }
}
