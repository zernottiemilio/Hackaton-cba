/**
 * Formateadores del módulo tokenizadas. Convención argentina para números
 * grandes (separador de miles con punto, decimal con coma).
 * Todas las cifras se muestran con font-variant-numeric: tabular-nums a
 * nivel CSS global — acá solo devolvemos el string.
 */

export function usd(monto: number, decimales = 2): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(monto);
}

export function usdCompacto(monto: number): string {
  if (Math.abs(monto) >= 1_000_000) return `$${(monto / 1_000_000).toFixed(2)}M`;
  if (Math.abs(monto) >= 1_000) return `$${(monto / 1_000).toFixed(1)}K`;
  return usd(monto, 0);
}

export function usdTn(monto: number): string {
  return `${usd(monto, 2)} / tn`;
}

export function toneladas(tn: number, decimales = 1): string {
  return `${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(tn)} tn`;
}

export function hectareas(ha: number): string {
  return `${new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 1,
  }).format(ha)} ha`;
}

export function porcentaje(pct: number, decimales = 1): string {
  const signo = pct > 0 ? '+' : '';
  return `${signo}${pct.toFixed(decimales)}%`;
}

export function fecha(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function fechaCorta(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  });
}

/** Cuenta regresiva en días. Devuelve string tipo "12d 04h" o "3h 22m". */
export function diasRestantes(iso: string | Date): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'cerrado';
  const dias = Math.floor(diff / (24 * 3600 * 1000));
  const horas = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
  const mins = Math.floor((diff % (3600 * 1000)) / 60_000);
  if (dias > 0) return `${dias}d ${String(horas).padStart(2, '0')}h`;
  if (horas > 0) return `${horas}h ${String(mins).padStart(2, '0')}m`;
  return `${mins}m`;
}

/** Trunca una address Solana Explorer style. */
export function abreviarAddress(address: string, prefijo = 4, sufijo = 4): string {
  if (!address || address.length < prefijo + sufijo + 3) return address;
  return `${address.slice(0, prefijo)}…${address.slice(-sufijo)}`;
}

/** Trunca una tx signature (más larga que address). */
export function abreviarTx(signature: string): string {
  return abreviarAddress(signature, 6, 6);
}
