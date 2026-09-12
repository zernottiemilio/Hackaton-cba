import Decimal from 'decimal.js';

/**
 * Comisión de plataforma que Harvest.fi retiene en cada operación de la
 * tokenización. Aplica tanto a la compra del inversor como al cobro del
 * productor (release_funds). El asiento contable vive en
 * `comisiones_plataforma`; el ledger on-chain no se toca.
 *
 * Si en el futuro el fee cambia, se actualiza acá y cada registro nuevo lleva
 * la tasa vigente al momento — los históricos conservan su tasa original.
 */
export const COMISION_PLATAFORMA_PCT = 1.5;

export interface DesgloseComision {
  montoBrutoUsd: number;
  porcentaje: number;
  montoComisionUsd: number;
  montoNetoUsd: number;
}

/** Aplica la comisión sobre un monto bruto. Devuelve bruto/comisión/neto. */
export function calcularComision(montoBrutoUsd: number): DesgloseComision {
  const bruto = new Decimal(montoBrutoUsd);
  const pct = new Decimal(COMISION_PLATAFORMA_PCT);
  const comision = bruto.mul(pct).div(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const neto = bruto.sub(comision);
  return {
    montoBrutoUsd: bruto.toNumber(),
    porcentaje: pct.toNumber(),
    montoComisionUsd: comision.toNumber(),
    montoNetoUsd: neto.toNumber(),
  };
}
