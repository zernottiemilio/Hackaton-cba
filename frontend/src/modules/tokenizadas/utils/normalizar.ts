import type { Tokenizacion, Tenencia, PortfolioResponse } from '../types/tokenizadas';

/**
 * Prisma serializa los `Decimal` como string ("250", "3.6"). Los tipos del
 * front los declaran `number` y los helpers de formato hacen `.toFixed`, así
 * que un string los rompe en runtime ("t.toFixed is not a function").
 *
 * Se normaliza acá, en la frontera con la API, para que ninguna pantalla
 * tenga que acordarse de hacer `Number()`.
 */

type Raw = Record<string, unknown>;

const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

const CAMPOS_TOKENIZACION = [
  'toneladasOfrecidas',
  'tokensEmitidos',
  'tokensVendidos',
  'precioReferenciaUsdTn',
  'descuentoPct',
  'precioTokenUsd',
  'montoObjetivoUsd',
  'montoRecaudadoUsd',
  'sobrecolateralPct',
] as const;

const CAMPOS_TOKENIZACION_NULABLES = [
  'porcentaje',
  'toneladasFijas',
  'precioPisoUsd',
  'precioLiquidacionUsdTn',
  'toneladasMinimas',
  'toneladasEntregadas',
  'payoutPorTokenUsd',
] as const;

export function normalizarTokenizacion(raw: unknown): Tokenizacion {
  const t = { ...(raw as Raw) };
  for (const k of CAMPOS_TOKENIZACION) t[k] = num(t[k]);
  for (const k of CAMPOS_TOKENIZACION_NULABLES) t[k] = numOrNull(t[k]);

  const campania = t.campania as Raw | undefined;
  if (campania) {
    const c = { ...campania };
    c.hectareasAfectadas = numOrNull(c.hectareasAfectadas);
    c.rindeEstimadoTnHa = numOrNull(c.rindeEstimadoTnHa);
    c.rindeRealTnHa = numOrNull(c.rindeRealTnHa);
    const est = c.establecimiento as Raw | undefined;
    if (est) c.establecimiento = { ...est, superficieTotalHa: numOrNull(est.superficieTotalHa) };
    t.campania = c;
  }

  const disp = t.disponibilidad as Raw | undefined;
  if (disp) {
    t.disponibilidad = {
      tokensEmitidos: num(disp.tokensEmitidos),
      tokensVendidos: num(disp.tokensVendidos),
      tokensReservados: num(disp.tokensReservados),
      tokensDisponibles: num(disp.tokensDisponibles),
    };
  }

  if (Array.isArray(t.tenencias)) {
    t.tenencias = (t.tenencias as unknown[]).map((x) => normalizarTenenciaPlana(x));
  }
  return t as unknown as Tokenizacion;
}

function normalizarTenenciaPlana(raw: unknown): Raw {
  const x = { ...(raw as Raw) };
  x.tokens = num(x.tokens);
  if ('precioCompraUsd' in x) x.precioCompraUsd = num(x.precioCompraUsd);
  if ('montoTotalUsd' in x) x.montoTotalUsd = num(x.montoTotalUsd);
  if ('usdcRecibido' in x) x.usdcRecibido = numOrNull(x.usdcRecibido);
  return x;
}

export function normalizarTenencia(raw: unknown): Tenencia {
  const x = normalizarTenenciaPlana(raw);
  if (x.tokenizacion) x.tokenizacion = normalizarTokenizacion(x.tokenizacion);
  return x as unknown as Tenencia;
}

export function normalizarPortfolio(raw: unknown): PortfolioResponse {
  const p = raw as Raw;
  const resumen = (p.resumen ?? {}) as Raw;
  return {
    tenencias: Array.isArray(p.tenencias) ? (p.tenencias as unknown[]).map(normalizarTenencia) : [],
    resumen: {
      invertidoUsd: num(resumen.invertidoUsd),
      valorActualUsd: num(resumen.valorActualUsd),
      retornoNoRealizado: num(resumen.retornoNoRealizado),
      retornoPct: num(resumen.retornoPct),
      cantidadTenencias: num(resumen.cantidadTenencias),
    },
  };
}
