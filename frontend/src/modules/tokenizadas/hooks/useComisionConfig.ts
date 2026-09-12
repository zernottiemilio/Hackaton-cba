import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi } from '../services/tokenizadasService';

/** Fallback mientras carga: la tasa que hoy fija el backend. */
const PORCENTAJE_DEFAULT = 1.5;

/**
 * Porcentaje de comisión vigente y tesorería. Se cachea: cambia con un deploy,
 * no en runtime. Devuelve siempre un valor usable para calcular en vivo.
 */
export function useComisionConfig() {
  const { data } = useQuery({
    queryKey: ['tk', 'comisiones', 'config'],
    queryFn: () => tokenizadasApi.comisionesConfig(),
    staleTime: Infinity,
  });
  const porcentaje = data?.porcentaje ?? PORCENTAJE_DEFAULT;
  return {
    porcentaje,
    tesoreria: data?.tesoreria ?? null,
    /** Aplica la comisión a un bruto. Misma regla que el backend (redondeo a 4 decimales). */
    desglosar: (bruto: number) => {
      const comision = Math.round(bruto * porcentaje * 100) / 10_000;
      return { bruto, comision, neto: bruto - comision };
    },
  };
}
