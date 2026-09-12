/**
 * Mock determinístico de datos técnicos por tokenización.
 *
 * Cada tokenización usa su `id` como seed para un PRNG (Mulberry32). Eso
 * garantiza que la misma campaña siempre muestre los mismos números —
 * necesario para la demo: no queremos que el clima o el NDVI de "El Peral"
 * cambien entre refresh. En producción esto se reemplaza por integraciones
 * reales (SMN para clima, INTA para suelo, Sentinel-2 para NDVI).
 */

// ─── PRNG ───────────────────────────────────────────────────────────

/** Convierte un string a un seed uint32 estable. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Mulberry32 — random [0,1) determinístico. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inRange = (rng: () => number, min: number, max: number) => min + rng() * (max - min);

// ─── Tipos públicos ─────────────────────────────────────────────────

export interface PuntoMensual {
  mes: string;
  mm: number;
  promedioHistorico: number;
}

export interface DatosClimaMock {
  serie: PuntoMensual[];
  acumuladoCicloMm: number;
  promedioHistoricoCicloMm: number;
  deficitMm: number;
  /** `verde` normal, `amarillo` alerta, `rojo` estrés hídrico severo. */
  semaforo: 'verde' | 'amarillo' | 'rojo';
  temperaturaMediaC: number;
  ultimaLluviaDiasAtras: number;
  fuente: string;
}

export interface DatosSueloMock {
  textura: string;
  /** Materia orgánica en %. Rango típico núcleo agrícola AR: 2.0 - 4.5 */
  materiaOrganicaPct: number;
  materiaOrganicaRango: [number, number];
  ph: number;
  phRango: [number, number];
  /** Capacidad de retención hídrica en mm. */
  capacidadRetencionMm: number;
  capacidadRetencionRango: [number, number];
  /** Nitrógeno disponible, kg/ha. */
  nitrogenoKgHa: number;
  nitrogenoRango: [number, number];
  fuente: string;
  ultimoMuestreo: string;
}

export interface PuntoNdvi {
  fecha: string;
  lote: number;
  tipico: number;
}

export interface DatosNdviMock {
  serie: PuntoNdvi[];
  actualLote: number;
  actualTipico: number;
  /** Delta lote vs típico en % (positivo = más vigoroso que el promedio del cultivo). */
  deltaPct: number;
  /** Interpretación humana ("vigoroso", "normal", "estresado"). */
  estado: 'vigoroso' | 'normal' | 'estresado';
  fuente: string;
}

// ─── Generadores ────────────────────────────────────────────────────

const MESES = ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Promedios climatológicos aproximados núcleo agrícola de Córdoba (mm/mes)
const PROM_HISTORICO_MM = [60, 30, 20, 25, 60, 95, 120, 130];
const TEXTURAS = ['Franco arcilloso', 'Franco limoso', 'Franco', 'Franco arenoso'];
const FUENTES_SUELO = ['INTA Manfredi 2024', 'INTA Marcos Juárez 2023', 'INTA Villa Dolores 2024'];

export function generarClima(tokenizacionId: string): DatosClimaMock {
  const rng = mulberry32(hashSeed(tokenizacionId + ':clima'));
  const desvio = inRange(rng, 0.6, 1.25); // multiplicador global del ciclo
  const serie: PuntoMensual[] = PROM_HISTORICO_MM.map((prom, i) => {
    const mm = Math.max(0, Math.round(prom * desvio + inRange(rng, -25, 20)));
    return { mes: MESES[i], mm, promedioHistorico: prom };
  });
  const acumuladoCicloMm = serie.reduce((s, p) => s + p.mm, 0);
  const promedioHistoricoCicloMm = PROM_HISTORICO_MM.reduce((s, p) => s + p, 0);
  const deficitMm = promedioHistoricoCicloMm - acumuladoCicloMm;
  const semaforo: DatosClimaMock['semaforo'] =
    deficitMm > 120 ? 'rojo' : deficitMm > 60 ? 'amarillo' : 'verde';
  return {
    serie,
    acumuladoCicloMm,
    promedioHistoricoCicloMm,
    deficitMm,
    semaforo,
    temperaturaMediaC: Math.round(inRange(rng, 18, 24) * 10) / 10,
    ultimaLluviaDiasAtras: Math.floor(inRange(rng, 1, 18)),
    fuente: 'SMN + estación local',
  };
}

export function generarSuelo(tokenizacionId: string): DatosSueloMock {
  const rng = mulberry32(hashSeed(tokenizacionId + ':suelo'));
  return {
    textura: TEXTURAS[Math.floor(rng() * TEXTURAS.length)],
    materiaOrganicaPct: Math.round(inRange(rng, 2.2, 4.2) * 10) / 10,
    materiaOrganicaRango: [2.0, 4.5],
    ph: Math.round(inRange(rng, 5.6, 7.2) * 10) / 10,
    phRango: [5.5, 7.5],
    capacidadRetencionMm: Math.round(inRange(rng, 130, 220)),
    capacidadRetencionRango: [120, 240],
    nitrogenoKgHa: Math.round(inRange(rng, 45, 95)),
    nitrogenoRango: [40, 100],
    fuente: FUENTES_SUELO[Math.floor(rng() * FUENTES_SUELO.length)],
    ultimoMuestreo: `${Math.floor(inRange(rng, 3, 10))} meses atrás`,
  };
}

/** Curva típica sigmoidal del ciclo del cultivo (0 → 0.85 → 0.3). */
function ndviTipico(t: number): number {
  // t en [0,1] representa el % del ciclo transcurrido
  if (t < 0.15) return 0.15 + t * 0.9;
  if (t < 0.55) return 0.35 + Math.sin(((t - 0.15) / 0.4) * Math.PI * 0.5) * 0.5;
  return 0.85 - Math.max(0, (t - 0.55) / 0.45) * 0.55;
}

export function generarNdvi(tokenizacionId: string): DatosNdviMock {
  const rng = mulberry32(hashSeed(tokenizacionId + ':ndvi'));
  // Offset del lote vs curva típica — puede ser mejor, igual o peor.
  const offset = inRange(rng, -0.12, 0.12);
  const N = 24; // últimos 24 puntos (~2 puntos por mes)
  const serie: PuntoNdvi[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const tipico = ndviTipico(t);
    // ruido chico para que la curva del lote no sea idéntica a la típica.
    const ruido = (rng() - 0.5) * 0.04;
    const lote = Math.max(0, Math.min(1, tipico + offset + ruido));
    const fecha = `sem ${i + 1}`;
    serie.push({ fecha, lote, tipico });
  }
  const ultimo = serie[serie.length - 1];
  const deltaPct = ultimo.tipico > 0 ? ((ultimo.lote - ultimo.tipico) / ultimo.tipico) * 100 : 0;
  const estado: DatosNdviMock['estado'] =
    deltaPct >= 6 ? 'vigoroso' : deltaPct <= -6 ? 'estresado' : 'normal';
  return {
    serie,
    actualLote: ultimo.lote,
    actualTipico: ultimo.tipico,
    deltaPct,
    estado,
    fuente: 'Sentinel-2 · procesado propio',
  };
}
